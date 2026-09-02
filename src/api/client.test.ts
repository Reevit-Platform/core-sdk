import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReevitCheckoutConfig } from '../types';
import {
  ReevitAPIClient,
  attemptIdempotencyKey,
  clearIdempotencyAttemptKeys,
  createPaymentError,
  createReevitClient,
  generateIdempotencyKey,
  isPaymentError,
  isRecoverableStatus,
  isSandboxKey,
  newIdempotencyKey,
} from './client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DJB2_RE = /^reevit_\d+_[0-9a-f]+$/;

interface FetchCall {
  url: string;
  init: RequestInit & { headers: Record<string, string> };
}

function mockFetch(
  responder: (call: FetchCall) => { status?: number; body?: unknown; headers?: Record<string, string> } = () => ({})
) {
  const calls: FetchCall[] = [];
  const spy = vi.fn(async (url: string, init: any) => {
    const call: FetchCall = { url, init };
    calls.push(call);
    const { status = 200, body = {}, headers = {} } = responder(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', spy);
  return calls;
}

function headerOf(call: FetchCall, name: string): string | undefined {
  return call.init.headers[name];
}

const BASE_CONFIG: ReevitCheckoutConfig = {
  amount: 4500,
  currency: 'GHS',
  email: 'ama@example.com',
};

beforeEach(() => {
  clearIdempotencyAttemptKeys();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearIdempotencyAttemptKeys();
});

describe('isSandboxKey', () => {
  it('recognises test keys only', () => {
    expect(isSandboxKey('pfk_test_abc')).toBe(true);
    expect(isSandboxKey('pfk_live_abc')).toBe(false);
    expect(isSandboxKey('')).toBe(false);
  });
});

describe('isRecoverableStatus', () => {
  it.each([408, 409, 425, 429, 500, 502, 503, 504])('treats %i as recoverable', (status) => {
    expect(isRecoverableStatus(status)).toBe(true);
  });

  it.each([200, 400, 401, 402, 403, 404, 422])('treats %i as final', (status) => {
    expect(isRecoverableStatus(status)).toBe(false);
  });
});

describe('createPaymentError', () => {
  function response(status: number, headers: Record<string, string> = {}): Response {
    return {
      status,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    } as unknown as Response;
  }

  it('maps the API code, message, http status and x-request-id', () => {
    const error = createPaymentError(response(402, { 'x-request-id': 'req_123' }), {
      code: 'card_declined',
      message: 'Your card was declined',
    });

    expect(error).toMatchObject({
      code: 'card_declined',
      message: 'Your card was declined',
      recoverable: false,
    });
    expect(error.details).toMatchObject({ httpStatus: 402, requestId: 'req_123' });
  });

  it('falls back to the x-reevit-request-id header', () => {
    const error = createPaymentError(response(500, { 'x-reevit-request-id': 'req_fallback' }), {
      code: 'server_error',
      message: 'boom',
    });

    expect(error.details?.requestId).toBe('req_fallback');
    expect(error.recoverable).toBe(true);
  });

  it('leaves requestId undefined when neither header is present', () => {
    const error = createPaymentError(response(429), { code: 'rate_limited', message: 'slow down' });

    expect(error.details?.requestId).toBeUndefined();
    expect(error.recoverable).toBe(true);
  });

  it('defaults code and message, and merges extra details', () => {
    const error = createPaymentError(response(400), {
      code: '',
      message: '',
      details: { field: 'amount' },
    });

    expect(error.code).toBe('api_error');
    expect(error.message).toBe('An unexpected error occurred');
    expect(error.details).toMatchObject({ httpStatus: 400, field: 'amount' });
  });

  it('is recognised by isPaymentError', () => {
    expect(isPaymentError(createPaymentError(response(500), { code: 'x', message: 'y' }))).toBe(true);
    expect(isPaymentError({ nope: true })).toBe(false);
    expect(isPaymentError(null)).toBe(false);
    expect(isPaymentError('error')).toBe(false);
  });
});

describe('generateIdempotencyKey (deterministic lookup key)', () => {
  it('is stable for the same params inside one time bucket', () => {
    const params = { amount: 4500, currency: 'GHS', customer: 'ama@example.com' };
    expect(generateIdempotencyKey(params)).toBe(generateIdempotencyKey({ ...params }));
  });

  it('ignores key ordering', () => {
    expect(generateIdempotencyKey({ a: 1, b: 2 })).toBe(generateIdempotencyKey({ b: 2, a: 1 }));
  });

  it('changes when the reference changes', () => {
    expect(generateIdempotencyKey({ reference: 'order_1' })).not.toBe(
      generateIdempotencyKey({ reference: 'order_2' })
    );
  });

  it('uses the reevit_<bucket>_<hash> shape and rolls with the 5-minute bucket', () => {
    const key = generateIdempotencyKey({ amount: 4500 });
    expect(key).toMatch(DJB2_RE);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const first = generateIdempotencyKey({ amount: 4500 });
      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
      expect(generateIdempotencyKey({ amount: 4500 })).toBe(first);
      vi.setSystemTime(new Date('2026-01-01T00:06:00Z'));
      expect(generateIdempotencyKey({ amount: 4500 })).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('newIdempotencyKey (wire key)', () => {
  it('returns a v4 UUID', () => {
    expect(newIdempotencyKey()).toMatch(UUID_RE);
  });

  it('never repeats', () => {
    const keys = new Set(Array.from({ length: 500 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(500);
  });

  it('still returns a UUID without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i * 7;
        return arr;
      },
    });
    expect(newIdempotencyKey()).toMatch(UUID_RE);
  });

  it('still returns a UUID with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newIdempotencyKey()).toMatch(UUID_RE);
  });
});

describe('attemptIdempotencyKey', () => {
  it('mints one UUID per lookup key and reuses it for the life of the tab', () => {
    const first = attemptIdempotencyKey('reevit_1_abc');
    expect(first).toMatch(UUID_RE);
    expect(attemptIdempotencyKey('reevit_1_abc')).toBe(first);
    expect(sessionStorage.getItem('reevit:idem:reevit_1_abc')).toBe(first);
  });

  it('gives different lookup keys different wire keys', () => {
    expect(attemptIdempotencyKey('reevit_1_abc')).not.toBe(attemptIdempotencyKey('reevit_1_def'));
  });

  it('mints a fresh key once the store is cleared', () => {
    const first = attemptIdempotencyKey('reevit_1_abc');
    clearIdempotencyAttemptKeys();
    expect(attemptIdempotencyKey('reevit_1_abc')).not.toBe(first);
  });

  it('falls back to memory when sessionStorage is unavailable', () => {
    vi.stubGlobal('sessionStorage', undefined);
    const first = attemptIdempotencyKey('reevit_1_ssr');
    expect(first).toMatch(UUID_RE);
    expect(attemptIdempotencyKey('reevit_1_ssr')).toBe(first);
  });

  it('falls back to memory when sessionStorage throws (privacy mode)', () => {
    vi.stubGlobal('sessionStorage', {
      get length(): number {
        throw new Error('denied');
      },
      key: () => {
        throw new Error('denied');
      },
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });

    const first = attemptIdempotencyKey('reevit_1_private');
    expect(first).toMatch(UUID_RE);
    expect(attemptIdempotencyKey('reevit_1_private')).toBe(first);
  });
});

describe('request()', () => {
  it('sets an Idempotency-Key on POST', async () => {
    const calls = mockFetch();
    const client = new ReevitAPIClient({ publicKey: 'pfk_test_1', baseUrl: 'https://api.test' });

    await client.confirmPayment('pay_1');

    expect(calls).toHaveLength(1);
    expect(headerOf(calls[0], 'Idempotency-Key')).toMatch(UUID_RE);
  });

  it('does not set an Idempotency-Key on GET', async () => {
    const calls = mockFetch();
    const client = new ReevitAPIClient({ publicKey: 'pfk_test_1', baseUrl: 'https://api.test' });

    await client.getPaymentIntent('pay_1');

    expect(calls[0].url).toBe('https://api.test/v1/payments/pay_1');
    expect(headerOf(calls[0], 'Idempotency-Key')).toBeUndefined();
  });

  it('never derives the keyless-POST fallback from the body hash', async () => {
    const calls = mockFetch();
    const client = createReevitClient({ publicKey: 'pfk_test_1', baseUrl: 'https://api.test' });

    await client.createHubtelSession('pay_1');
    await client.createHubtelSession('pay_1');

    const [a, b] = calls.map((call) => headerOf(call, 'Idempotency-Key'));
    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toMatch(DJB2_RE);
    expect(a).not.toBe(b);
  });

  it('sends the client identification and key headers', async () => {
    const calls = mockFetch();
    const client = new ReevitAPIClient({ publicKey: 'pfk_test_1', baseUrl: 'https://api.test' });

    await client.getPaymentIntent('pay_1');

    expect(headerOf(calls[0], 'X-Reevit-Key')).toBe('pfk_test_1');
    expect(headerOf(calls[0], 'X-Reevit-Client')).toBe('@reevit/core');
    expect(headerOf(calls[0], 'Content-Type')).toBe('application/json');
  });

  it('omits the key header when no public key is configured', async () => {
    const calls = mockFetch();
    const client = new ReevitAPIClient({ baseUrl: 'https://api.test' });

    await client.getPaymentIntent('pay_1');

    expect(headerOf(calls[0], 'X-Reevit-Key')).toBeUndefined();
  });

  it('maps a network failure to a recoverable network_error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Failed to fetch');
    }));
    const client = new ReevitAPIClient({ baseUrl: 'https://api.test' });

    const result = await client.getPaymentIntent('pay_1');

    expect(result.error).toMatchObject({ code: 'network_error', recoverable: true });
  });

  it('maps an abort to request_timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }));
    const client = new ReevitAPIClient({ baseUrl: 'https://api.test' });

    const result = await client.getPaymentIntent('pay_1');

    expect(result.error).toMatchObject({ code: 'request_timeout', recoverable: true });
  });
});

