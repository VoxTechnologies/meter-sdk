import type { MeterAiUsage, MeterAiUsageInput } from "./ai-cost.js";

export type MeterPublicApiClientOptions = {
  baseUrl: string;
  serviceId: string;
  serviceApiKey?: string;
  fetchImpl?: typeof fetch;
  defaultOrigin?: string;
  timeoutMs?: number;
};

export type MeterService = {
  id: string;
  slug: string;
  name: string;
  creditName: string;
  brandColor: string;
  supportEmail?: string;
  termsUrl?: string;
  privacyUrl?: string;
};

export type MeterServiceIntegration = {
  serviceId: string;
  gatewayEnabled: boolean;
  upstreamUrl?: string;
  upstreamAuthMode: "none" | "bearer" | "header" | "oauth_client_credentials";
  upstreamAuthHeader?: string;
  hasUpstreamAuthSecret: boolean;
  oauthTokenUrl?: string;
  oauthClientId?: string;
  hasOauthClientSecret: boolean;
  oauthScopes: string[];
  customerAuthMode: "api_key" | "jwt";
  customerHeader: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  jwksUrl?: string;
  jwtSubjectClaim: string;
  jwtEmailClaim: string;
  autoProvisionCustomers: boolean;
  defaultCredits: number;
  toolPrices: Record<string, number>;
  createdAt: number;
  updatedAt: number;
};

export type MeterIntegrationUpdate = Partial<
  Omit<
    MeterServiceIntegration,
    | "serviceId"
    | "hasUpstreamAuthSecret"
    | "hasOauthClientSecret"
    | "createdAt"
    | "updatedAt"
  >
> & {
  upstreamAuthSecret?: string | null;
  oauthClientSecret?: string | null;
};

export type MeterAiModelPrice = {
  serviceId: string;
  provider: string;
  model: string;
  pricing: import("./ai-cost.js").MeterAiTokenPricing;
  version: string;
  effectiveFrom: number;
  createdAt: number;
  updatedAt: number;
};

export type MeterWebhookEndpointMode = "push" | "poll";

export type MeterWebhookEndpoint = {
  id: string;
  serviceId: string;
  url: string;
  events: string[];
  status: "active" | "disabled";
  mode: MeterWebhookEndpointMode;
  createdAt: number;
  updatedAt: number;
};

export type MeterPolledWebhookDelivery = MeterWebhookDelivery & { payload: unknown };

export type MeterWebhookDelivery = {
  id: string;
  endpointId: string;
  serviceId: string;
  eventId: string;
  eventType: string;
  status: "pending" | "delivering" | "delivered" | "failed";
  attemptCount: number;
  nextAttemptAt: number;
  responseStatus?: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  deliveredAt?: number;
};

export type MeterServiceApiKey = {
  id: string;
  name: string;
  last4: string;
  createdAt: number;
  revokedAt?: number;
};

export type MeterCreatedServiceApiKey = MeterServiceApiKey & { secret: string };

export type MeterServiceApiAuditLog = {
  id: string;
  ts: number;
  serviceId: string;
  method: string;
  path: string;
  statusCode: number;
  authResult: string;
  apiKeyLast4?: string;
  ip?: string;
  userAgent?: string;
};

export type MeterUsageRollup = {
  serviceId?: string;
  customerId?: string;
  name?: string;
  tool?: string;
  productId?: string;
  provider?: string;
  calls?: number;
  credits?: number;
  usd?: number;
  grossUsd?: number;
  providerPayoutUsd?: number;
};

export type MeterAiCostRollup = {
  serviceId: string;
  provider?: string;
  model?: string;
  tool?: string;
  customerId?: string;
  customerName?: string;
  calls: number;
  measuredCalls: number;
  unpricedCalls: number;
  credits: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  aiCostMicrousd: number;
  aiCostUsd: number;
  grossUsd: number;
  grossProfitUsd: number;
  grossMarginPct?: number;
};

export type MeterAiCostAnalytics = {
  summary: MeterAiCostRollup;
  byModel: MeterAiCostRollup[];
  byTool: MeterAiCostRollup[];
  byCustomer: MeterAiCostRollup[];
};

export type MeterUsageReport = {
  service: MeterService;
  creditUsd: number;
  byCustomer: MeterUsageRollup[];
  byTool: MeterUsageRollup[];
  byProduct: MeterUsageRollup[];
  revenueShare: MeterUsageRollup[];
  recent: MeterUsageEvent[];
  aiCosts: MeterAiCostAnalytics;
};

