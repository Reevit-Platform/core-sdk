/**
 * Reevit Core Types
 * Shared type definitions for all Reevit SDKs
 */
type PaymentMethod = 'card' | 'mobile_money' | 'bank_transfer' | 'apple_pay' | 'google_pay';
type MobileMoneyNetwork = 'mtn' | 'telecel' | 'airteltigo';
type PSPType = 'paystack' | 'hubtel' | 'flutterwave' | 'stripe' | 'monnify' | 'mpesa';
/** Payment source type - indicates where the payment originated from */
type PaymentSource = 'payment_link' | 'api' | 'subscription';
interface ReevitCheckoutConfig {
    /** Your Reevit public key (required for API-created intents; omit for payment links) */
    publicKey?: string;
    /** Amount in the smallest currency unit (e.g., pesewas for GHS) */
    amount: number;
    /** Currency code (e.g., 'GHS', 'NGN', 'USD') */
    currency: string;
    /** Customer email address */
    email?: string;
    /** Customer phone number (required for mobile money) */
    phone?: string;
    /** Customer name (optional, used for payment links) */
    customerName?: string;
    /** Unique reference for this transaction */
    reference?: string;
    /** Optional idempotency key to safely retry or dedupe intent creation */
    idempotencyKey?: string;
    /** Additional metadata to attach to the payment */
    metadata?: Record<string, unknown>;
    /** Custom fields for payment links (if applicable) */
    customFields?: Record<string, unknown>;
    /** Payment link code (for public checkout flows) */
    paymentLinkCode?: string;
    /** Payment methods to display */
    paymentMethods?: PaymentMethod[];
    /** Pre-created payment intent to use */
    initialPaymentIntent?: PaymentIntent | any;
}
interface ReevitCheckoutCallbacks {
    /** Called when payment is successful */
    onSuccess?: (result: PaymentResult) => void;
    /** Called when payment fails */
    onError?: (error: PaymentError) => void;
    /** Called when user closes the checkout */
    onClose?: () => void;
    /** Called when checkout state changes */
    onStateChange?: (state: CheckoutState) => void;
}
type CheckoutState = 'idle' | 'loading' | 'ready' | 'method_selected' | 'processing' | 'success' | 'failed' | 'closed';
interface PaymentResult {
    /** Unique payment ID from Reevit */
    paymentId: string;
    /** Reference provided or generated */
    reference: string;
    /** Amount paid in smallest currency unit */
    amount: number;
    /** Currency code */
    currency: string;
    /** Payment method used */
    paymentMethod: PaymentMethod;
    /** PSP that processed the payment */
    psp: string;
    /** PSP's transaction reference */
    pspReference: string;
    /** Payment status */
    status: 'success' | 'pending';
    /** Any additional data from the PSP */
    metadata?: Record<string, unknown>;
    /** Payment source type (payment_link, api, subscription) */
    source?: PaymentSource;
    /** ID of the source (payment link ID, subscription ID, etc.) */
    sourceId?: string;
    /** Human-readable description of the source (e.g., payment link name) */
    sourceDescription?: string;
}
interface PaymentError {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Whether the error is recoverable (user can retry) */
    recoverable?: boolean;
    /** Original error from PSP if available */
    originalError?: unknown;
    /** Additional error details */
    details?: Record<string, unknown>;
}
interface ReevitTheme {
    /** Primary brand color (main text color) */
    primaryColor?: string;
    /** Primary text color on brand surfaces (description/secondary text) */
    primaryForegroundColor?: string;
    /** Button background color */
    buttonBackgroundColor?: string;
    /** Button text color */
    buttonTextColor?: string;
    /** Background color */
    backgroundColor?: string;
    /** Border color for borders and dividers */
    borderColor?: string;
    /** Surface color for cards/panels */
    surfaceColor?: string;
    /** Text color */
    textColor?: string;
    /** Muted text color */
    mutedTextColor?: string;
    /** Border radius for inputs and buttons */
    borderRadius?: string;
    /** Font family to use */
    fontFamily?: string;
    /** Whether to use dark mode */
    darkMode?: boolean;
    /** Custom logo URL to display in checkout header */
    logoUrl?: string;
    /** Company or organization name to display in checkout header */
    companyName?: string;
    /** PSP selector background color */
    pspSelectorBgColor?: string;
    /** PSP selector text color */
    pspSelectorTextColor?: string;
    /** PSP selector border color */
    pspSelectorBorderColor?: string;
    /** Use border-only style for PSP selector (no filled background) */
    pspSelectorUseBorder?: boolean;
    /** Selected PSP background color */
    selectedBackgroundColor?: string;
    /** Selected PSP primary text color */
    selectedTextColor?: string;
    /** Selected PSP description/muted text color */
    selectedDescriptionColor?: string;
    /** Selected PSP border color */
    selectedBorderColor?: string;
}
interface PSPConfig {
    id: string;
    name: string;
    supportedMethods: PaymentMethod[];
    supportedCurrencies: string[];
}
interface CheckoutProviderOption {
    provider: string;
    name: string;
    methods: PaymentMethod[];
    countries?: string[];
}
interface MobileMoneyFormData {
    phone: string;
    network: MobileMoneyNetwork;
}
interface CardFormData {
    /** Token from PSP's hosted fields */
    token: string;
    /** Last 4 digits for display */
    last4?: string;
    /** Card brand (visa, mastercard, etc.) */
    brand?: string;
}
interface PaymentIntent {
    /** Unique payment intent ID */
    id: string;
    /** Client secret for authenticating client-side operations */
    clientSecret: string;
    /** PSP public key if available */
    pspPublicKey?: string;
    /** PSP-specific credentials for client-side checkout (e.g., Hubtel's merchantAccount, basicAuth) */
    pspCredentials?: {
        /** Hubtel merchant account number */
        merchantAccount?: string | number;
        /** Hubtel basic auth header value (deprecated - use hubtelSessionToken instead) */
        basicAuth?: string;
        /** Any other PSP-specific credential fields */
        [key: string]: unknown;
    };
    /** Amount in smallest currency unit */
    amount: number;
    /** Currency code */
    currency: string;
    /** Payment status */
    status: 'pending' | 'requires_action' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'cancelled';
    /** Recommended PSP based on routing rules */
    recommendedPsp: PSPType;
    /** Available payment methods for this intent */
    availableMethods: PaymentMethod[];
    /** Reference provided or generated */
    reference?: string;
    /** Organization ID (from Reevit backend, required for webhook routing) */
    orgId?: string;
    /** Connection ID (from Reevit backend) */
    connectionId?: string;
    /** Provider name (from backend) */
    provider?: string;
    /** Fee amount charged by PSP */
    feeAmount?: number;
    /** Fee currency */
    feeCurrency?: string;
    /** Net amount after fees */
    netAmount?: number;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** Available PSPs for this checkout session */
    availableProviders?: CheckoutProviderOption[];
    /** Brand theme from checkout settings */
    branding?: ReevitTheme;
}
interface HubtelSessionResponse {
    /** Session token to use with Hubtel SDK */
    token: string;
    /** Merchant account number */
    merchantAccount: string | number;
    /** Base64 basic auth for Hubtel checkout (exposes credentials) */
    basicAuth?: string;
    /** Token expiration time in seconds */
    expiresInSeconds: number;
    /** Unix timestamp when token expires */
    expiresAt: number;
}

