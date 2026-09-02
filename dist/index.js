"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ReevitAPIClient: () => ReevitAPIClient,
  attemptIdempotencyKey: () => attemptIdempotencyKey,
  cacheIntentPromise: () => cacheIntentPromise,
  cacheIntentResponse: () => cacheIntentResponse,
  clearIdempotencyAttemptKeys: () => clearIdempotencyAttemptKeys,
  clearIntentCacheEntry: () => clearIntentCacheEntry,
  cn: () => cn,
  createInitialState: () => createInitialState,
  createPaymentError: () => createPaymentError,
  createReevitClient: () => createReevitClient,
  createThemeVariables: () => createThemeVariables,
  currencyExponent: () => currencyExponent,
  detectCountryFromCurrency: () => detectCountryFromCurrency,
  detectNetwork: () => detectNetwork,
  formatAmount: () => formatAmount,
  formatPhone: () => formatPhone,
  generateIdempotencyKey: () => generateIdempotencyKey,
  generateReference: () => generateReference,
  getIntentCacheEntry: () => getIntentCacheEntry,
  isPaymentError: () => isPaymentError,
  newIdempotencyKey: () => newIdempotencyKey,
  reevitReducer: () => reevitReducer,
  resolveIntentIdentity: () => resolveIntentIdentity,
  toMinorUnits: () => toMinorUnits,
  validatePhone: () => validatePhone
});
module.exports = __toCommonJS(index_exports);