export type MeterCustomer = {
  serviceId?: string;
  localId: string;
  name: string;
  stripeCustomerId?: string;
  initialCredits?: number;
  autoRechargeEnabled?: boolean;
  rechargeThresholdCredits?: number;
  rechargeAmountCredits?: number;
};

export type MeterCreditAccount = {
  serviceId: string;
  customerLocalId: string;
  customerName: string;
  stripeCustomerId?: string;
  balanceCredits: number;
  autoRechargeEnabled: boolean;
  rechargeThresholdCredits: number;
  rechargeAmountCredits: number;
  defaultPaymentMethodId?: string;
  status: "active" | "suspended" | "recharge_required" | string;
  createdAt: number;
  updatedAt: number;
};

export type MeterCreditReservation = {
  id: string;
  ts: number;
  serviceId: string;
  customerLocalId: string;
  requestId: string;
  tool: string;
  credits: number;
  provider: string;
  productId?: string;
  status: "held" | "committed" | "released";
  usageEventId?: string;
  releasedReason?: string;
  expiresAt?: number;
  updatedAt: number;
};

export type MeterUsageEvent = {
  id: string;
  ts: number;
  serviceId: string;
  customerLocalId: string;
  customerName: string;
  stripeCustomerId?: string;
  productId?: string;
  requestId?: string;
  tool: string;
  credits: number;
  provider: string;
  aiUsage?: MeterAiUsage;
};

export type MeterCreditLedgerEntry = {
  id: string;
  ts: number;
  serviceId: string;
  customerLocalId: string;
  type: string;
  creditsDelta: number;
  balanceAfter: number;
  usageEventId?: string;
  stripePaymentIntentId?: string;
  checkoutSessionId?: string;
  idempotencyKey: string;
  note?: string;
};

export type MeterToolCall = {
  customerLocalId: string;
  tool: string;
  credits?: number;
  providerId?: string;
  productId?: string;
  requestId?: string;
  aiUsage?: MeterAiUsageInput | MeterAiUsage;
};

export type MeterCustomerAccountEnvelope = {
  service: MeterService;
  customer: MeterCustomer;
  account: MeterCreditAccount;
};

export type MeterAuthorizeResponse = {
  authorized: true;
  service: MeterService;
  customer: { serviceId: string; localId: string; name: string };
  // Mirrors the server's rated quote (ratedToolCall): no customerLocalId is echoed
  // back, and credits may be 0 (Math.max(0, ...)), so this must not intersect the
  // request-shaped MeterToolCall (which requires customerLocalId and forbids 0).
  quote: {
    tool: string;
    provider: string;
    credits: number;
    productId?: string;
    requestId?: string;
    aiUsage?: MeterAiUsageInput | MeterAiUsage;
  };
  balanceCredits: number;
  // The server returns reservation: null when no requestId was supplied.
  reservation?: MeterCreditReservation | null;
};

export type MeterCommitResponse = {
  committed: true;
  duplicate: boolean;
  service: MeterService;
  event: MeterUsageEvent;
  balanceCredits: number;
  reservation?: MeterCreditReservation | null;
};

export type MeterReleaseResponse = {
  released: boolean;
  service: MeterService;
  customer: { serviceId: string; localId: string; name: string };
  reservation?: MeterCreditReservation | null;
  account: MeterCreditAccount;
  balanceCredits: number;
};

export type MeterPortalSessionResponse = {
  service: MeterService;
  customer: MeterCustomer;
  session: {
    token: string;
    url: string;
  };
};

export type MeterTopUpResponse = {
  service: MeterService;
  customer: MeterCustomer;
  mode: "ledger-only" | "stripe-checkout";
  url?: string;
  sessionId?: string;
  account?: MeterCreditAccount;
};

export type MeterPaymentRequiredPayload = {
  error: "payment_required";
  message: string;
  serviceId: string;
  serviceName: string;
  creditName: string;
  customerId: string;
  requiredCredits: number;
  balanceCredits: number;
  topUpUrl: string;
};

export type MeterAccountSuspendedPayload = {
  error: "account_suspended";
  message: string;
  serviceId: string;
  serviceName: string;
  customerId: string;
};

export function isMeterPaymentRequiredPayload(
  body: unknown
): body is MeterPaymentRequiredPayload {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { error?: unknown }).error === "payment_required" &&
      typeof (body as { topUpUrl?: unknown }).topUpUrl === "string"
  );
}

