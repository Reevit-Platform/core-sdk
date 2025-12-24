/**
 * Utility Functions
 * Shared utilities for Reevit SDKs
 */

import type { MobileMoneyNetwork, ReevitTheme } from './types';

/**
 * Formats an amount from smallest currency unit to display format
 */
export function formatAmount(amount: number, currency: string): string {
  const majorUnit = amount / 100;

  const currencyFormats: Record<string, { locale: string; minimumFractionDigits: number }> = {
    GHS: { locale: 'en-GH', minimumFractionDigits: 2 },
    NGN: { locale: 'en-NG', minimumFractionDigits: 2 },
    KES: { locale: 'en-KE', minimumFractionDigits: 2 },
    USD: { locale: 'en-US', minimumFractionDigits: 2 },
    EUR: { locale: 'de-DE', minimumFractionDigits: 2 },
    GBP: { locale: 'en-GB', minimumFractionDigits: 2 },
  };

  const format = currencyFormats[currency.toUpperCase()] || { locale: 'en-US', minimumFractionDigits: 2 };

  try {
    return new Intl.NumberFormat(format.locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: format.minimumFractionDigits,
    }).format(majorUnit);
  } catch {
    // Fallback for unsupported currencies
    return `${currency} ${majorUnit.toFixed(2)}`;
  }
}

/**
 * Generates a unique payment reference
 */
export function generateReference(prefix: string = 'reevit'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Validates a phone number for mobile money
 */
export function validatePhone(phone: string, country: string = 'GH'): boolean {
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, '');

  const patterns: Record<string, RegExp> = {
    GH: /^(?:233|0)?[235][0-9]{8}$/, // Ghana
    NG: /^(?:234|0)?[789][01][0-9]{8}$/, // Nigeria
    KE: /^(?:254|0)?[17][0-9]{8}$/, // Kenya
  };

  const pattern = patterns[country.toUpperCase()];
  if (!pattern) return digits.length >= 10;

  return pattern.test(digits);
}

/**
 * Formats a phone number for display
 */
export function formatPhone(phone: string, country: string = 'GH'): string {
  const digits = phone.replace(/\D/g, '');

  if (country === 'GH') {
    // Format as 0XX XXX XXXX
    if (digits.startsWith('233') && digits.length === 12) {
      const local = '0' + digits.slice(3);
      return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
    if (digits.length === 10 && digits.startsWith('0')) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
  }

  return phone;
}

/**
 * Detects mobile money network from phone number (Ghana)
 */
export function detectNetwork(phone: string): MobileMoneyNetwork | null {
  const digits = phone.replace(/\D/g, '');

  // Get the network prefix (first 3 digits after country code or 0)
  let prefix: string;
  if (digits.startsWith('233')) {
    prefix = digits.slice(3, 5);
  } else if (digits.startsWith('0')) {
    prefix = digits.slice(1, 3);
  } else {
    prefix = digits.slice(0, 2);
  }

  // Ghana network prefixes
  const mtnPrefixes = ['24', '25', '53', '54', '55', '59'];
  const vodafonePrefixes = ['20', '50'];
  const airteltigoPrefixes = ['26', '27', '56', '57'];

  if (mtnPrefixes.includes(prefix)) return 'mtn';
  if (vodafonePrefixes.includes(prefix)) return 'vodafone';
  if (airteltigoPrefixes.includes(prefix)) return 'airteltigo';

  return null;
}

/**
 * Creates CSS custom property variables from theme
 */
export function createThemeVariables(theme: ReevitTheme): Record<string, string> {
  const variables: Record<string, string> = {};

  if (theme.primaryColor) {
    variables['--reevit-primary'] = theme.primaryColor;
  }
  if (theme.backgroundColor) {
    variables['--reevit-bg'] = theme.backgroundColor;
  }
  if (theme.textColor) {
    variables['--reevit-text'] = theme.textColor;
  }
  if (theme.borderRadius) {
    variables['--reevit-radius'] = theme.borderRadius;
  }
  if (theme.fontFamily) {
    variables['--reevit-font'] = theme.fontFamily;
  }

  return variables;
}

/**
 * Simple class name concatenation utility
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Detects country code from currency
 */
export function detectCountryFromCurrency(currency: string): string {
  const currencyToCountry: Record<string, string> = {
    GHS: 'GH',
    NGN: 'NG',
    KES: 'KE',
    UGX: 'UG',
    TZS: 'TZ',
    ZAR: 'ZA',
    XOF: 'CI',
    XAF: 'CM',
    USD: 'US',
    EUR: 'DE',
    GBP: 'GB',
  };

  return currencyToCountry[currency.toUpperCase()] || 'GH';
}
