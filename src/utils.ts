/**
 * Utility Functions
 * Shared utilities for Reevit SDKs
 */

import type { MobileMoneyNetwork, ReevitTheme } from './types';

const CURRENCY_LOCALES: Record<string, string> = {
  GHS: 'en-GH',
  NGN: 'en-NG',
  KES: 'en-KE',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

/**
 * Currencies with no minor unit — the API's integer amount *is* the amount.
 * Used only when `Intl` cannot tell us (old or trimmed ICU builds).
 * Keep in sync with the reevit CLI's copy of this table.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'XOF', 'XAF', 'RWF', 'UGX', 'JPY', 'KRW', 'BIF', 'GNF',
  'VND', 'CLP', 'ISK', 'KMF', 'DJF', 'PYG', 'MGA',
]);

/**
 * Returns how many decimal places a currency's minor unit uses: 2 for GHS and
 * NGN, 0 for XOF, XAF, RWF, UGX, JPY and friends.
 *
 * Dividing every amount by 100 renders a 5,000 XOF charge as "XOF 50.00" while
 * the shopper is actually charged 5,000 — which is why this exists.
 */
export function currencyExponent(currency: string): number {
  const code = (currency || '').toUpperCase();

  try {
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
    }).resolvedOptions().maximumFractionDigits;

    if (typeof digits === 'number' && Number.isFinite(digits)) {
      return digits;
    }
  } catch {
    // Unsupported currency code, or an ICU build without currency data.
  }

  return ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
}

/**
 * Converts a major-unit amount (what a shopper types) into the minor units the
 * API expects: `toMinorUnits(45, 'GHS') === 4500`, `toMinorUnits(5000, 'XOF') === 5000`.
 */
export function toMinorUnits(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

/**
 * Formats an amount from smallest currency unit to display format
 */
export function formatAmount(amount: number, currency: string): string {
  const code = (currency || '').toUpperCase();
  const exponent = currencyExponent(code);
  const majorUnit = amount / 10 ** exponent;
  const locale = CURRENCY_LOCALES[code] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(majorUnit);
  } catch {
    // Fallback for unsupported currencies
    return `${code} ${majorUnit.toFixed(exponent)}`;
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
  const telecelPrefixes = ['20', '50'];
  const airteltigoPrefixes = ['26', '27', '56', '57'];

  if (mtnPrefixes.includes(prefix)) return 'mtn';
  if (telecelPrefixes.includes(prefix)) return 'telecel';
  if (airteltigoPrefixes.includes(prefix)) return 'airteltigo';

  return null;
}

/**
 * Creates CSS custom property variables from theme
 */
export function createThemeVariables(theme: ReevitTheme): Record<string, string> {
  const variables: Record<string, string> = {};

  // Primary color = main text color
  if (theme.primaryColor) {
    variables['--reevit-text'] = theme.primaryColor;
  }

  // Primary foreground = description/secondary text color
  if (theme.primaryForegroundColor) {
    variables['--reevit-text-secondary'] = theme.primaryForegroundColor;
    variables['--reevit-muted'] = theme.primaryForegroundColor;
  }

  // Button colors
  if (theme.buttonBackgroundColor) {
    variables['--reevit-primary'] = theme.buttonBackgroundColor;
    variables['--reevit-primary-hover'] = theme.buttonBackgroundColor;
  }
  if (theme.buttonTextColor) {
    variables['--reevit-primary-foreground'] = theme.buttonTextColor;
  }

  // Background and surface colors
  if (theme.backgroundColor) {
    variables['--reevit-background'] = theme.backgroundColor;
    variables['--reevit-surface'] = theme.backgroundColor;
  }
  if (theme.surfaceColor) {
    variables['--reevit-surface'] = theme.surfaceColor;
  }

  // Border color
  if (theme.borderColor) {
    variables['--reevit-border'] = theme.borderColor;
  }

  // Legacy text color support
  if (theme.textColor) {
    variables['--reevit-text'] = theme.textColor;
  }
  if (theme.mutedTextColor) {
    variables['--reevit-text-secondary'] = theme.mutedTextColor;
  }

  // Border radius
  if (theme.borderRadius) {
    variables['--reevit-radius'] = theme.borderRadius;
    variables['--reevit-radius-sm'] = theme.borderRadius;
    variables['--reevit-radius-lg'] = theme.borderRadius;
  }

  // Font family
  if (theme.fontFamily) {
    variables['--reevit-font'] = theme.fontFamily;
  }

  return variables;
}

function getContrastingColor(color: string): string | null {
  const hex = color.trim();
  if (!hex.startsWith('#')) {
    return null;
  }

  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  if (normalized.length !== 7) {
    return null;
  }

  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 140 ? '#0b1120' : '#ffffff';
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
