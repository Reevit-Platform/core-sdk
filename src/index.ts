/**
 * @reevit/core
 * Shared utilities and API client for Reevit payment SDKs
 */

// API Client
export {
  ReevitAPIClient,
  createReevitClient,
  type ReevitAPIClientConfig,
  type CreatePaymentIntentRequest,
  type PaymentIntentResponse,
  type PaymentDetailResponse,
  type ConfirmPaymentRequest,
  type APIErrorResponse,
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
  MobileMoneyFormData,
  CardFormData,
  PaymentIntent,
  PSPConfig,
  PSPType,
} from './types';

// Utilities
export {
  formatAmount,
  generateReference,
  validatePhone,
  formatPhone,
  detectNetwork,
  detectCountryFromCurrency,
  createThemeVariables,
  cn,
} from './utils';

// State machine helpers
export {
  createInitialState,
  reevitReducer,
  type ReevitState,
  type ReevitAction,
} from './state';
