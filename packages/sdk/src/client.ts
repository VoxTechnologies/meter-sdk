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

export type MeterWebhookEndpoint = {
  id: string;
  serviceId: string;
  url: string;
  events: string[];
  status: "active" | "disabled";
  createdAt: number;
  updatedAt: number;
};

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

export type MeterUsageReport = {
  service: MeterService;
  creditUsd: number;
  byCustomer: MeterUsageRollup[];
  byTool: MeterUsageRollup[];
  byProduct: MeterUsageRollup[];
  revenueShare: MeterUsageRollup[];
  recent: MeterUsageEvent[];
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
  quote: MeterToolCall & { serviceId?: string; provider: string; credits: number };
  balanceCredits: number;
  reservation?: MeterCreditReservation;
};

export type MeterCommitResponse = {
  committed: true;
  duplicate: boolean;
  service: MeterService;
  event: MeterUsageEvent;
  balanceCredits: number;
  reservation?: MeterCreditReservation;
};

export type MeterReleaseResponse = {
  released: boolean;
  service: MeterService;
  customer: { serviceId: string; localId: string; name: string };
  reservation?: MeterCreditReservation;
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
    public readonly requestId?: string
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

  async listWebhookEndpoints(limit?: number): Promise<{
    service: MeterService;
    endpoints: MeterWebhookEndpoint[];
    deliveries: MeterWebhookDelivery[];
  }> {
    return this.request(this.servicePath("/webhook-endpoints"), { query: { limit } });
  }

  async createWebhookEndpoint(input: {
    url: string;
    events?: string[];
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
  }): Promise<MeterCustomerAccountEnvelope & { apiKey: string }> {
    return this.request(this.servicePath("/customers"), { method: "POST", body: input });
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
    run: () => Promise<T> | T
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
    await this.commit(usage);
    return result;
  }

  async withUsage<T>(
    input: MeterToolCall & { reservationTtlMs?: number },
    run: () => Promise<T> | T
  ): Promise<T> {
    return this.meterToolCall(input, run);
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
    try {
      res = await this.fetchImpl(url.toString(), {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new MeterTimeoutError(path, this.timeoutMs, error);
      }
      throw new MeterNetworkError(path, error);
    } finally {
      clearTimeout(timeout);
    }
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    if (!res.ok) {
      throw new MeterPublicApiError(
        res.status,
        path,
        body,
        res.headers.get("x-request-id") ?? undefined
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
    } catch (error) {
      if (controller.signal.aborted) throw new MeterTimeoutError(path, this.timeoutMs, error);
      throw new MeterNetworkError(path, error);
    } finally {
      clearTimeout(timeout);
    }
    const text = await response.text();
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
