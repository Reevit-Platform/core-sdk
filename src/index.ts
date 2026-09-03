/**
 * @reevit/core
 * Shared utilities and API client for Reevit payment SDKs
 */

// API Client
export {
  ReevitAPIClient,
  createReevitClient,
  createPaymentError,
  generateIdempotencyKey,
  newIdempotencyKey,
  attemptIdempotencyKey,
  clearIdempotencyAttemptKeys,
  isPaymentError,
  type ReevitAPIClientConfig,
  type CreatePaymentIntentRequest,
  type PaymentIntentResponse,
  type CheckoutSessionResponse,
  type PaymentDetailResponse,
  type ConfirmPaymentRequest,
  type APIErrorResponse,
  type ReevitAPIResult,
} from './api/client';

// Types
export type {
  PaymentMethod,
  MobileMoneyNetwork,
  ReevitCheckoutConfig,
  ReevitCheckoutCallbacks,
  CheckoutState,
  PaymentResult,
  PaymentError,
  ReevitTheme,
  CheckoutProviderOption,
  MobileMoneyFormData,
  CardFormData,
  PaymentIntent,
  PSPConfig,
  PSPType,
  PaymentSource,
  HubtelSessionResponse,
} from './types';

// Utilities
export {
  formatAmount,
  currencyExponent,
  toMinorUnits,
  generateReference,
  validatePhone,
  formatPhone,
  detectNetwork,
  detectCountryFromCurrency,
  createThemeVariables,
  cn,
} from './utils';

// Intent identity + cache helpers
export {
  resolveIntentIdentity,
  getIntentCacheEntry,
  cacheIntentPromise,
  cacheIntentResponse,
  clearIntentCacheEntry,
  type IntentCacheEntry,
} from './intent';

// State machine helpers
export {
  createInitialState,
  reevitReducer,
  type ReevitState,
  type ReevitAction,
} from './state';
