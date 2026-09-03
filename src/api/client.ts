/**
 * Reevit API Client
 * 
 * Handles communication with the Reevit backend for payment operations.
 */

import type { PaymentMethod, ReevitCheckoutConfig, PaymentError, HubtelSessionResponse } from '../types';

// API Response Types (matching backend handlers_payments.go)
export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  method?: string;
  country: string;
  customer_id?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  policy?: {
    prefer?: string[];
    allowed_providers?: string[];
    max_amount?: number;
    blocked_bins?: string[];
    allowed_bins?: string[];
    velocity_max_per_minute?: number;
  };
}

export interface PaymentIntentResponse {
  id: string;
  org_id?: string;
  connection_id: string;
  provider: string;
  provider_ref_id?: string;
  status: string;
  client_secret: string;
  session_secret?: string;
  psp_public_key: string;
  psp_credentials?: {
    merchantAccount?: string | number;
    basicAuth?: string;
    [key: string]: unknown;
  };
  amount: number;
  currency: string;
  fee_amount: number;
  fee_currency: string;
  net_amount: number;
  reference?: string;
  available_psps?: Array<{
    provider: string;
    name: string;
    methods: string[];
    countries?: string[];
  }>;
  branding?: Record<string, unknown>;
}

export interface CheckoutSessionResponse {
  id: string;
  client_secret: string;
  session_secret: string;
  payment_intent: PaymentIntentResponse;
  expires_at?: string;
}

export interface ConfirmPaymentRequest {
  provider_ref_id: string;
  provider_data?: Record<string, unknown>;
}

export interface PaymentDetailResponse {
  id: string;
  connection_id: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  currency: string;
  fee_amount: number;
  fee_currency: string;
  net_amount: number;
  customer_id?: string;
  client_secret: string;
  provider_ref_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Payment source type (payment_link, api, subscription) */
  source?: 'payment_link' | 'api' | 'subscription';
  /** ID of the source (payment link ID, subscription ID, etc.) */
  source_id?: string;
  /** Human-readable description of the source (e.g., payment link name) */
  source_description?: string;
}

export interface APIErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ReevitAPIResult<T> = { data: T; error?: never } | { data?: never; error: PaymentError };

// API Client configuration
export interface ReevitAPIClientConfig {
  /** Your Reevit public key */
  publicKey?: string;
  /** Base URL for the Reevit API (defaults to production) */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// Default API base URLs
const API_BASE_URL_PRODUCTION = 'https://api.reevit.io';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
let hasWarnedAboutLiveBrowserIntents = false;

/**
 * Determines if a public key is for sandbox mode
 */
export function isSandboxKey(publicKey: string): boolean {
  return publicKey.startsWith('pfk_test_');
}

/**
 * Creates a PaymentError from an API error response
 */
export function createPaymentError(response: Response, errorData: APIErrorResponse): PaymentError {
  return {
    code: errorData.code || 'api_error',
    message: errorData.message || 'An unexpected error occurred',
    recoverable: isRecoverableStatus(response.status),
    details: {
      httpStatus: response.status,
      requestId: response.headers.get('x-request-id') || response.headers.get('x-reevit-request-id') || undefined,
      ...errorData.details,
    },
  };
}

export function isPaymentError(error: unknown): error is PaymentError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

export function isRecoverableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

/**
 * Generates a deterministic **cache/lookup** key from input parameters.
 *
 * NEVER SEND THIS ON THE WIRE. It is a 32-bit djb2 hash bucketed into
 * 5-minute windows, so two unrelated shoppers can collide and be handed each
 * other's payment intent (and therefore each other's `client_secret`), and a
 * shopper legitimately buying the same item twice inside one window would be
 * charged once. Its only job is to identify "the same checkout attempt" inside
 * a single browser tab so the in-flight intent cache can dedupe a repeated
 * "Continue" click.
 *
 * The value actually sent as `Idempotency-Key` is produced by
 * {@link newIdempotencyKey} / {@link attemptIdempotencyKey}.
 *
 * Exported for use by SDK hooks (e.g. payment link flows).
 */
export function generateIdempotencyKey(params: Record<string, unknown>): string {
  // Create a stable string representation of the parameters
  const sortedKeys = Object.keys(params).sort();
  const stableString = sortedKeys
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');

  // Simple hash function (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < stableString.length; i++) {
    hash = ((hash << 5) + hash) + stableString.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive hex string
  const hashHex = (hash >>> 0).toString(16);

  // Add a time bucket (5-minute windows) to allow retries within a reasonable window
  // but prevent keys from being reused across completely different sessions
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000));

  return `reevit_${timeBucket}_${hashHex}`;
}