describe('getCheckoutSession', () => {
  it('returns the session on the happy path', async () => {
    const session = {
      id: 'cs_1',
      client_secret: 'cs_secret',
      session_secret: 'sess_abc',
      payment_intent: { id: 'pi_1', amount: 4500, currency: 'GHS' },
    };
    const calls = mockFetch(() => ({ status: 200, body: session }));
    const client = new ReevitAPIClient({ baseUrl: 'https://api.test' });

    const result = await client.getCheckoutSession('sess abc/1');

    expect(calls[0].url).toBe('https://api.test/v1/checkout/sessions/sess%20abc%2F1');
    expect(calls[0].init.method).toBe('GET');
    expect(result.data).toEqual(session);
    expect(result.error).toBeUndefined();
  });

  it('returns a PaymentError on 404', async () => {
    mockFetch(() => ({
      status: 404,
      body: { code: 'session_not_found', message: 'Checkout session not found' },
      headers: { 'x-request-id': 'req_404' },
    }));
    const client = new ReevitAPIClient({ baseUrl: 'https://api.test' });

    const result = await client.getCheckoutSession('sess_missing');

    expect(result.data).toBeUndefined();
    expect(result.error).toMatchObject({
      code: 'session_not_found',
      message: 'Checkout session not found',
      recoverable: false,
    });
    expect(result.error?.details).toMatchObject({ httpStatus: 404, requestId: 'req_404' });
  });
});

