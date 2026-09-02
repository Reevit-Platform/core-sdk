/**
 * Intent identity + cache helpers
 *
 * Two different keys are in play here and mixing them up is a money bug:
 *
 * - the **lookup key** is the deterministic djb2 hash of the checkout
 *   parameters (`generateIdempotencyKey`). It identifies "the same checkout
 *   attempt" for the in-flight cache and is never sent to the API.
 * - the **wire key** is the per-attempt UUID (`attemptIdempotencyKey`) that
 *   goes out as the `Idempotency-Key` header.
 *
 * The cache is keyed by the lookup key and remembers the wire key it minted.
 * The public helpers accept either key so callers that only ever saw the
 * `idempotencyKey` field keep working unchanged.
 */

import type { PaymentIntentResponse } from './api/client';
import { attemptIdempotencyKey, generateIdempotencyKey } from './api/client';
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
  /** The `Idempotency-Key` sent on the wire for this attempt. */
  idempotencyKey?: string;
}

const intentCache = new Map<string, IntentCacheEntry>();
/** wire key -> lookup key, so callers can pass either one. */
const lookupKeyByWireKey = new Map<string, string>();

function forgetKey(lookupKey: string): void {
  const entry = intentCache.get(lookupKey);
  if (entry?.idempotencyKey) {
    lookupKeyByWireKey.delete(entry.idempotencyKey);
  }
  intentCache.delete(lookupKey);
}

/** Accepts either the lookup key or the wire key. */
function toLookupKey(key: string): string {
  return lookupKeyByWireKey.get(key) ?? key;
}

function pruneIntentCache(now: number = Date.now()): void {
  for (const [key, entry] of intentCache) {
    if (entry.expiresAt <= now) {
      forgetKey(key);
    }
  }
}

function getIntentCacheEntryInternal(lookupKey: string): IntentCacheEntry | undefined {
  const entry = intentCache.get(lookupKey);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    forgetKey(lookupKey);
    return undefined;
  }
  return entry;
}

function setIntentCacheEntryInternal(lookupKey: string, update: Partial<IntentCacheEntry>): IntentCacheEntry {
  const now = Date.now();
  const existing = getIntentCacheEntryInternal(lookupKey);
  const next: IntentCacheEntry = {
    ...existing,
    ...update,
    expiresAt: now + INTENT_CACHE_TTL_MS,
  };
  if (existing?.idempotencyKey && existing.idempotencyKey !== next.idempotencyKey) {
    lookupKeyByWireKey.delete(existing.idempotencyKey);
  }
  intentCache.set(lookupKey, next);
  if (next.idempotencyKey && next.idempotencyKey !== lookupKey) {
    lookupKeyByWireKey.set(next.idempotencyKey, lookupKey);
  }
  return next;
}

function buildIdempotencyPayload(options: IntentIdentityOptions): Record<string, unknown> {
  const { config, method, preferredProvider, allowedProviders, publicKey } = options;
  if (config.sessionSecret) {
    return {
      sessionSecret: config.sessionSecret,
      publicKey: publicKey || config.publicKey || '',
    };
  }

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
  /** The value to send as `Idempotency-Key`. */
  idempotencyKey: string;
  /** The local cache key. Never send this on the wire. */
  lookupKey: string;
  reference: string;
  cacheEntry?: IntentCacheEntry;
} {
  pruneIntentCache();

  // A caller-supplied key is authoritative for both roles: the merchant owns
  // its retry semantics and we must send exactly what they asked for.
  const explicitKey = options.config.idempotencyKey;
  const lookupKey = explicitKey || generateIdempotencyKey(buildIdempotencyPayload(options));
  const idempotencyKey = explicitKey || attemptIdempotencyKey(lookupKey);

  const existing = getIntentCacheEntryInternal(lookupKey);
  const reference = options.config.reference || existing?.reference || generateReference();

  const cacheEntry = setIntentCacheEntryInternal(lookupKey, { reference, idempotencyKey });

  return { idempotencyKey, lookupKey, reference, cacheEntry };
}

export function getIntentCacheEntry(key: string): IntentCacheEntry | undefined {
  pruneIntentCache();
  return getIntentCacheEntryInternal(toLookupKey(key));
}

export function cacheIntentPromise(
  key: string,
  promise: Promise<PaymentIntentResponse>
): IntentCacheEntry {
  return setIntentCacheEntryInternal(toLookupKey(key), { promise });
}

export function cacheIntentResponse(
  key: string,
  response: PaymentIntentResponse
): IntentCacheEntry {
  return setIntentCacheEntryInternal(toLookupKey(key), { response, promise: undefined });
}

export function clearIntentCacheEntry(key: string): void {
  forgetKey(toLookupKey(key));
}