const IDEMPOTENCY_STORE_PREFIX = 'reevit:idem:';

/** Fallback store for SSR / privacy mode, where `sessionStorage` is unusable. */
const memoryAttemptKeys = new Map<string, string>();

function getSessionStore(): Storage | null {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    if (!storage) {
      return null;
    }
    // Safari private mode and some embedded webviews throw on write.
    const probe = `${IDEMPOTENCY_STORE_PREFIX}probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Generates a fresh, globally unique `Idempotency-Key` (RFC 4122 v4 UUID).
 * This is the only value that should ever be sent on the wire.
 */
export function newIdempotencyKey(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    try {
      return cryptoObj.randomUUID();
    } catch {
      // fall through to the manual generator
    }
  }

  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/**
 * Resolves the stable per-checkout-attempt wire key for a deterministic
 * lookup key (see {@link generateIdempotencyKey}).
 *
 * The first call for a lookup key mints a UUID and stores it in
 * `sessionStorage` (falling back to a module-level map when storage is
 * unavailable); every later call in the same tab returns that same UUID, so a
 * repeated "Continue" click is still deduped by the backend. A different tab,
 * a different shopper or a cleared store yields a different UUID.
 */
export function attemptIdempotencyKey(lookupKey: string): string {
  const storageKey = `${IDEMPOTENCY_STORE_PREFIX}${lookupKey}`;
  const store = getSessionStore();

  if (store) {
    try {
      const existing = store.getItem(storageKey);
      if (existing) {
        return existing;
      }
      const created = newIdempotencyKey();
      store.setItem(storageKey, created);
      return created;
    } catch {
      // fall through to the in-memory store
    }
  }

  const existing = memoryAttemptKeys.get(storageKey);
  if (existing) {
    return existing;
  }
  const created = newIdempotencyKey();
  memoryAttemptKeys.set(storageKey, created);
  return created;
}

/**
 * Forgets every stored per-attempt key, so the next checkout attempt gets a
 * fresh `Idempotency-Key`. Call it after a completed checkout (and in tests).
 */
export function clearIdempotencyAttemptKeys(): void {
  memoryAttemptKeys.clear();

  const store = getSessionStore();
  if (!store) {
    return;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(IDEMPOTENCY_STORE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      store.removeItem(key);
    }
  } catch {
    // nothing else we can do
  }
}

/**
 * Reevit API Client
 */
export class ReevitAPIClient {
  private readonly publicKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: ReevitAPIClientConfig) {
    this.publicKey = config.publicKey || '';
    this.baseUrl = config.baseUrl || API_BASE_URL_PRODUCTION;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Makes an authenticated API request
   * @param idempotencyKey Optional deterministic idempotency key for the request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string
  ): Promise<ReevitAPIResult<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Generate headers with idempotency key for mutating requests
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Reevit-Client': '@reevit/core',
      'X-Reevit-Client-Version': '0.9.1',
    };
    if (this.publicKey) {
      headers['X-Reevit-Key'] = this.publicKey;
    }

    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      // Never derive the wire key from the request body: a body hash collides
      // across unrelated shoppers. Fall back to a fresh UUID instead.
      headers['Idempotency-Key'] = idempotencyKey || newIdempotencyKey();
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: createPaymentError(response, responseData as APIErrorResponse),
        };
      }

      return { data: responseData as T };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return {
            error: {
              code: 'request_timeout',
              message: 'The request timed out. Please try again.',
              recoverable: true,
            },
          };
        }

        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          return {
            error: {
              code: 'network_error',
              message: 'Unable to connect to Reevit. Please check your internet connection.',
              recoverable: true,
            },
          };
        }
      }

      return {
        error: {
          code: 'unknown_error',
          message: 'An unexpected error occurred. Please try again.',
          recoverable: true,
        },
      };
    }
  }

  /**
   * Creates a payment intent
   */
  async createPaymentIntent(
    config: ReevitCheckoutConfig,
    method?: PaymentMethod,
    country: string = 'GH',
    options?: { preferredProviders?: string[]; allowedProviders?: string[] }
  ): Promise<{ data?: PaymentIntentResponse; error?: PaymentError }> {
    if (
      this.publicKey.startsWith('pfk_live_') &&
      !hasWarnedAboutLiveBrowserIntents &&
      typeof console !== 'undefined'
    ) {
      hasWarnedAboutLiveBrowserIntents = true;
      console.warn(
        'Creating live payment intents from the browser is deprecated. Create a checkout session on your server and pass sessionSecret to the browser SDK instead.'
      );
    }

    if (typeof config.amount !== 'number' || !config.currency) {
      return {
        error: {
          code: 'invalid_checkout_config',
          message: 'amount and currency are required when creating a payment intent in the browser.',
          recoverable: false,
        },
      };
    }

    // Build metadata with customer_email for PSP providers that require it
    const metadata: Record<string, unknown> = { ...config.metadata };
    if (config.email) {
      metadata.customer_email = config.email;
    }
    if (config.phone) {
      metadata.customer_phone = config.phone;
    }

    const request: CreatePaymentIntentRequest = {
      amount: config.amount,
      currency: config.currency,
      country,
      customer_id: config.email || (config.metadata?.customerId as string | undefined),
      metadata,
    };

    if (method) {
      request.method = this.mapPaymentMethod(method);
    }

    if (options?.preferredProviders?.length || options?.allowedProviders?.length) {
      request.policy = {
        prefer: options?.preferredProviders,
        allowed_providers: options?.allowedProviders,
      };
    }

    // The deterministic hash identifies this checkout attempt *locally*; the
    // key we put on the wire is a UUID minted once per attempt and reused for
    // the life of the tab, so a repeated "Continue" click still dedupes while
    // two unrelated shoppers can never share a key.
    const idempotencyKey = config.idempotencyKey || attemptIdempotencyKey(generateIdempotencyKey({
      amount: config.amount,
      currency: config.currency,
      customer: config.email || config.metadata?.customerId || '',
      reference: config.reference || '',
      method: method || '',
      provider: options?.preferredProviders?.[0] || options?.allowedProviders?.[0] || '',
      publicKey: this.publicKey,
    }));

    return this.request<PaymentIntentResponse>('POST', '/v1/payments/intents', request, idempotencyKey);
  }

  /**
   * Retrieves a payment intent by ID
   */
  async getPaymentIntent(paymentId: string): Promise<{ data?: PaymentDetailResponse; error?: PaymentError }> {
    return this.request<PaymentDetailResponse>('GET', `/v1/payments/${paymentId}`);
  }

  /**
   * Retrieves a server-created checkout session using its public session secret.
   */
  async getCheckoutSession(sessionSecret: string): Promise<{ data?: CheckoutSessionResponse; error?: PaymentError }> {
    return this.request<CheckoutSessionResponse>(
      'GET',
      `/v1/checkout/sessions/${encodeURIComponent(sessionSecret)}`
    );
  }

  /**
   * Confirms a payment after PSP callback
   */
  async confirmPayment(paymentId: string): Promise<{ data?: PaymentDetailResponse; error?: PaymentError }> {
    return this.request<PaymentDetailResponse>('POST', `/v1/payments/${paymentId}/confirm`);
  }

  /**
   * Confirms a payment intent using client secret (public endpoint)
   */
  async confirmPaymentIntent(paymentId: string, clientSecret: string): Promise<{ data?: PaymentDetailResponse; error?: PaymentError }> {
    return this.request<PaymentDetailResponse>(
      'POST',
      `/v1/payments/${paymentId}/confirm-intent?client_secret=${encodeURIComponent(clientSecret)}`
    );
  }

  /**
   * Cancels a payment intent
   */
  async cancelPaymentIntent(paymentId: string): Promise<{ data?: PaymentDetailResponse; error?: PaymentError }> {
    return this.request<PaymentDetailResponse>('POST', `/v1/payments/${paymentId}/cancel`);
  }

  /**
   * Creates a Hubtel session token for secure checkout
   * Returns a short-lived token that contains Hubtel credentials
   * Credentials are never exposed to the client directly
   */
  async createHubtelSession(
    paymentId: string,
    clientSecret?: string
  ): Promise<{ data?: HubtelSessionResponse; error?: PaymentError }> {
    const query = clientSecret ? `?client_secret=${encodeURIComponent(clientSecret)}` : '';
    return this.request<HubtelSessionResponse>('POST', `/v1/payments/hubtel/sessions/${paymentId}${query}`);
  }

  /**
   * Maps SDK payment method to backend format
   */
  private mapPaymentMethod(method: PaymentMethod): string {
    switch (method) {
      case 'card':
        return 'card';
      case 'mobile_money':
        return 'mobile_money';
      case 'bank_transfer':
        return 'bank_transfer';
      default:
        return method;
    }
  }
}

/**
 * Creates a new Reevit API client instance
 */
export function createReevitClient(config: ReevitAPIClientConfig): ReevitAPIClient {
  return new ReevitAPIClient(config);
}