// src/api/client.ts
var API_BASE_URL_PRODUCTION = "https://api.reevit.io";
var DEFAULT_TIMEOUT = 3e4;
var hasWarnedAboutLiveBrowserIntents = false;
function createPaymentError(response, errorData) {
  return {
    code: errorData.code || "api_error",
    message: errorData.message || "An unexpected error occurred",
    recoverable: isRecoverableStatus(response.status),
    details: {
      httpStatus: response.status,
      requestId: response.headers.get("x-request-id") || response.headers.get("x-reevit-request-id") || void 0,
      ...errorData.details
    }
  };
}
function isPaymentError(error) {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}
function isRecoverableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}
function generateIdempotencyKey(params) {
  const sortedKeys = Object.keys(params).sort();
  const stableString = sortedKeys.map((key) => `${key}:${JSON.stringify(params[key])}`).join("|");
  let hash = 5381;
  for (let i = 0; i < stableString.length; i++) {
    hash = (hash << 5) + hash + stableString.charCodeAt(i);
    hash = hash & hash;
  }
  const hashHex = (hash >>> 0).toString(16);
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1e3));
  return `reevit_${timeBucket}_${hashHex}`;
}
var IDEMPOTENCY_STORE_PREFIX = "reevit:idem:";
var memoryAttemptKeys = /* @__PURE__ */ new Map();
function getSessionStore() {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return null;
    }
    const probe = `${IDEMPOTENCY_STORE_PREFIX}probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
function newIdempotencyKey() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    try {
      return cryptoObj.randomUUID();
    } catch {
    }
  }
  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}
function attemptIdempotencyKey(lookupKey) {
  const storageKey = `${IDEMPOTENCY_STORE_PREFIX}${lookupKey}`;
  const store = getSessionStore();
  if (store) {
    try {
      const existing2 = store.getItem(storageKey);
      if (existing2) {
        return existing2;
      }
      const created2 = newIdempotencyKey();
      store.setItem(storageKey, created2);
      return created2;
    } catch {
    }
  }
  const existing = memoryAttemptKeys.get(storageKey);
  if (existing) {
    return existing;
  }
  const created = newIdempotencyKey();
  memoryAttemptKeys.set(storageKey, created);
  return created;
}
function clearIdempotencyAttemptKeys() {
  memoryAttemptKeys.clear();
  const store = getSessionStore();
  if (!store) {
    return;
  }
  try {
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(IDEMPOTENCY_STORE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      store.removeItem(key);
    }
  } catch {
  }
}
var ReevitAPIClient = class {
  constructor(config) {
    this.publicKey = config.publicKey || "";
    this.baseUrl = config.baseUrl || API_BASE_URL_PRODUCTION;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }
  /**
   * Makes an authenticated API request
   * @param idempotencyKey Optional deterministic idempotency key for the request
   */
  async request(method, path, body, idempotencyKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const headers = {
      "Content-Type": "application/json",
      "X-Reevit-Client": "@reevit/core",
      "X-Reevit-Client-Version": "0.9.1"
    };
    if (this.publicKey) {
      headers["X-Reevit-Key"] = this.publicKey;
    }
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      headers["Idempotency-Key"] = idempotencyKey || newIdempotencyKey();
    }
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          error: createPaymentError(response, responseData)
        };
      }
      return { data: responseData };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          return {
            error: {
              code: "request_timeout",
              message: "The request timed out. Please try again.",
              recoverable: true
            }
          };
        }
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          return {
            error: {
              code: "network_error",
              message: "Unable to connect to Reevit. Please check your internet connection.",
              recoverable: true
            }
          };
        }
      }
      return {
        error: {
          code: "unknown_error",
          message: "An unexpected error occurred. Please try again.",
          recoverable: true
        }
      };
    }
  }
  /**
   * Creates a payment intent
   */
  async createPaymentIntent(config, method, country = "GH", options) {
    if (this.publicKey.startsWith("pfk_live_") && !hasWarnedAboutLiveBrowserIntents && typeof console !== "undefined") {
      hasWarnedAboutLiveBrowserIntents = true;
      console.warn(
        "Creating live payment intents from the browser is deprecated. Create a checkout session on your server and pass sessionSecret to the browser SDK instead."
      );
    }
    if (typeof config.amount !== "number" || !config.currency) {
      return {
        error: {
          code: "invalid_checkout_config",
          message: "amount and currency are required when creating a payment intent in the browser.",
          recoverable: false
        }
      };
    }
    const metadata = { ...config.metadata };
    if (config.email) {
      metadata.customer_email = config.email;
    }
    if (config.phone) {
      metadata.customer_phone = config.phone;
    }
    const request = {
      amount: config.amount,
      currency: config.currency,
      country,
      customer_id: config.email || config.metadata?.customerId,
      metadata
    };
    if (method) {
      request.method = this.mapPaymentMethod(method);
    }
    if (options?.preferredProviders?.length || options?.allowedProviders?.length) {
      request.policy = {
        prefer: options?.preferredProviders,
        allowed_providers: options?.allowedProviders
      };
    }
    const idempotencyKey = config.idempotencyKey || attemptIdempotencyKey(generateIdempotencyKey({
      amount: config.amount,
      currency: config.currency,
      customer: config.email || config.metadata?.customerId || "",
      reference: config.reference || "",
      method: method || "",
      provider: options?.preferredProviders?.[0] || options?.allowedProviders?.[0] || "",
      publicKey: this.publicKey
    }));
    return this.request("POST", "/v1/payments/intents", request, idempotencyKey);
  }
  /**
   * Retrieves a payment intent by ID
   */
  async getPaymentIntent(paymentId) {
    return this.request("GET", `/v1/payments/${paymentId}`);
  }
  /**
   * Retrieves a server-created checkout session using its public session secret.
   */
  async getCheckoutSession(sessionSecret) {
    return this.request(
      "GET",
      `/v1/checkout/sessions/${encodeURIComponent(sessionSecret)}`
    );
  }
  /**
   * Confirms a payment after PSP callback
   */
  async confirmPayment(paymentId) {
    return this.request("POST", `/v1/payments/${paymentId}/confirm`);
  }
  /**
   * Confirms a payment intent using client secret (public endpoint)
   */
  async confirmPaymentIntent(paymentId, clientSecret) {
    return this.request(
      "POST",
      `/v1/payments/${paymentId}/confirm-intent?client_secret=${encodeURIComponent(clientSecret)}`
    );
  }
  /**
   * Cancels a payment intent
   */
  async cancelPaymentIntent(paymentId) {
    return this.request("POST", `/v1/payments/${paymentId}/cancel`);
  }
  /**
   * Creates a Hubtel session token for secure checkout
   * Returns a short-lived token that contains Hubtel credentials
   * Credentials are never exposed to the client directly
   */
  async createHubtelSession(paymentId, clientSecret) {
    const query = clientSecret ? `?client_secret=${encodeURIComponent(clientSecret)}` : "";
    return this.request("POST", `/v1/payments/hubtel/sessions/${paymentId}${query}`);
  }
  /**
   * Maps SDK payment method to backend format
   */
  mapPaymentMethod(method) {
    switch (method) {
      case "card":
        return "card";
      case "mobile_money":
        return "mobile_money";
      case "bank_transfer":
        return "bank_transfer";
      default:
        return method;
    }
  }
};
function createReevitClient(config) {
  return new ReevitAPIClient(config);
}

// src/utils.ts
var CURRENCY_LOCALES = {
  GHS: "en-GH",
  NGN: "en-NG",
  KES: "en-KE",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB"
};
var ZERO_DECIMAL_CURRENCIES = /* @__PURE__ */ new Set([
  "XOF",
  "XAF",
  "RWF",
  "UGX",
  "JPY",
  "KRW",
  "BIF",
  "GNF",
  "VND",
  "CLP",
  "ISK",
  "KMF",
  "DJF",
  "PYG",
  "MGA"
]);
function currencyExponent(currency) {
  const code = (currency || "").toUpperCase();
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code
    }).resolvedOptions().maximumFractionDigits;
    if (typeof digits === "number" && Number.isFinite(digits)) {
      return digits;
    }
  } catch {
  }
  return ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
}
function toMinorUnits(major, currency) {
  return Math.round(major * 10 ** currencyExponent(currency));
}
function formatAmount(amount, currency) {
  const code = (currency || "").toUpperCase();
  const exponent = currencyExponent(code);
  const majorUnit = amount / 10 ** exponent;
  const locale = CURRENCY_LOCALES[code] || "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent
    }).format(majorUnit);
  } catch {
    return `${code} ${majorUnit.toFixed(exponent)}`;
  }
}
function generateReference(prefix = "reevit") {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}
function validatePhone(phone, country = "GH") {
  const digits = phone.replace(/\D/g, "");
  const patterns = {
    GH: /^(?:233|0)?[235][0-9]{8}$/,
    // Ghana
    NG: /^(?:234|0)?[789][01][0-9]{8}$/,
    // Nigeria
    KE: /^(?:254|0)?[17][0-9]{8}$/
    // Kenya
  };
  const pattern = patterns[country.toUpperCase()];
  if (!pattern) return digits.length >= 10;
  return pattern.test(digits);
}
function formatPhone(phone, country = "GH") {
  const digits = phone.replace(/\D/g, "");
  if (country === "GH") {
    if (digits.startsWith("233") && digits.length === 12) {
      const local = "0" + digits.slice(3);
      return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
    if (digits.length === 10 && digits.startsWith("0")) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
  }
  return phone;
}
function detectNetwork(phone) {
  const digits = phone.replace(/\D/g, "");
  let prefix;
  if (digits.startsWith("233")) {
    prefix = digits.slice(3, 5);
  } else if (digits.startsWith("0")) {
    prefix = digits.slice(1, 3);
  } else {
    prefix = digits.slice(0, 2);
  }
  const mtnPrefixes = ["24", "25", "53", "54", "55", "59"];
  const telecelPrefixes = ["20", "50"];
  const airteltigoPrefixes = ["26", "27", "56", "57"];
  if (mtnPrefixes.includes(prefix)) return "mtn";
  if (telecelPrefixes.includes(prefix)) return "telecel";
  if (airteltigoPrefixes.includes(prefix)) return "airteltigo";
  return null;
}
function createThemeVariables(theme) {
  const variables = {};
  if (theme.primaryColor) {
    variables["--reevit-text"] = theme.primaryColor;
  }
  if (theme.primaryForegroundColor) {
    variables["--reevit-text-secondary"] = theme.primaryForegroundColor;
    variables["--reevit-muted"] = theme.primaryForegroundColor;
  }
  if (theme.buttonBackgroundColor) {
    variables["--reevit-primary"] = theme.buttonBackgroundColor;
    variables["--reevit-primary-hover"] = theme.buttonBackgroundColor;
  }
  if (theme.buttonTextColor) {
    variables["--reevit-primary-foreground"] = theme.buttonTextColor;
  }
  if (theme.backgroundColor) {
    variables["--reevit-background"] = theme.backgroundColor;
    variables["--reevit-surface"] = theme.backgroundColor;
  }
  if (theme.surfaceColor) {
    variables["--reevit-surface"] = theme.surfaceColor;
  }
  if (theme.borderColor) {
    variables["--reevit-border"] = theme.borderColor;
  }
  if (theme.textColor) {
    variables["--reevit-text"] = theme.textColor;
  }
  if (theme.mutedTextColor) {
    variables["--reevit-text-secondary"] = theme.mutedTextColor;
  }
  if (theme.borderRadius) {
    variables["--reevit-radius"] = theme.borderRadius;
    variables["--reevit-radius-sm"] = theme.borderRadius;
    variables["--reevit-radius-lg"] = theme.borderRadius;
  }
  if (theme.fontFamily) {
    variables["--reevit-font"] = theme.fontFamily;
  }
  return variables;
}
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
function detectCountryFromCurrency(currency) {
  const currencyToCountry = {
    GHS: "GH",
    NGN: "NG",
    KES: "KE",
    UGX: "UG",
    TZS: "TZ",
    ZAR: "ZA",
    XOF: "CI",
    XAF: "CM",
    USD: "US",
    EUR: "DE",
    GBP: "GB"
  };
  return currencyToCountry[currency.toUpperCase()] || "GH";
}

// src/intent.ts
var INTENT_CACHE_TTL_MS = 10 * 60 * 1e3;
var intentCache = /* @__PURE__ */ new Map();
var lookupKeyByWireKey = /* @__PURE__ */ new Map();
function forgetKey(lookupKey) {
  const entry = intentCache.get(lookupKey);
  if (entry?.idempotencyKey) {
    lookupKeyByWireKey.delete(entry.idempotencyKey);
  }
  intentCache.delete(lookupKey);
}
function toLookupKey(key) {
  return lookupKeyByWireKey.get(key) ?? key;
}
function pruneIntentCache(now = Date.now()) {
  for (const [key, entry] of intentCache) {
    if (entry.expiresAt <= now) {
      forgetKey(key);
    }
  }
}
function getIntentCacheEntryInternal(lookupKey) {
  const entry = intentCache.get(lookupKey);
  if (!entry) {
    return void 0;
  }
  if (entry.expiresAt <= Date.now()) {
    forgetKey(lookupKey);
    return void 0;
  }
  return entry;
}
function setIntentCacheEntryInternal(lookupKey, update) {
  const now = Date.now();
  const existing = getIntentCacheEntryInternal(lookupKey);
  const next = {
    ...existing,
    ...update,
    expiresAt: now + INTENT_CACHE_TTL_MS
  };
  if (existing?.idempotencyKey && existing.idempotencyKey !== next.idempotencyKey) {
    lookupKeyByWireKey.delete(existing.idempotencyKey);
  }
  intentCache.set(lookupKey, next);
  if (next.idempotencyKey && next.idempotencyKey !== lookupKey) {
    lookupKeyByWireKey.set(next.idempotencyKey, lookupKey);
  }
  return next;
}
function buildIdempotencyPayload(options) {
  const { config, method, preferredProvider, allowedProviders, publicKey } = options;
  if (config.sessionSecret) {
    return {
      sessionSecret: config.sessionSecret,
      publicKey: publicKey || config.publicKey || ""
    };
  }
  const payload = {
    amount: config.amount,
    currency: config.currency,
    email: config.email || "",
    phone: config.phone || "",
    customerName: config.customerName || "",
    paymentLinkCode: config.paymentLinkCode || "",
    paymentMethods: config.paymentMethods || [],
    metadata: config.metadata || {},
    customFields: config.customFields || {},
    method: method || "",
    preferredProvider: preferredProvider || "",
    allowedProviders: allowedProviders || [],
    publicKey: publicKey || config.publicKey || ""
  };
  if (config.reference) {
    payload.reference = config.reference;
  }
  return payload;
}
function resolveIntentIdentity(options) {
  pruneIntentCache();
  const explicitKey = options.config.idempotencyKey;
  const lookupKey = explicitKey || generateIdempotencyKey(buildIdempotencyPayload(options));
  const idempotencyKey = explicitKey || attemptIdempotencyKey(lookupKey);
  const existing = getIntentCacheEntryInternal(lookupKey);
  const reference = options.config.reference || existing?.reference || generateReference();
  const cacheEntry = setIntentCacheEntryInternal(lookupKey, { reference, idempotencyKey });
  return { idempotencyKey, lookupKey, reference, cacheEntry };
}
function getIntentCacheEntry(key) {
  pruneIntentCache();
  return getIntentCacheEntryInternal(toLookupKey(key));
}
function cacheIntentPromise(key, promise) {
  return setIntentCacheEntryInternal(toLookupKey(key), { promise });
}
function cacheIntentResponse(key, response) {
  return setIntentCacheEntryInternal(toLookupKey(key), { response, promise: void 0 });
}
function clearIntentCacheEntry(key) {
  forgetKey(toLookupKey(key));
}

// src/state.ts
function createInitialState() {
  return {
    status: "idle",
    paymentIntent: null,
    selectedMethod: null,
    error: null,
    result: null
  };
}
function reevitReducer(state, action) {
  switch (action.type) {
    case "INIT_START":
      return { ...state, status: "loading", error: null };
    case "INIT_SUCCESS":
      return {
        ...state,
        status: "ready",
        paymentIntent: action.payload,
        selectedMethod: action.payload.availableMethods?.length === 1 ? action.payload.availableMethods[0] : null
      };
    case "INIT_ERROR":
      return { ...state, status: "failed", error: action.payload };
    case "SELECT_METHOD":
      return { ...state, status: "method_selected", selectedMethod: action.payload };
    case "PROCESS_START":
      return { ...state, status: "processing", error: null };
    case "PROCESS_SUCCESS":
      return { ...state, status: "success", result: action.payload };
    case "PROCESS_ERROR":
      return { ...state, status: "failed", error: action.payload };
    case "RESET":
      return { ...createInitialState(), status: "ready", paymentIntent: state.paymentIntent };
    case "CLOSE":
      return { ...state, status: "closed" };
    default:
      return state;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ReevitAPIClient,
  attemptIdempotencyKey,
  cacheIntentPromise,
  cacheIntentResponse,
  clearIdempotencyAttemptKeys,
  clearIntentCacheEntry,
  cn,
  createInitialState,
  createPaymentError,
  createReevitClient,
  createThemeVariables,
  currencyExponent,
  detectCountryFromCurrency,
  detectNetwork,
  formatAmount,
  formatPhone,
  generateIdempotencyKey,
  generateReference,
  getIntentCacheEntry,
  isPaymentError,
  newIdempotencyKey,
  reevitReducer,
  resolveIntentIdentity,
  toMinorUnits,
  validatePhone
});
//# sourceMappingURL=index.js.map