/**
 * Reevit API Client
 *
 * Handles communication with the Reevit backend for payment operations.
 */

interface CreatePaymentIntentRequest {
    amount: number;
    currency: string;
    method?: string;
    country: string;
    customer_id?: string;
    metadata?: Record<string, unknown>;
    description?: string;
    policy?: {
        prefer?: string[];
        allowed_providers?: string[];
        max_amount?: number;
        blocked_bins?: string[];
        allowed_bins?: string[];
        velocity_max_per_minute?: number;
    };
}
interface PaymentIntentResponse {
    id: string;
    org_id?: string;
    connection_id: string;
    provider: string;
    status: string;
    client_secret: string;
    psp_public_key: string;
    psp_credentials?: {
        merchantAccount?: string | number;
        basicAuth?: string;
        [key: string]: unknown;
    };
    amount: number;
    currency: string;
    fee_amount: number;
    fee_currency: string;
    net_amount: number;
    reference?: string;
    available_psps?: Array<{
        provider: string;
        name: string;
        methods: string[];
        countries?: string[];
    }>;
    branding?: Record<string, unknown>;
}
interface ConfirmPaymentRequest {
    provider_ref_id: string;
    provider_data?: Record<string, unknown>;
}
interface PaymentDetailResponse {
    id: string;
    connection_id: string;
    provider: string;
    method: string;
    status: string;
    amount: number;
    currency: string;
    fee_amount: number;
    fee_currency: string;
    net_amount: number;
    customer_id?: string;
    client_secret: string;
    provider_ref_id?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    /** Payment source type (payment_link, api, subscription) */
    source?: 'payment_link' | 'api' | 'subscription';
    /** ID of the source (payment link ID, subscription ID, etc.) */
    source_id?: string;
    /** Human-readable description of the source (e.g., payment link name) */
    source_description?: string;
}
interface APIErrorResponse {
    code: string;
    message: string;
    details?: Record<string, string>;
}
interface ReevitAPIClientConfig {
    /** Your Reevit public key */
    publicKey?: string;
    /** Base URL for the Reevit API (defaults to production) */
    baseUrl?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
}
/**
 * Generates a deterministic idempotency key based on input parameters
 * Uses a simple hash function suitable for browser environments
 * Exported for use by SDK hooks (e.g., payment link flows)
 */
