import { describe, expect, it } from 'vitest';

import type { PaymentError, PaymentIntent, PaymentResult } from './types';
import { createInitialState, reevitReducer, type ReevitAction, type ReevitState } from './state';

const INTENT: PaymentIntent = {
  id: 'pi_1',
  clientSecret: 'cs_1',
  amount: 4500,
  currency: 'GHS',
  status: 'pending',
  recommendedPsp: 'paystack',
  availableMethods: [],
};

const ERROR: PaymentError = { code: 'card_declined', message: 'declined', recoverable: false };
const RESULT: PaymentResult = {
  paymentId: 'pi_1',
  reference: 'reevit_abc',
  amount: 4500,
  currency: 'GHS',
  paymentMethod: 'card',
  psp: 'paystack',
  pspReference: 'ps_1',
  status: 'success',
};

function ready(): ReevitState {
  return reevitReducer(createInitialState(), { type: 'INIT_SUCCESS', payload: INTENT });
}

describe('createInitialState', () => {
  it('starts idle and empty', () => {
    expect(createInitialState()).toEqual({
      status: 'idle',
      paymentIntent: null,
      selectedMethod: null,
      error: null,
      result: null,
    });
  });

  it('returns a fresh object each call', () => {
    expect(createInitialState()).not.toBe(createInitialState());
  });
});

describe('reevitReducer', () => {
  it('INIT_START moves to loading and clears a previous error', () => {
    const errored = reevitReducer(createInitialState(), { type: 'INIT_ERROR', payload: ERROR });
    const next = reevitReducer(errored, { type: 'INIT_START' });

    expect(next.status).toBe('loading');
    expect(next.error).toBeNull();
  });

  it('INIT_SUCCESS stores the intent and leaves the method unselected', () => {
    const next = reevitReducer(createInitialState(), { type: 'INIT_SUCCESS', payload: INTENT });

    expect(next.status).toBe('ready');
    expect(next.paymentIntent).toBe(INTENT);
    expect(next.selectedMethod).toBeNull();
  });

  it('INIT_SUCCESS auto-selects the only available method', () => {
    const intent: PaymentIntent = { ...INTENT, availableMethods: ['mobile_money'] };
    const next = reevitReducer(createInitialState(), { type: 'INIT_SUCCESS', payload: intent });

    expect(next.selectedMethod).toBe('mobile_money');
  });

  it('INIT_SUCCESS does not auto-select when several methods are available', () => {
    const intent: PaymentIntent = { ...INTENT, availableMethods: ['card', 'mobile_money'] };
    const next = reevitReducer(createInitialState(), { type: 'INIT_SUCCESS', payload: intent });

    expect(next.selectedMethod).toBeNull();
  });

  it('INIT_ERROR fails with the error', () => {
    const next = reevitReducer(createInitialState(), { type: 'INIT_ERROR', payload: ERROR });

    expect(next).toMatchObject({ status: 'failed', error: ERROR });
  });

  it('SELECT_METHOD records the method', () => {
    const next = reevitReducer(ready(), { type: 'SELECT_METHOD', payload: 'card' });

    expect(next).toMatchObject({ status: 'method_selected', selectedMethod: 'card' });
  });

  it('PROCESS_START clears the previous error', () => {
    const failed = reevitReducer(ready(), { type: 'PROCESS_ERROR', payload: ERROR });
    const next = reevitReducer(failed, { type: 'PROCESS_START' });

    expect(next).toMatchObject({ status: 'processing', error: null });
  });

  it('PROCESS_SUCCESS stores the result', () => {
    const next = reevitReducer(ready(), { type: 'PROCESS_SUCCESS', payload: RESULT });

    expect(next).toMatchObject({ status: 'success', result: RESULT });
  });

  it('PROCESS_ERROR fails with the error', () => {
    const next = reevitReducer(ready(), { type: 'PROCESS_ERROR', payload: ERROR });

    expect(next).toMatchObject({ status: 'failed', error: ERROR });
  });

  it('RESET returns to ready but keeps the payment intent', () => {
    const failed = reevitReducer(
      reevitReducer(ready(), { type: 'SELECT_METHOD', payload: 'card' }),
      { type: 'PROCESS_ERROR', payload: ERROR }
    );
    const next = reevitReducer(failed, { type: 'RESET' });

    expect(next).toEqual({
      status: 'ready',
      paymentIntent: INTENT,
      selectedMethod: null,
      error: null,
      result: null,
    });
  });

  it('CLOSE only changes the status', () => {
    const state = reevitReducer(ready(), { type: 'SELECT_METHOD', payload: 'card' });
    const next = reevitReducer(state, { type: 'CLOSE' });

    expect(next).toEqual({ ...state, status: 'closed' });
  });

  it('returns the same state for an unknown action', () => {
    const state = ready();

    expect(reevitReducer(state, { type: 'NOPE' } as unknown as ReevitAction)).toBe(state);
  });

  it('never mutates the state it is given', () => {
    const state = createInitialState();
    const snapshot = { ...state };

    reevitReducer(state, { type: 'INIT_SUCCESS', payload: INTENT });

    expect(state).toEqual(snapshot);
  });
});
