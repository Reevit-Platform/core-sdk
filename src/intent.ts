/**
 * Intent identity + cache helpers
 */

import type { PaymentIntentResponse } from './api/client';
import { generateIdempotencyKey } from './api/client';
import type { PaymentMethod, ReevitCheckoutConfig } from './types';
import { generateReference } from './utils';

const INTENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface IntentIdentityOptions {
  config: ReevitCheckoutConfig;
  method?: PaymentMethod;
  preferredProvider?: string;
  allowedProviders?: string[];
  publicKey?: string;
}

export interface IntentCacheEntry {
  promise?: Promise<PaymentIntentResponse>;
  response?: PaymentIntentResponse;
  expiresAt: number;
  reference?: string;
}

const intentCache = new Map<string, IntentCacheEntry>();

function pruneIntentCache(now: number = Date.now()): void {
  for (const [key, entry] of intentCache) {
    if (entry.expiresAt <= now) {
      intentCache.delete(key);
    }
  }
}

function getIntentCacheEntryInternal(key: string): IntentCacheEntry | undefined {
  const entry = intentCache.get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    intentCache.delete(key);
    return undefined;
  }
  return entry;
}

function setIntentCacheEntryInternal(key: string, update: Partial<IntentCacheEntry>): IntentCacheEntry {
  const now = Date.now();
  const existing = getIntentCacheEntryInternal(key);
  const next: IntentCacheEntry = {
    ...existing,
    ...update,
    expiresAt: now + INTENT_CACHE_TTL_MS,
  };
  intentCache.set(key, next);
  return next;
}

function buildIdempotencyPayload(options: IntentIdentityOptions): Record<string, unknown> {
  const { config, method, preferredProvider, allowedProviders, publicKey } = options;
  const payload: Record<string, unknown> = {
    amount: config.amount,
    currency: config.currency,
    email: config.email || '',
    phone: config.phone || '',
    customerName: config.customerName || '',
    paymentLinkCode: config.paymentLinkCode || '',
    paymentMethods: config.paymentMethods || [],
    metadata: config.metadata || {},
    customFields: config.customFields || {},
    method: method || '',
    preferredProvider: preferredProvider || '',
    allowedProviders: allowedProviders || [],
    publicKey: publicKey || config.publicKey || '',
  };

  if (config.reference) {
    payload.reference = config.reference;
  }

  return payload;
}

export function resolveIntentIdentity(options: IntentIdentityOptions): {
  idempotencyKey: string;
  reference: string;
  cacheEntry?: IntentCacheEntry;
} {
  pruneIntentCache();

  const idempotencyKey =
    options.config.idempotencyKey || generateIdempotencyKey(buildIdempotencyPayload(options));
  const existing = getIntentCacheEntryInternal(idempotencyKey);
  const reference = options.config.reference || existing?.reference || generateReference();

  const cacheEntry = setIntentCacheEntryInternal(idempotencyKey, { reference });

  return { idempotencyKey, reference, cacheEntry };
}

export function getIntentCacheEntry(idempotencyKey: string): IntentCacheEntry | undefined {
  pruneIntentCache();
  return getIntentCacheEntryInternal(idempotencyKey);
}

export function cacheIntentPromise(
  idempotencyKey: string,
  promise: Promise<PaymentIntentResponse>
): IntentCacheEntry {
  return setIntentCacheEntryInternal(idempotencyKey, { promise });
}

export function cacheIntentResponse(
  idempotencyKey: string,
  response: PaymentIntentResponse
): IntentCacheEntry {
  return setIntentCacheEntryInternal(idempotencyKey, { response, promise: undefined });
}

export function clearIntentCacheEntry(idempotencyKey: string): void {
  intentCache.delete(idempotencyKey);
}
