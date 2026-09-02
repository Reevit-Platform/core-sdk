import { describe, expect, it } from 'vitest';

import {
  currencyExponent,
  detectNetwork,
  detectCountryFromCurrency,
  formatAmount,
  formatPhone,
  generateReference,
  toMinorUnits,
  validatePhone,
  cn,
} from './utils';

describe('currencyExponent', () => {
  it('is 2 for the two-decimal currencies the SDK ships with', () => {
    expect(currencyExponent('GHS')).toBe(2);
    expect(currencyExponent('NGN')).toBe(2);
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('KES')).toBe(2);
  });

  it('is 0 for the zero-decimal currencies', () => {
    for (const code of ['XOF', 'XAF', 'RWF', 'UGX', 'JPY', 'KRW', 'GNF', 'BIF', 'DJF', 'KMF']) {
      expect(currencyExponent(code)).toBe(0);
    }
  });

  it('is case-insensitive and defaults to 2 for unknown codes', () => {
    expect(currencyExponent('xof')).toBe(0);
    expect(currencyExponent('ZZZ')).toBe(2);
    expect(currencyExponent('')).toBe(2);
  });
});

describe('toMinorUnits', () => {
  it('scales by the currency exponent', () => {
    expect(toMinorUnits(45, 'GHS')).toBe(4500);
    expect(toMinorUnits(5000, 'XOF')).toBe(5000);
    expect(toMinorUnits(123456, 'JPY')).toBe(123456);
  });

  it('rounds away float dust', () => {
    expect(toMinorUnits(19.99, 'USD')).toBe(1999);
    expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30);
  });

  it('round-trips through formatAmount', () => {
    expect(formatAmount(toMinorUnits(45, 'GHS'), 'GHS')).toMatch(/45\.00/);
    expect(formatAmount(toMinorUnits(5000, 'XOF'), 'XOF')).toMatch(/5,000/);
  });
});

describe('formatAmount', () => {
  it('divides two-decimal currencies by 100', () => {
    expect(formatAmount(4500, 'GHS')).toMatch(/45\.00/);
    expect(formatAmount(4500, 'GHS')).toMatch(/GH₵/);
    expect(formatAmount(250000, 'NGN')).toMatch(/2,500\.00/);
    expect(formatAmount(1999, 'USD')).toBe('$19.99');
  });

  it('does not divide zero-decimal currencies', () => {
    const xof = formatAmount(5000, 'XOF');
    expect(xof).toMatch(/5,000/);
    expect(xof).not.toMatch(/50\.00/);
    expect(xof).not.toMatch(/\.\d/);

    expect(formatAmount(123456, 'JPY')).toMatch(/123,456/);
    expect(formatAmount(123456, 'JPY')).not.toMatch(/\.\d/);

    expect(formatAmount(7500, 'XAF')).not.toMatch(/\.\d/);
    expect(formatAmount(7500, 'RWF')).not.toMatch(/\.\d/);
  });

  it('is case-insensitive on the currency code', () => {
    expect(formatAmount(4500, 'ghs')).toBe(formatAmount(4500, 'GHS'));
    expect(formatAmount(5000, 'xof')).toBe(formatAmount(5000, 'XOF'));
  });

  it('falls back to a plain string for an unformattable code', () => {
    // A malformed code makes Intl throw; the fallback keeps the exponent.
    expect(formatAmount(4500, 'NOT_A_CURRENCY')).toBe('NOT_A_CURRENCY 45.00');
  });
});

describe('generateReference', () => {
  it('uses the reevit prefix by default', () => {
    expect(generateReference()).toMatch(/^reevit_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('honours a custom prefix and is unique per call', () => {
    expect(generateReference('order')).toMatch(/^order_/);
    expect(generateReference()).not.toBe(generateReference());
  });
});

describe('phone helpers', () => {
  it('validates Ghanaian, Nigerian and Kenyan numbers', () => {
    expect(validatePhone('0244123456', 'GH')).toBe(true);
    expect(validatePhone('233244123456', 'GH')).toBe(true);
    expect(validatePhone('012345', 'GH')).toBe(false);
    expect(validatePhone('08012345678', 'NG')).toBe(true);
    expect(validatePhone('0712345678', 'KE')).toBe(true);
  });

  it('falls back to a length check for unknown countries', () => {
    expect(validatePhone('1234567890', 'ZZ')).toBe(true);
    expect(validatePhone('12345', 'ZZ')).toBe(false);
  });

  it('formats Ghanaian numbers for display', () => {
    expect(formatPhone('0244123456', 'GH')).toBe('024 412 3456');
    expect(formatPhone('233244123456', 'GH')).toBe('024 412 3456');
    expect(formatPhone('+15551234567', 'US')).toBe('+15551234567');
  });

  it('detects the Ghanaian mobile money network', () => {
    expect(detectNetwork('0244123456')).toBe('mtn');
    expect(detectNetwork('233541234567')).toBe('mtn');
    expect(detectNetwork('0201234567')).toBe('telecel');
    expect(detectNetwork('0271234567')).toBe('airteltigo');
    expect(detectNetwork('0301234567')).toBeNull();
  });
});

describe('misc helpers', () => {
  it('maps currency to country with a GH default', () => {
    expect(detectCountryFromCurrency('GHS')).toBe('GH');
    expect(detectCountryFromCurrency('xof')).toBe('CI');
    expect(detectCountryFromCurrency('ZZZ')).toBe('GH');
  });

  it('joins truthy class names', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});
