/**
 * Reevit State Machine
 * Shared state management logic for all SDKs
 */

import type { CheckoutState, PaymentIntent, PaymentMethod, PaymentResult, PaymentError } from './types';

// State shape
export interface ReevitState {
  status: CheckoutState;
  paymentIntent: PaymentIntent | null;
  selectedMethod: PaymentMethod | null;
  error: PaymentError | null;
  result: PaymentResult | null;
}

// Actions
export type ReevitAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: PaymentIntent }
  | { type: 'INIT_ERROR'; payload: PaymentError }
  | { type: 'SELECT_METHOD'; payload: PaymentMethod }
  | { type: 'PROCESS_START' }
  | { type: 'PROCESS_SUCCESS'; payload: PaymentResult }
  | { type: 'PROCESS_ERROR'; payload: PaymentError }
  | { type: 'RESET' }
  | { type: 'CLOSE' };

/**
 * Creates the initial state for the checkout
 */
export function createInitialState(): ReevitState {
  return {
    status: 'idle',
    paymentIntent: null,
    selectedMethod: null,
    error: null,
    result: null,
  };
}

/**
 * State reducer for checkout flow
 */
export function reevitReducer(state: ReevitState, action: ReevitAction): ReevitState {
  switch (action.type) {
    case 'INIT_START':
      return { ...state, status: 'loading', error: null };
    case 'INIT_SUCCESS':
      return { ...state, status: 'ready', paymentIntent: action.payload };
    case 'INIT_ERROR':
      return { ...state, status: 'failed', error: action.payload };
    case 'SELECT_METHOD':
      return { ...state, status: 'method_selected', selectedMethod: action.payload };
    case 'PROCESS_START':
      return { ...state, status: 'processing', error: null };
    case 'PROCESS_SUCCESS':
      return { ...state, status: 'success', result: action.payload };
    case 'PROCESS_ERROR':
      return { ...state, status: 'failed', error: action.payload };
    case 'RESET':
      return { ...createInitialState(), status: 'ready', paymentIntent: state.paymentIntent };
    case 'CLOSE':
      return { ...state, status: 'closed' };
    default:
      return state;
  }
}