export function isMeterAccountSuspendedPayload(
  body: unknown
): body is MeterAccountSuspendedPayload {
  return Boolean(
    body &&
      typeof body === "object" &&
      (body as { error?: unknown }).error === "account_suspended" &&
      typeof (body as { customerId?: unknown }).customerId === "string"
  );
}

export class MeterPublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: unknown,
    public readonly requestId?: string,
    /** Parsed `retry-after` (seconds) on a 429, so callers can back off correctly. */
    public readonly retryAfterSeconds?: number
  ) {
    super(
      `Meter Public API request failed: ${status} ${path}` +
        (requestId ? ` (request ${requestId})` : "")
    );
    this.name = "MeterPublicApiError";
  }
}

export class MeterNetworkError extends Error {
  constructor(
    public readonly path: string,
    public readonly cause: unknown
  ) {
    super(`Meter Public API request failed before receiving a response: ${path}`, { cause });
    this.name = "MeterNetworkError";
  }
}

export class MeterTimeoutError extends MeterNetworkError {
  constructor(path: string, public readonly timeoutMs: number, cause?: unknown) {
    super(path, cause);
    this.message = `Meter Public API request timed out after ${timeoutMs}ms: ${path}`;
    this.name = "MeterTimeoutError";
  }
}

/**
 * Thrown by meterToolCall/withUsage when the protected work succeeded but the
 * usage commit could not be recorded. Carries the tool result and the requestId
 * so the caller can keep the (possibly expensive) result and re-commit later:
 * commit is idempotent server-side, keyed on requestId.
 */
export class MeterCommitFailedError<T = unknown> extends Error {
  constructor(
    public readonly result: T,
    public readonly requestId: string,
    cause: unknown
  ) {
    super(
      `Meter commit failed for request ${requestId}; the tool result is preserved on this error for a later re-commit`,
      { cause }
    );
    this.name = "MeterCommitFailedError";
  }
}

const COMMIT_MAX_ATTEMPTS = 3;
const COMMIT_RETRY_BASE_DELAY_MS = 100;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type RequestOptions = {
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
};

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Meter baseUrl must be an absolute HTTP(S) URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Meter baseUrl must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("Meter baseUrl cannot include credentials, query parameters, or a fragment");
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizeTimeout(value: number | undefined): number {
  const timeout = value ?? 15_000;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError("Meter timeoutMs must be a positive number");
  }
  return timeout;
}

export class MeterPublicApiClient {
  private readonly baseUrl: string;
  private readonly serviceId: string;
  private readonly serviceApiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultOrigin?: string;
  private readonly timeoutMs: number;

  constructor(options: MeterPublicApiClientOptions) {
    if (!options.serviceId.trim()) throw new TypeError("Meter serviceId is required");
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.serviceId = options.serviceId;
    this.serviceApiKey = options.serviceApiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultOrigin = options.defaultOrigin;
    this.timeoutMs = normalizeTimeout(options.timeoutMs);
  }

  async openApi<T = unknown>(): Promise<T> {
    return this.request<T>("/api/v1/openapi.json", { auth: false });
  }

  async health<T = unknown>(): Promise<T> {
    return this.request<T>("/api/v1/health", {
      query: { serviceId: this.serviceId },
    });
  }

  async listServices(): Promise<{ services: MeterService[] }> {
    return this.request("/api/v1/services", { auth: false });
  }

  async updateService(input: Partial<Omit<MeterService, "id">>): Promise<{
    service: MeterService;
  }> {
    return this.request(this.servicePath(""), { method: "PUT", body: input });
  }

  async listApiKeys(): Promise<{ service: MeterService; apiKeys: MeterServiceApiKey[] }> {
    return this.request(this.servicePath("/api-keys"));
  }

  async getIntegration(): Promise<{
    service: MeterService;
    integration: MeterServiceIntegration | null;
    gatewayUrl: string;
  }> {
    return this.request(this.servicePath("/integration"));
  }

  async updateIntegration(input: MeterIntegrationUpdate): Promise<{
    service: MeterService;
    integration: MeterServiceIntegration;
    gatewayUrl: string;
  }> {
    return this.request(this.servicePath("/integration"), {
      method: "PUT",
      body: { ...input },
    });
  }

  async listAiModelPrices(): Promise<{ service: MeterService; prices: MeterAiModelPrice[] }> {
    return this.request(this.servicePath("/ai-model-prices"));
  }

