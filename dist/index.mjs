// src/api/client.ts
var API_BASE_URL_PRODUCTION = "https://api.reevit.io";
var API_BASE_URL_SANDBOX = "https://sandbox-api.reevit.io";
var DEFAULT_TIMEOUT = 3e4;
function isSandboxKey(publicKey) {
  return publicKey.startsWith("pk_test_") || publicKey.startsWith("pk_sandbox_") || publicKey.startsWith("pfk_test_") || publicKey.startsWith("pfk_sandbox_");
}
function createPaymentError(response, errorData) {
  return {
    code: errorData.code || "api_error",
    message: errorData.message || "An unexpected error occurred",
    details: {
      httpStatus: response.status,
      ...errorData.details
    }
  };
}
var ReevitAPIClient = class {
  constructor(config) {
    this.publicKey = config.publicKey;
    this.baseUrl = config.baseUrl || (isSandboxKey(config.publicKey) ? API_BASE_URL_SANDBOX : API_BASE_URL_PRODUCTION);
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }
  /**
   * Makes an authenticated API request
   */
  async request(method, path, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const headers = {
      "Content-Type": "application/json",
      "X-Reevit-Key": this.publicKey,
      "X-Reevit-Client": "@reevit/core",
      "X-Reevit-Client-Version": "0.3.2"
    };
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      headers["Idempotency-Key"] = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
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
              message: "The request timed out. Please try again."
            }
          };
        }
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          return {
            error: {
              code: "network_error",
              message: "Unable to connect to Reevit. Please check your internet connection."
            }
          };
        }
      }
      return {
        error: {
          code: "unknown_error",
          message: "An unexpected error occurred. Please try again."
        }
      };
    }
  }
  /**
   * Creates a payment intent
   */
  async createPaymentIntent(config, method, country = "GH") {
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
      method: this.mapPaymentMethod(method),
      country,
      customer_id: config.email || config.metadata?.customerId,
      metadata
    };
    return this.request("POST", "/v1/payments/intents", request);
  }
  /**
   * Retrieves a payment intent by ID
   */
  async getPaymentIntent(paymentId) {
    return this.request("GET", `/v1/payments/${paymentId}`);
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
    return this.request("POST", `/v1/payments/${paymentId}/confirm-intent?client_secret=${clientSecret}`);
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
  async createHubtelSession(paymentId) {
    return this.request("POST", `/v1/payments/hubtel/sessions/${paymentId}`);
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
function formatAmount(amount, currency) {
  const majorUnit = amount / 100;
  const currencyFormats = {
    GHS: { locale: "en-GH", minimumFractionDigits: 2 },
    NGN: { locale: "en-NG", minimumFractionDigits: 2 },
    KES: { locale: "en-KE", minimumFractionDigits: 2 },
    USD: { locale: "en-US", minimumFractionDigits: 2 },
    EUR: { locale: "de-DE", minimumFractionDigits: 2 },
    GBP: { locale: "en-GB", minimumFractionDigits: 2 }
  };
  const format = currencyFormats[currency.toUpperCase()] || { locale: "en-US", minimumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat(format.locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: format.minimumFractionDigits
    }).format(majorUnit);
  } catch {
    return `${currency} ${majorUnit.toFixed(2)}`;
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
  const vodafonePrefixes = ["20", "50"];
  const airteltigoPrefixes = ["26", "27", "56", "57"];
  if (mtnPrefixes.includes(prefix)) return "mtn";
  if (vodafonePrefixes.includes(prefix)) return "vodafone";
  if (airteltigoPrefixes.includes(prefix)) return "airteltigo";
  return null;
}
function createThemeVariables(theme) {
  const variables = {};
  if (theme.primaryColor) {
    variables["--reevit-primary"] = theme.primaryColor;
  }
  if (theme.backgroundColor) {
    variables["--reevit-bg"] = theme.backgroundColor;
  }
  if (theme.textColor) {
    variables["--reevit-text"] = theme.textColor;
  }
  if (theme.borderRadius) {
    variables["--reevit-radius"] = theme.borderRadius;
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
export {
  ReevitAPIClient,
  cn,
  createInitialState,
  createReevitClient,
  createThemeVariables,
  detectCountryFromCurrency,
  detectNetwork,
  formatAmount,
  formatPhone,
  generateReference,
  reevitReducer,
  validatePhone
};
//# sourceMappingURL=index.mjs.map