declare function generateIdempotencyKey(params: Record<string, unknown>): string;
/**
 * Reevit API Client
 */
declare class ReevitAPIClient {
    private readonly publicKey;
    private readonly baseUrl;
    private readonly timeout;
    constructor(config: ReevitAPIClientConfig);
    /**
     * Makes an authenticated API request
     * @param idempotencyKey Optional deterministic idempotency key for the request
     */
    private request;
    /**
     * Creates a payment intent
     */
    createPaymentIntent(config: ReevitCheckoutConfig, method?: PaymentMethod, country?: string, options?: {
        preferredProviders?: string[];
        allowedProviders?: string[];
    }): Promise<{
        data?: PaymentIntentResponse;
        error?: PaymentError;
    }>;
    /**
     * Retrieves a payment intent by ID
     */
    getPaymentIntent(paymentId: string): Promise<{
        data?: PaymentDetailResponse;
        error?: PaymentError;
    }>;
    /**
     * Confirms a payment after PSP callback
     */
    confirmPayment(paymentId: string): Promise<{
        data?: PaymentDetailResponse;
        error?: PaymentError;
    }>;
    /**
     * Confirms a payment intent using client secret (public endpoint)
     */
    confirmPaymentIntent(paymentId: string, clientSecret: string): Promise<{
        data?: PaymentDetailResponse;
        error?: PaymentError;
    }>;
    /**
     * Cancels a payment intent
     */
    cancelPaymentIntent(paymentId: string): Promise<{
        data?: PaymentDetailResponse;
        error?: PaymentError;
    }>;
    /**
     * Creates a Hubtel session token for secure checkout
     * Returns a short-lived token that contains Hubtel credentials
     * Credentials are never exposed to the client directly
     */
    createHubtelSession(paymentId: string, clientSecret?: string): Promise<{
        data?: HubtelSessionResponse;
        error?: PaymentError;
    }>;
    /**
     * Maps SDK payment method to backend format
     */
    private mapPaymentMethod;
}
/**
 * Creates a new Reevit API client instance
 */
declare function createReevitClient(config: ReevitAPIClientConfig): ReevitAPIClient;

/**
 * Utility Functions
 * Shared utilities for Reevit SDKs
 */

/**
 * Formats an amount from smallest currency unit to display format
 */