  async upsertAiModelPrice(input: {
    provider: string;
    model: string;
    version: string;
    pricing: import("./ai-cost.js").MeterAiTokenPricing;
    effectiveFrom?: number;
  }): Promise<{ service: MeterService; price: MeterAiModelPrice; prices: MeterAiModelPrice[] }> {
    return this.request(this.servicePath("/ai-model-prices"), { method: "PUT", body: input });
  }

  async listWebhookEndpoints(limit?: number): Promise<{
    service: MeterService;
    endpoints: MeterWebhookEndpoint[];
    deliveries: MeterWebhookDelivery[];
  }> {
    return this.request(this.servicePath("/webhook-endpoints"), { query: { limit } });
  }

  async createWebhookEndpoint(input: {
    url?: string;
    events?: string[];
    mode?: MeterWebhookEndpointMode;
  }): Promise<{
    service: MeterService;
    endpoint: MeterWebhookEndpoint;
    signingSecret: string;
  }> {
    return this.request(this.servicePath("/webhook-endpoints"), {
      method: "POST",
      body: { ...input },
    });
  }

  async disableWebhookEndpoint(endpointId: string): Promise<void> {
    await this.request(
      `${this.servicePath("/webhook-endpoints")}/${encodeURIComponent(endpointId)}`,
      { method: "DELETE" }
    );
  }

  async pollWebhookDeliveries(
    endpointId: string,
    options: { wait?: number; limit?: number } = {}
  ): Promise<{ deliveries: MeterPolledWebhookDelivery[] }> {
    return this.request(
      this.servicePath(
        `/webhook-endpoints/${encodeURIComponent(endpointId)}/deliveries/pending`
      ),
      { query: { wait: options.wait, limit: options.limit } }
    );
  }

  async ackWebhookDeliveries(
    endpointId: string,
    ids: string[]
  ): Promise<{ acknowledged: number }> {
    return this.request(
      this.servicePath(`/webhook-endpoints/${encodeURIComponent(endpointId)}/deliveries/ack`),
      { method: "POST", body: { ids } }
    );
  }

  async testWebhooks(): Promise<{
    eventId: string;
    deliveryCount: number;
    delivery: { processed: number; delivered: number; failed: number };
  }> {
    return this.request(this.servicePath("/webhook-endpoints/test"), { method: "POST" });
  }

  async createApiKey(name?: string): Promise<{
    service: MeterService;
    apiKey: MeterCreatedServiceApiKey;
  }> {
    return this.request(this.servicePath("/api-keys"), {
      method: "POST",
      body: name ? { name } : {},
    });
  }

