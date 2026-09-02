# Changelog

All notable changes to `@reevit/core` will be documented in this file.

## [0.9.1] - 2026-09-02

### Fixed

- **The `Idempotency-Key` sent to the API is now a per-checkout-attempt UUID.**
  It used to be a 32-bit djb2 hash of the payment parameters plus a 5-minute
  time bucket, which meant a shopper legitimately buying the same item twice
  inside five minutes was charged once and shown the first intent, and two
  unrelated shoppers whose parameters collided (roughly even odds around 77k
  keys in a bucket) could be handed each other's `client_secret`. The UUID is
  minted once per attempt and kept in `sessionStorage` (a module-level map when
  storage is unavailable), so repeated "Continue" clicks in one tab still
  dedupe on the backend.
- `request()` no longer falls back to hashing the request body for POST/PATCH/PUT
  without an explicit key; it mints a UUID instead.
- **Zero-decimal currencies are no longer divided by 100.** `formatAmount` now
  derives the exponent from the currency, so `formatAmount(5000, 'XOF')` renders
  `5,000` rather than `XOF 50.00`. This affects XOF and XAF across the 14
  West/Central African markets the SDK targets, plus RWF, UGX, JPY, KRW and the
  other zero-decimal codes. `formatAmount(4500, 'GHS')` is unchanged.

### Added

- `newIdempotencyKey()` — mints the UUID actually sent on the wire.
- `attemptIdempotencyKey(lookupKey)` — resolves the stable per-tab wire key for
  a deterministic lookup key.
- `clearIdempotencyAttemptKeys()` — forgets the stored per-attempt keys so the
  next checkout starts a fresh one.
- `currencyExponent(currency)` and `toMinorUnits(major, currency)`.
- `resolveIntentIdentity()` now also returns `lookupKey`, and the cache entry
  records the `idempotencyKey` it minted. The cache helpers accept either key,
  so existing callers need no change.
- A test suite (vitest, 101 tests) covering the API client, the idempotency
  keys, `formatAmount`, the reducer and the in-flight intent cache. CI runs it.

### Changed

- `generateIdempotencyKey()` is still exported and still deterministic, but it
  is documented as a **cache/lookup key only** — never send it on the wire.
- `X-Reevit-Client-Version` now reports `0.9.1`.

## [0.9.0] - 2026-05-15

### Added

- `ReevitAPIClient.getCheckoutSession()` for loading server-created checkout
  sessions from a session secret.
- Checkout-session types and the intent helpers are exported from the package
  root.

### Changed

- `X-Reevit-Client-Version` now reports `0.9.0`.

## [0.8.1] - 2026-03-13

### Changed

- Removed the separate sandbox base URL; all requests go to
  `https://api.reevit.io` unless `baseUrl` is set explicitly.
- `isSandboxKey()` recognises only the `pfk_test_` prefix.

## [0.8.0] - 2026-03-03

### Added

- `provider_ref_id` on the payment intent response types.

## [0.7.0] - 2026-02-07

Internal changes — version alignment across the Reevit SDKs. No source changes
in this repository.

## [0.6.0] - 2026-02-04

### 🛠 Improvements

- Added `idempotencyKey` support to `ReevitCheckoutConfig` and `ReevitAPIClient.createPaymentIntent`.
- Added intent identity + cache helpers to stabilize idempotency and dedupe in-flight requests.

## [0.5.9] - 2026-01-21

Internal changes — no source changes in this repository.

## [0.5.1] - 2026-01-17

Internal changes — no source changes in this repository.

## [0.5.0] - 2026-01-11

### 🚀 New Features

#### Added: Apple Pay & Google Pay Support
Updated `PaymentMethod` types to include `apple_pay` and `google_pay` as first-class payment methods.

#### Added: Enhanced Asset Resolution
Added utilities for resolving asset sources from both CDN URLs and local bundled assets.

### 📦 Install / Upgrade

```bash
npm install @reevit/core@0.5.0
```

---

## [0.3.2] - 2025-12-29

### 🐛 Bug Fixes

#### Fixed: Payment Method Selector Bypass
Updated the `reevitReducer` to properly handle payment method selection when an `initialPaymentIntent` is provided:
- If multiple payment methods are available, `selectedMethod` is set to `null` to force manual selection
- If only one payment method is available, it is auto-selected for convenience
- This prevents the bypass issue where the selector was skipped entirely

### 🚀 New Features

#### Added: Reference Field Support
The `PaymentIntent` interface now includes:
- `reference?: string` - Unique payment reference for tracking
- `pspPublicKey?: string` - PSP-specific public key for direct integration

#### Added: Initial Payment Intent Support
The `ReevitCheckoutConfig` interface now includes:
- `initialPaymentIntent?: PaymentIntent` - Pass a pre-created payment intent for controlled mode

#### Added: Public Payment Confirmation
The `ReevitAPIClient` now supports confirming payments via a public endpoint:
```typescript
await client.confirmPaymentIntent({
  clientSecret: 'client-secret',
  paymentData: { /* payment data */ }
});
```

### 📦 Install / Upgrade

```bash
npm install @reevit/core@0.3.2
# or
yarn add @reevit/core@0.3.2
# or
pnpm add @reevit/core@0.3.2
```

### ⚠️ Breaking Changes

None. This is a backwards-compatible release.

### Full Changelog

- `b5eca56` - fix: Update reevitReducer to handle method selection properly
- `38ae223` - feat: Add reference and pspPublicKey to PaymentIntent
- `a1b2c3d` - feat: Add initialPaymentIntent to ReevitCheckoutConfig
- `d4e5f6g` - feat: Add confirmPaymentIntent method to ReevitAPIClient
- `h7i8j9k` - chore: Bump version to 0.3.2

## [0.1.0] - 2024-12-25

### Added
- Initial release
- `ReevitAPIClient` for backend communication
- Shared TypeScript types (`PaymentMethod`, `PaymentIntent`, `PaymentResult`, etc.)
- Utility functions:
  - `formatAmount()` - Format currency amounts
  - `validatePhone()` - Phone number validation
  - `detectNetwork()` - Mobile network detection (Ghana)
  - `formatPhone()` - Phone number formatting
  - `detectCountryFromCurrency()` - Country detection from currency code
  - `cn()` - Classname utility
  - `createThemeVariables()` - CSS variable generation for theming
- State machine types for checkout flow
- PSP types: `paystack`, `hubtel`, `flutterwave`, `stripe`, `monnify`, `mpesa`
