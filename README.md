# @reevit/core

The foundation for all Reevit payment SDKs. It provides the shared API client, state machine logic, type definitions, and utility functions used by the React, Vue, and Svelte SDKs.

## Installation

```bash
npm install @reevit/core
```

## Compatibility

`@reevit/core` is a regular `dependencies` entry of each framework SDK, so it is
installed for you. Install it directly only when you are building against the
low-level API.

| `@reevit/core` | Required by |
|---|---|
| 0.9.x | `@reevit/react` 0.9.x–0.10.x, `@reevit/vue` 0.9.x–0.10.x, `@reevit/svelte` 0.9.x–0.10.x |

On a `0.x` package a caret range pins the **minor**, not the major:
`^0.9.0` resolves to `>=0.9.0 <0.10.0`. A future `@reevit/core` 0.10.0 is
therefore not picked up automatically — the React, Vue and Svelte manifests
have to be bumped together in the same release.

## Features

- **ReevitAPIClient**: A lightweight, promise-based client for interacting with the Reevit backend.
- **State Machine**: Framework-agnostic logic for managing checkout flows.
- **Utilities**: Amount formatting, phone validation, network detection, and more.
- **Types**: Comprehensive TypeScript definitions for the entire Reevit ecosystem (Card, Mobile Money, Bank Transfer, Apple Pay, Google Pay).
- **Styles**: Shared CSS for the "Unified Payment Widget" appearance.

## Usage (Low-level API)

If you're building a custom integration or another framework SDK, you can use the core components directly.

### Interacting with the API

```typescript
import { ReevitAPIClient } from '@reevit/core';

const client = new ReevitAPIClient({
  publicKey: 'pfk_test_xxx',
});

// Create a payment intent
const { data, error } = await client.createPaymentIntent({
  amount: 5000,
  currency: 'GHS',
  email: 'customer@example.com',
  idempotencyKey: 'order_12345',
}, 'card');

if (data) {
  console.log('Intent created:', data.id);
}
```

### Loading a checkout session

Browser SDKs should prefer server-created checkout sessions. Use the session secret returned by your backend to load the payment intent without exposing private API credentials.

```typescript
const { data, error } = await client.getCheckoutSession('cs_session_secret');

if (data) {
  console.log('Ready to render:', data.payment_intent.id);
}
```

### Error handling

Core returns a consistent `{ data, error }` result. Errors include `code`, `message`, `recoverable`, and `details.httpStatus` when the API returns a status code.

```typescript
const result = await client.getCheckoutSession('cs_session_secret');

if (result.error) {
  if (result.error.recoverable) {
    // show retry UI
  }
  console.error(result.error.code, result.error.message);
}
```

### Using Utilities

```typescript
import { formatAmount, validatePhone, detectNetwork } from '@reevit/core';

console.log(formatAmount(10000, 'GHS')); // "GH₵ 100.00"
console.log(validatePhone('0241234567')); // true
console.log(detectNetwork('0241234567')); // "mtn"
```

### Intent Identity & Idempotency

Core exports helpers to stabilize intent creation and dedupe in-flight requests.

```typescript
import { resolveIntentIdentity } from '@reevit/core';

const { idempotencyKey, reference } = resolveIntentIdentity({
  config: {
    amount: 5000,
    currency: 'GHS',
    email: 'customer@example.com',
    idempotencyKey: 'order_12345',
  },
  method: 'card',
});
```

## Release Notes

### v0.9.0

- Version alignment across all Reevit SDKs
- Updated shared CSS with redesigned checkout visual system

## License

MIT © Reevit
