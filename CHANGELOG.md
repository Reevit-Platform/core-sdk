# Changelog

All notable changes to `@reevit/core` will be documented in this file.

## [0.1.0] - 2024-12-24

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
