# @reevit/core

The foundation for all Reevit payment SDKs. It provides the shared API client, state machine logic, type definitions, and utility functions used by the React, Vue, and Svelte SDKs.

## Installation

```bash
npm install @reevit/core
```

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
  publicKey: 'pk_test_xxx',
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

### v0.7.0

- Version alignment across all Reevit SDKs
- Updated shared CSS with redesigned checkout visual system

## License

MIT © Reevit
