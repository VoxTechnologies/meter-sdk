import {
  MeterPublicApiClient,
  calculateMeterAiUsage,
  type MeterAiTokenPricing,
  type MeterAiUsage,
} from "@meter-mcp/sdk";

export type MeterAiAdapterOptions = {
  model?: string;
  pricing?: MeterAiTokenPricing;
  costUsd?: number;
  providerRequestId?: string;
};

type UnknownRecord = Record<string, any>;

export function aiUsageFromOpenAI(response: UnknownRecord, options: MeterAiAdapterOptions = {}): MeterAiUsage {
  const usage = response.usage ?? response.response?.usage ?? {};
  const inputDetails = usage.input_tokens_details ?? usage.prompt_tokens_details ?? {};
  const outputDetails = usage.output_tokens_details ?? usage.completion_tokens_details ?? {};
  const cachedInputTokens = inputDetails.cached_tokens ?? 0;
  const rawInputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  return calculateMeterAiUsage({
    provider: "openai",
    model: options.model ?? response.model ?? response.response?.model ?? "unknown",
    inputTokens: Math.max(0, rawInputTokens - cachedInputTokens),
    outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
    cachedInputTokens,
    reasoningTokens: outputDetails.reasoning_tokens ?? 0,
    requests: 1,
    costUsd: options.costUsd,
    pricing: options.pricing,
    providerRequestId: options.providerRequestId ?? response.id ?? response.response?.id,
  });
}

export function aiUsageFromAnthropic(response: UnknownRecord, options: MeterAiAdapterOptions = {}): MeterAiUsage {
  const usage = response.usage ?? response.message?.usage ?? {};
  return calculateMeterAiUsage({
    provider: "anthropic",
    model: options.model ?? response.model ?? response.message?.model ?? "unknown",
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
    reasoningTokens: 0,
    requests: 1,
    costUsd: options.costUsd,
    pricing: options.pricing,
    providerRequestId: options.providerRequestId ?? response.id ?? response.message?.id,
  });
}

export type MeterAuthenticatedUser = {
  id: string;
  email?: string;
  displayName?: string;
};

export type MeterWebHandler = (request: Request) => Promise<Response>;

export type MeterAdapterErrorHandler = (
  error: unknown,
  context: { operation: "buyer_portal_session" | "operator_console_session"; request: Request }
) => void | Promise<void>;

function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function createBuyerPortalHandler(input: {
  meter: MeterPublicApiClient;
  authenticate: (request: Request) => Promise<MeterAuthenticatedUser | null>;
  customerId?: (user: MeterAuthenticatedUser, request: Request) => string | Promise<string>;
  ttlSeconds?: number;
  origin?: string | ((request: Request) => string);
  onError?: MeterAdapterErrorHandler;
}): MeterWebHandler {
  return async (request) => {
    const user = await input.authenticate(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    const customerLocalId = input.customerId
      ? await input.customerId(user, request)
      : user.id;
    try {
      const session = await input.meter.createPortalSession(customerLocalId, {
        ttlSeconds: input.ttlSeconds,
        origin:
          typeof input.origin === "function"
            ? input.origin(request)
            : input.origin ?? requestOrigin(request),
      });
      return Response.json(session);
    } catch (error) {
      await input.onError?.(error, { operation: "buyer_portal_session", request });
      return Response.json({ error: "meter_portal_session_failed" }, { status: 502 });
    }
  };
}

export function createOperatorConsoleHandler(input: {
  meter: MeterPublicApiClient;
  authenticate: (request: Request) => Promise<MeterAuthenticatedUser | null>;
  authorize: (user: MeterAuthenticatedUser, request: Request) => boolean | Promise<boolean>;
  role?: "owner" | "billing_admin" | "analyst" | ((user: MeterAuthenticatedUser) => "owner" | "billing_admin" | "analyst");
  origin?: string | ((request: Request) => string);
  onError?: MeterAdapterErrorHandler;
}): MeterWebHandler {
  return async (request) => {
    const user = await input.authenticate(request);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!(await input.authorize(user, request))) {
      return Response.json({ error: "meter_operator_forbidden" }, { status: 403 });
    }
    if (!user.email) {
      return Response.json({ error: "meter_operator_email_required" }, { status: 400 });
    }
    try {
      const role = typeof input.role === "function" ? input.role(user) : input.role ?? "analyst";
      const session = await input.meter.createOperatorSession({
        externalSubject: user.id,
        email: user.email,
        displayName: user.displayName,
        role,
        origin:
          typeof input.origin === "function"
            ? input.origin(request)
            : input.origin ?? requestOrigin(request),
      });
      return Response.json(session);
    } catch (error) {
      await input.onError?.(error, { operation: "operator_console_session", request });
      return Response.json({ error: "meter_operator_session_failed" }, { status: 502 });
    }
  };
}

export function createBuyerPortalRedirectHandler(
  input: Parameters<typeof createBuyerPortalHandler>[0]
): MeterWebHandler {
  const jsonHandler = createBuyerPortalHandler(input);
  return async (request) => {
    const response = await jsonHandler(request);
    if (!response.ok) return response;
    const body = (await response.json()) as { session?: { url?: string } };
    if (!body.session?.url) {
      return Response.json({ error: "meter_portal_url_missing" }, { status: 502 });
    }
    return Response.redirect(body.session.url, 303);
  };
}

export function createOperatorConsoleRedirectHandler(
  input: Parameters<typeof createOperatorConsoleHandler>[0]
): MeterWebHandler {
  const jsonHandler = createOperatorConsoleHandler(input);
  return async (request) => {
    const response = await jsonHandler(request);
    if (!response.ok) return response;
    const body = (await response.json()) as { consoleUrl?: string };
    if (!body.consoleUrl) {
      return Response.json({ error: "meter_console_url_missing" }, { status: 502 });
    }
    return Response.redirect(body.consoleUrl, 303);
  };
}

export type ExpressRequestLike = {
  protocol: string;
  originalUrl: string;
  get(name: string): string | undefined;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  body?: unknown;
};

export type ExpressResponseLike = {
  status(code: number): ExpressResponseLike;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

export function toExpressHandler(handler: MeterWebHandler) {
  return async (req: ExpressRequestLike, res: ExpressResponseLike): Promise<void> => {
    const host = req.get("host") ?? "localhost";
    const request = new Request(`${req.protocol}://${host}${req.originalUrl}`, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
          .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : value])
      ),
      body: req.method === "GET" || req.method === "HEAD" || req.body === undefined
        ? undefined
        : JSON.stringify(req.body),
    });
    const response = await handler(request);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await response.text());
  };
}
