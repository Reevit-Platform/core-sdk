# Changelog

All notable changes to `@reevit/core` will be documented in this file.

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