declare function formatAmount(amount: number, currency: string): string;
/**
 * Generates a unique payment reference
 */
declare function generateReference(prefix?: string): string;
/**
 * Validates a phone number for mobile money
 */
declare function validatePhone(phone: string, country?: string): boolean;
/**
 * Formats a phone number for display
 */
declare function formatPhone(phone: string, country?: string): string;
/**
 * Detects mobile money network from phone number (Ghana)
 */
declare function detectNetwork(phone: string): MobileMoneyNetwork | null;
/**
 * Creates CSS custom property variables from theme
 */
declare function createThemeVariables(theme: ReevitTheme): Record<string, string>;
/**
 * Simple class name concatenation utility
 */
declare function cn(...classes: (string | boolean | undefined | null)[]): string;
/**
 * Detects country code from currency
 */
declare function detectCountryFromCurrency(currency: string): string;

/**
 * Intent identity + cache helpers
 */

interface IntentIdentityOptions {
    config: ReevitCheckoutConfig;
    method?: PaymentMethod;
    preferredProvider?: string;
    allowedProviders?: string[];
    publicKey?: string;
}
interface IntentCacheEntry {
    promise?: Promise<PaymentIntentResponse>;
    response?: PaymentIntentResponse;
    expiresAt: number;
    reference?: string;
}
declare function resolveIntentIdentity(options: IntentIdentityOptions): {
    idempotencyKey: string;
    reference: string;
    cacheEntry?: IntentCacheEntry;
};
declare function getIntentCacheEntry(idempotencyKey: string): IntentCacheEntry | undefined;
declare function cacheIntentPromise(idempotencyKey: string, promise: Promise<PaymentIntentResponse>): IntentCacheEntry;
declare function cacheIntentResponse(idempotencyKey: string, response: PaymentIntentResponse): IntentCacheEntry;
declare function clearIntentCacheEntry(idempotencyKey: string): void;

/**
 * Reevit State Machine
 * Shared state management logic for all SDKs
 */

interface ReevitState {
    status: CheckoutState;
    paymentIntent: PaymentIntent | null;
    selectedMethod: PaymentMethod | null;
    error: PaymentError | null;
    result: PaymentResult | null;
}
type ReevitAction = {
    type: 'INIT_START';
} | {
    type: 'INIT_SUCCESS';
    payload: PaymentIntent;
} | {
    type: 'INIT_ERROR';
    payload: PaymentError;
} | {
    type: 'SELECT_METHOD';
    payload: PaymentMethod;
} | {
    type: 'PROCESS_START';
} | {
    type: 'PROCESS_SUCCESS';
    payload: PaymentResult;
} | {
    type: 'PROCESS_ERROR';
    payload: PaymentError;
} | {
    type: 'RESET';
} | {
    type: 'CLOSE';
};
/**
 * Creates the initial state for the checkout
 */
declare function createInitialState(): ReevitState;
/**
 * State reducer for checkout flow
 */
declare function reevitReducer(state: ReevitState, action: ReevitAction): ReevitState;

export { type APIErrorResponse, type CardFormData, type CheckoutProviderOption, type CheckoutState, type ConfirmPaymentRequest, type CreatePaymentIntentRequest, type HubtelSessionResponse, type IntentCacheEntry, type MobileMoneyFormData, type MobileMoneyNetwork, type PSPConfig, type PSPType, type PaymentDetailResponse, type PaymentError, type PaymentIntent, type PaymentIntentResponse, type PaymentMethod, type PaymentResult, type PaymentSource, ReevitAPIClient, type ReevitAPIClientConfig, type ReevitAction, type ReevitCheckoutCallbacks, type ReevitCheckoutConfig, type ReevitState, type ReevitTheme, cacheIntentPromise, cacheIntentResponse, clearIntentCacheEntry, cn, createInitialState, createReevitClient, createThemeVariables, detectCountryFromCurrency, detectNetwork, formatAmount, formatPhone, generateIdempotencyKey, generateReference, getIntentCacheEntry, reevitReducer, resolveIntentIdentity, validatePhone };