describe('createPaymentIntent idempotency', () => {
  function client() {
    return new ReevitAPIClient({ publicKey: 'pfk_test_1', baseUrl: 'https://api.test' });
  }

  it('rejects a config without amount and currency', async () => {
    const calls = mockFetch();
    const result = await client().createPaymentIntent({ email: 'ama@example.com' });

    expect(calls).toHaveLength(0);
    expect(result.error).toMatchObject({ code: 'invalid_checkout_config', recoverable: false });
  });

  it('sends a UUID, never the djb2 hash', async () => {
    const calls = mockFetch();

    await client().createPaymentIntent(BASE_CONFIG);

    const key = headerOf(calls[0], 'Idempotency-Key');
    expect(key).toMatch(UUID_RE);
    expect(key).not.toMatch(DJB2_RE);
    expect(key).not.toContain('reevit_');
  });

  it('sends the SAME key for a repeated click with identical params in one tab', async () => {
    const calls = mockFetch();
    const api = client();

    await api.createPaymentIntent(BASE_CONFIG);
    await api.createPaymentIntent({ ...BASE_CONFIG });

    expect(headerOf(calls[0], 'Idempotency-Key')).toBe(headerOf(calls[1], 'Idempotency-Key'));
  });

  it('sends a DIFFERENT key once the per-tab store is cleared', async () => {
    const calls = mockFetch();
    const api = client();

    await api.createPaymentIntent(BASE_CONFIG);
    clearIdempotencyAttemptKeys();
    await api.createPaymentIntent({ ...BASE_CONFIG });

    expect(headerOf(calls[0], 'Idempotency-Key')).not.toBe(headerOf(calls[1], 'Idempotency-Key'));
  });

  it('never shares a key between two different shoppers', async () => {
    const calls = mockFetch();
    const api = client();

    await api.createPaymentIntent({ ...BASE_CONFIG, email: 'ama@example.com' });
    await api.createPaymentIntent({ ...BASE_CONFIG, email: 'kofi@example.com' });

    expect(headerOf(calls[0], 'Idempotency-Key')).not.toBe(headerOf(calls[1], 'Idempotency-Key'));
  });

  it('gives two shoppers with colliding djb2 lookup keys different wire keys', async () => {
    // Force the pathological case the djb2 hash makes possible: identical
    // lookup keys for unrelated shoppers must still get distinct wire keys.
    const calls = mockFetch();
    const api = client();

    await api.createPaymentIntent(BASE_CONFIG);
    const shopperOne = headerOf(calls[0], 'Idempotency-Key');

    // A second browser/tab starts with an empty store.
    sessionStorage.clear();
    clearIdempotencyAttemptKeys();

    await api.createPaymentIntent(BASE_CONFIG);
    expect(headerOf(calls[1], 'Idempotency-Key')).not.toBe(shopperOne);
  });

  it('sends a merchant-supplied idempotencyKey verbatim', async () => {
    const calls = mockFetch();

    await client().createPaymentIntent({ ...BASE_CONFIG, idempotencyKey: 'order_12345' });

    expect(headerOf(calls[0], 'Idempotency-Key')).toBe('order_12345');
  });

  it('puts the customer contact into metadata and posts to the intents endpoint', async () => {
    const calls = mockFetch();

    await client().createPaymentIntent(
      { ...BASE_CONFIG, phone: '0244123456' },
      'mobile_money',
      'GH',
      { preferredProviders: ['paystack'] }
    );

    expect(calls[0].url).toBe('https://api.test/v1/payments/intents');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({
      amount: 4500,
      currency: 'GHS',
      country: 'GH',
      customer_id: 'ama@example.com',
      method: 'mobile_money',
      metadata: { customer_email: 'ama@example.com', customer_phone: '0244123456' },
      policy: { prefer: ['paystack'] },
    });
  });
});