  async revokeApiKey(keyId: string): Promise<{
    service: MeterService;
    apiKeys: MeterServiceApiKey[];
  }> {
    return this.request(`${this.servicePath("/api-keys")}/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
    });
  }

  async upsertCustomer(input: {
    customerLocalId: string;
    localId?: string;
    name?: string;
    email?: string;
    apiKey?: string;
    stripeCustomerId?: string;
    initialCredits?: number;
    autoRechargeEnabled?: boolean;
    rechargeThresholdCredits?: number;
    rechargeAmountCredits?: number;
    // The buyer API key is returned ONLY when a customer is first created. On any
    // subsequent (idempotent) upsert of an existing customer the server omits it,
    // so callers must treat apiKey as possibly-absent and persist it on creation.
  }): Promise<MeterCustomerAccountEnvelope & { apiKey?: string }> {
    return this.request(this.servicePath("/customers"), { method: "POST", body: input });
  }

  async listCustomers(
    limit?: number
  ): Promise<{ service: MeterService; customers: MeterCreditAccount[] }> {
    return this.request(this.servicePath("/customers"), { query: { limit } });
  }

  async getCustomerCredits(customerLocalId: string): Promise<MeterCustomerAccountEnvelope> {
    return this.request(this.customerPath(customerLocalId, "/credits"));
  }

  async getCustomerLedger(
    customerLocalId: string,
    limit?: number
  ): Promise<MeterCustomerAccountEnvelope & { ledger: MeterCreditLedgerEntry[] }> {
    return this.request(this.customerPath(customerLocalId, "/ledger"), {
      query: { limit },
    });
  }

  async setCustomerStatus(
    customerLocalId: string,
    status: "active" | "suspended"
  ): Promise<MeterCustomerAccountEnvelope> {
    return this.request(this.customerPath(customerLocalId, "/status"), {
      method: "PATCH",
      body: { status },
    });
  }

  async setAutoRecharge(
    customerLocalId: string,
    input: {
      enabled: boolean;
      thresholdCredits: number;
      amountCredits: number;
    }
  ): Promise<MeterCustomerAccountEnvelope> {
    return this.request(this.customerPath(customerLocalId, "/auto-recharge"), {
      method: "PATCH",
      body: input,
    });
  }

  async createCreditAdjustment(
    customerLocalId: string,
    input: {
      creditsDelta: number;
      idempotencyKey: string;
      type?: "adjustment" | "refund";
      note?: string;
    }
  ): Promise<
    MeterCustomerAccountEnvelope & {
      adjustment: {
        creditsDelta: number;
        type: "adjustment" | "refund";
        idempotencyKey: string;
      };
    }
  > {
    return this.request(this.customerPath(customerLocalId, "/credit-adjustments"), {
      method: "POST",
      body: input,
    });
  }

  async createTopUp(
    customerLocalId: string,
    input: { credits: number; origin?: string; returnUrl?: string }
  ): Promise<MeterTopUpResponse> {
    return this.request(this.customerPath(customerLocalId, "/top-up"), {
      method: "POST",
      body: this.withDefaultOrigin(input),
    });
  }

  async createPortalSession(
    customerLocalId: string,
    input: { ttlSeconds?: number; origin?: string } = {}
  ): Promise<MeterPortalSessionResponse> {
    return this.request(this.customerPath(customerLocalId, "/portal-session"), {
      method: "POST",
      body: this.withDefaultOrigin(input),
    });
  }

  async createOperatorSession(input: {
    externalSubject: string;
    email: string;
    displayName?: string;
    role?: "owner" | "billing_admin" | "analyst";
    origin?: string;
  }): Promise<{
    consoleUrl: string;
    expiresAt: number;
    membership: {
      operatorId: string;
      serviceId: string;
      email: string;
      displayName?: string;
      role: "owner" | "billing_admin" | "analyst";
      membershipStatus: "active" | "revoked";
    };
  }> {
    return this.request("/api/auth/operator/session", {
      method: "POST",
      body: this.withServiceId(this.withDefaultOrigin(input)),
    });
  }

  async listReservations(input: {
    limit?: number;
    status?: "held" | "committed" | "released";
    customerLocalId?: string;
  } = {}): Promise<{
    service: MeterService;
    reservations: MeterCreditReservation[];
    expiredReservationsReleased: number;
  }> {
    return this.request(this.servicePath("/reservations"), { query: input });
  }

  async releaseExpiredReservations(limit?: number): Promise<{
    service: MeterService;
    releasedCount: number;
    reservations: MeterCreditReservation[];
  }> {
    return this.request(this.servicePath("/reservations/release-expired"), {
      method: "POST",
      body: limit ? { limit } : {},
    });
  }

  async authorize(
    input: MeterToolCall & { reservationTtlMs?: number }
  ): Promise<MeterAuthorizeResponse> {
    return this.request("/api/v1/meter/authorize", {
      method: "POST",
      body: this.withServiceId(input),
    });
  }

  async commit(input: MeterToolCall): Promise<MeterCommitResponse> {
    return this.request("/api/v1/meter/commit", {
      method: "POST",
      body: this.withServiceId(input),
    });
  }

  async release(input: {
    customerLocalId: string;
    requestId: string;
    reason?: string;
  }): Promise<MeterReleaseResponse> {
    return this.request("/api/v1/meter/release", {
      method: "POST",
      body: this.withServiceId(input),
    });
  }

  async meterToolCall<T>(
    input: MeterToolCall & { reservationTtlMs?: number },
    run: () => Promise<T> | T,
    options: { aiUsage?: MeterAiUsageInput | ((result: T) => MeterAiUsageInput | Promise<MeterAiUsageInput>) } = {}
  ): Promise<T> {
    const usage = { ...input, requestId: input.requestId ?? crypto.randomUUID() };
    await this.authorize(usage);
    let result: T;
    try {
      result = await run();
    } catch (err) {
      await this.release({
        customerLocalId: usage.customerLocalId,
        requestId: usage.requestId,
        reason: err instanceof Error ? err.message : "protected work failed",
      }).catch(() => undefined);
      throw err;
    }
    const aiUsage = typeof options.aiUsage === "function" ? await options.aiUsage(result) : options.aiUsage;
    // Commit is idempotent server-side (keyed on requestId, duplicate commits are
    // flagged, not double-charged), so transient network/5xx failures are safe to
    // retry. Without retries the caller would lose the successful result while the
    // reservation stays held until TTL and the usage goes unrecorded.
    const commitInput = { ...usage, aiUsage: aiUsage ?? usage.aiUsage };
    let commitError: unknown;
    for (let attempt = 1; attempt <= COMMIT_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) await sleep(COMMIT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 2));
      try {
        await this.commit(commitInput);
        return result;
      } catch (error) {
        commitError = error;
        // A 4xx means the commit itself is invalid; retrying cannot succeed.
        if (error instanceof MeterPublicApiError && error.status < 500) break;
      }
    }
    throw new MeterCommitFailedError(result, usage.requestId, commitError);
  }

  async withUsage<T>(
    input: MeterToolCall & { reservationTtlMs?: number },
    run: () => Promise<T> | T,
    options: { aiUsage?: MeterAiUsageInput | ((result: T) => MeterAiUsageInput | Promise<MeterAiUsageInput>) } = {}
  ): Promise<T> {
    return this.meterToolCall(input, run, options);
  }

  async usage(limit?: number): Promise<MeterUsageReport> {
    return this.request(this.servicePath("/usage"), { query: { limit } });
  }

  async auditLogs(limit?: number): Promise<{
    service: MeterService;
    auditLogs: MeterServiceApiAuditLog[];
  }> {
    return this.request(this.servicePath("/audit-logs"), { query: { limit } });
  }

  private servicePath(suffix: string): string {
    return `/api/v1/services/${encodeURIComponent(this.serviceId)}${suffix}`;
  }

  private customerPath(customerLocalId: string, suffix: string): string {
    return `${this.servicePath("/customers")}/${encodeURIComponent(customerLocalId)}${suffix}`;
  }

  private withServiceId<T extends Record<string, unknown>>(input: T): T & { serviceId: string } {
    return { ...input, serviceId: this.serviceId };
  }

  private withDefaultOrigin<T extends Record<string, unknown>>(input: T): T {
    if (!this.defaultOrigin || "origin" in input) return input;
    return { ...input, origin: this.defaultOrigin };
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { accept: "application/json" };
    if (options.auth !== false && this.serviceApiKey) {
      headers.authorization = `Bearer ${this.serviceApiKey}`;
    }
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      // Keep the timeout armed through the body read: a server that returns headers
      // promptly but streams the body slowly would otherwise hang indefinitely.
      text = await res.text();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new MeterTimeoutError(path, this.timeoutMs, error);
      }
      throw new MeterNetworkError(path, error);
    } finally {
      clearTimeout(timeout);
    }
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    if (!res.ok) {
      const retryAfterRaw = res.headers.get("retry-after");
      const retryAfterSeconds =
        retryAfterRaw && Number.isFinite(Number(retryAfterRaw))
          ? Number(retryAfterRaw)
          : undefined;
      throw new MeterPublicApiError(
        res.status,
        path,
        body,
        res.headers.get("x-request-id") ?? undefined,
        retryAfterSeconds
      );
    }
    return body as T;
  }
}

export class MeterOnboardingClient {
  private readonly baseUrl: string;
  private readonly onboardingApiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: {
    baseUrl: string;
    onboardingApiKey: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!options.onboardingApiKey.trim()) {
      throw new TypeError("Meter onboardingApiKey is required");
    }
    this.onboardingApiKey = options.onboardingApiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = normalizeTimeout(options.timeoutMs);
  }

  async createService(input: {
    serviceId?: string;
    slug: string;
    name: string;
    creditName?: string;
    brandColor?: string;
    supportEmail?: string;
    termsUrl?: string;
    privacyUrl?: string;
    integration?: MeterIntegrationUpdate;
  }): Promise<{
    service: MeterService;
    apiKey: { id: string; name: string; last4: string; secret: string };
    integration: MeterServiceIntegration | null;
  }> {
    const path = "/api/onboarding/v1/services";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.onboardingApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      // Keep the timeout armed through the body read (see MeterPublicApiClient.request).
      text = await response.text();
    } catch (error) {
      if (controller.signal.aborted) throw new MeterTimeoutError(path, this.timeoutMs, error);
      throw new MeterNetworkError(path, error);
    } finally {
      clearTimeout(timeout);
    }
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    if (!response.ok) {
      throw new MeterPublicApiError(
        response.status,
        path,
        body,
        response.headers.get("x-request-id") ?? undefined
      );
    }
    return body as {
      service: MeterService;
      apiKey: { id: string; name: string; last4: string; secret: string };
      integration: MeterServiceIntegration | null;
    };
  }
}
