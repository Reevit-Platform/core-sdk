import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentIntentResponse } from './api/client';
import { clearIdempotencyAttemptKeys, generateIdempotencyKey } from './api/client';
import {
  cacheIntentPromise,
  cacheIntentResponse,
  clearIntentCacheEntry,
  getIntentCacheEntry,
  resolveIntentIdentity,
} from './intent';
import type { ReevitCheckoutConfig } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONFIG: ReevitCheckoutConfig = {
  publicKey: 'pfk_test_1',
  amount: 4500,
  currency: 'GHS',
  email: 'ama@example.com',
};

function intent(id: string): PaymentIntentResponse {
  return { id } as PaymentIntentResponse;
}

// The intent cache and the attempt-key store are module-level, so every test
// scopes itself with a unique metadata nonce instead of relying on a reset.
let testId = 0;

function resolve(config: ReevitCheckoutConfig = CONFIG) {
  const scoped: ReevitCheckoutConfig = {
    ...config,
    metadata: { ...config.metadata, testId },
  };
  return resolveIntentIdentity({ config: scoped, publicKey: scoped.publicKey });
}

beforeEach(() => {
  testId++;
  clearIdempotencyAttemptKeys();
});
afterEach(() => {
  vi.useRealTimers();
  clearIdempotencyAttemptKeys();
});

describe('resolveIntentIdentity', () => {
  it('returns a UUID wire key and a djb2 lookup key', () => {
    const identity = resolve();

    expect(identity.idempotencyKey).toMatch(UUID_RE);
    expect(identity.lookupKey).toMatch(/^reevit_\d+_[0-9a-f]+$/);
    expect(identity.idempotencyKey).not.toBe(identity.lookupKey);
  });

  it('is stable across calls for the same config, and reuses the reference', () => {
    const first = resolve();
    const second = resolve({ ...CONFIG });

    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.lookupKey).toBe(first.lookupKey);
    expect(second.reference).toBe(first.reference);
  });

  it('mints a different wire key for a different shopper', () => {
    const ama = resolve();
    const kofi = resolve({ ...CONFIG, email: 'kofi@example.com' });

    expect(kofi.lookupKey).not.toBe(ama.lookupKey);
    expect(kofi.idempotencyKey).not.toBe(ama.idempotencyKey);
  });

  it('keys off the session secret alone when one is present', () => {
    const secret = `sess_${testId}`;
    const a = resolve({ publicKey: 'pfk_test_1', sessionSecret: secret, amount: 4500, currency: 'GHS' });
    const b = resolve({ publicKey: 'pfk_test_1', sessionSecret: secret, amount: 999, currency: 'NGN' });

    expect(b.lookupKey).toBe(a.lookupKey);
    expect(b.idempotencyKey).toBe(a.idempotencyKey);
  });

  it('honours a merchant-supplied idempotencyKey for both roles', () => {
    const key = `order_${testId}`;
    const identity = resolve({ ...CONFIG, idempotencyKey: key });

    expect(identity.idempotencyKey).toBe(key);
    expect(identity.lookupKey).toBe(key);
  });

  it('keeps a caller-supplied reference', () => {
    expect(resolve({ ...CONFIG, reference: 'order_ref' }).reference).toBe('order_ref');
    expect(resolve({ ...CONFIG, reference: 'order_ref' }).lookupKey).toMatch(/^reevit_/);
  });

  it('generates a reference when none is supplied', () => {
    expect(resolve().reference).toMatch(/^reevit_/);
  });
});

describe('in-flight intent cache', () => {
  it('hands back the same promise for a repeated click', async () => {
    const identity = resolve();
    let calls = 0;
    const request = () => {
      calls++;
      return Promise.resolve(intent('pi_1'));
    };

    const promise = request();
    cacheIntentPromise(identity.idempotencyKey, promise);

    const second = resolve({ ...CONFIG });
    expect(second.cacheEntry?.promise).toBe(promise);
    expect(await second.cacheEntry!.promise!).toEqual(intent('pi_1'));
    expect(calls).toBe(1);
  });

  it('is reachable by either the wire key or the lookup key', () => {
    const identity = resolve();
    const promise = Promise.resolve(intent('pi_1'));

    cacheIntentPromise(identity.idempotencyKey, promise);

    expect(getIntentCacheEntry(identity.idempotencyKey)?.promise).toBe(promise);
    expect(getIntentCacheEntry(identity.lookupKey)?.promise).toBe(promise);
  });

  it('records the wire key on the entry', () => {
    const identity = resolve();

    expect(getIntentCacheEntry(identity.lookupKey)?.idempotencyKey).toBe(identity.idempotencyKey);
  });

  it('cacheIntentResponse settles the entry and drops the promise', async () => {
    const identity = resolve();
    cacheIntentPromise(identity.idempotencyKey, Promise.resolve(intent('pi_1')));

    cacheIntentResponse(identity.idempotencyKey, intent('pi_1'));

    const entry = getIntentCacheEntry(identity.idempotencyKey);
    expect(entry?.promise).toBeUndefined();
    expect(entry?.response).toEqual(intent('pi_1'));
  });

  it('clearIntentCacheEntry removes the entry via the wire key', () => {
    const identity = resolve();
    cacheIntentPromise(identity.idempotencyKey, Promise.resolve(intent('pi_1')));

    clearIntentCacheEntry(identity.idempotencyKey);

    expect(getIntentCacheEntry(identity.idempotencyKey)).toBeUndefined();
    expect(getIntentCacheEntry(identity.lookupKey)).toBeUndefined();
  });

  it('clearIntentCacheEntry also works via the lookup key', () => {
    const identity = resolve();
    cacheIntentPromise(identity.idempotencyKey, Promise.resolve(intent('pi_1')));

    clearIntentCacheEntry(identity.lookupKey);

    expect(getIntentCacheEntry(identity.idempotencyKey)).toBeUndefined();
  });

  it('expires entries after the 10 minute TTL', () => {
    const identity = resolve();
    cacheIntentResponse(identity.idempotencyKey, intent('pi_1'));
    expect(getIntentCacheEntry(identity.idempotencyKey)?.response).toBeDefined();

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 11 * 60 * 1000);
      expect(getIntentCacheEntry(identity.idempotencyKey)).toBeUndefined();
      expect(getIntentCacheEntry(identity.lookupKey)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not leak one shopper\'s intent to another', () => {
    const ama = resolve();
    cacheIntentResponse(ama.idempotencyKey, intent('pi_ama'));

    const kofi = resolve({ ...CONFIG, email: 'kofi@example.com' });

    expect(kofi.cacheEntry?.response).toBeUndefined();
    expect(getIntentCacheEntry(kofi.idempotencyKey)?.response).toBeUndefined();
  });

  it('starts a new attempt after the per-tab key store is cleared', () => {
    const first = resolve();
    cacheIntentResponse(first.idempotencyKey, intent('pi_1'));

    clearIdempotencyAttemptKeys();
    const second = resolve({ ...CONFIG });

    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    // Same lookup key, so the local cache entry (and its reference) survives —
    // the wire key is what changed.
    expect(second.lookupKey).toBe(first.lookupKey);
    expect(second.reference).toBe(first.reference);
  });

  it('resolves the identity for a lookup key with no cached entry', () => {
    expect(getIntentCacheEntry(generateIdempotencyKey({ nothing: 'cached' }))).toBeUndefined();
  });
});
