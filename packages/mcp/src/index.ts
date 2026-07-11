import {
  isMeterAccountSuspendedPayload,
  isMeterPaymentRequiredPayload,
  MeterPublicApiClient,
  MeterPublicApiError,
  type MeterToolCall,
  type MeterAiUsageInput,
} from "@meter-mcp/sdk";

export type MeteredToolContext<TInput, TExtra> = {
  input: TInput;
  extra: TExtra;
};

export type MeteredToolOptions<TInput, TExtra> = {
  customer: (context: MeteredToolContext<TInput, TExtra>) => string | Promise<string>;
  credits: number | ((context: MeteredToolContext<TInput, TExtra>) => number | Promise<number>);
  provider?: string | ((context: MeteredToolContext<TInput, TExtra>) => string | Promise<string>);
  product?: string | ((context: MeteredToolContext<TInput, TExtra>) => string | undefined | Promise<string | undefined>);
  requestId?: (context: MeteredToolContext<TInput, TExtra>) => string | undefined | Promise<string | undefined>;
  reservationTtlMs?: number;
  aiUsage?: (
    result: unknown,
    context: MeteredToolContext<TInput, TExtra>
  ) => MeterAiUsageInput | Promise<MeterAiUsageInput>;
};

export type McpPaymentRequiredResult = {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
  _meta: {
    meter: {
      error: "payment_required" | "account_suspended";
      topUpUrl?: string;
      balanceCredits?: number;
      requiredCredits?: number;
    };
  };
};

export class MeterMcpConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeterMcpConfigurationError";
  }
}

async function resolveValue<TInput, TExtra, TValue>(
  value: TValue | ((context: MeteredToolContext<TInput, TExtra>) => TValue | Promise<TValue>),
  context: MeteredToolContext<TInput, TExtra>
): Promise<TValue> {
  return typeof value === "function"
    ? (value as (context: MeteredToolContext<TInput, TExtra>) => TValue | Promise<TValue>)(context)
    : value;
}

export function paidTool<TInput, TExtra, TResult>(
  meter: MeterPublicApiClient,
  tool: string,
  options: MeteredToolOptions<TInput, TExtra>,
  handler: (input: TInput, extra: TExtra) => TResult | Promise<TResult>
): (input: TInput, extra: TExtra) => Promise<TResult> {
  return async (input, extra) => {
    const context = { input, extra };
    const customerLocalId = await options.customer(context);
    const credits = await resolveValue(options.credits, context);
    if (!customerLocalId.trim()) {
      throw new MeterMcpConfigurationError("Meter customer resolver returned an empty ID");
    }
    if (!Number.isSafeInteger(credits) || credits <= 0) {
      throw new MeterMcpConfigurationError("Meter credits must be a positive safe integer");
    }
    const providerId = options.provider
      ? await resolveValue(options.provider, context)
      : undefined;
    const productId = options.product
      ? await resolveValue(options.product, context)
      : undefined;
    const requestId =
      (options.requestId ? await options.requestId(context) : undefined) ?? crypto.randomUUID();
    const usage: MeterToolCall & { reservationTtlMs?: number } = {
      customerLocalId,
      tool,
      credits,
      providerId,
      productId,
      requestId,
      reservationTtlMs: options.reservationTtlMs,
    };
    return meter.withUsage(usage, () => handler(input, extra), {
      aiUsage: options.aiUsage
        ? async (result) => options.aiUsage!(result, context)
        : undefined,
    });
  };
}

export function meterErrorToMcpResult(error: unknown): McpPaymentRequiredResult | null {
  if (!(error instanceof MeterPublicApiError)) return null;
  if (isMeterPaymentRequiredPayload(error.body)) {
    return {
      content: [{ type: "text", text: `${error.body.message} ${error.body.topUpUrl}` }],
      isError: true,
      _meta: {
        meter: {
          error: "payment_required",
          topUpUrl: error.body.topUpUrl,
          balanceCredits: error.body.balanceCredits,
          requiredCredits: error.body.requiredCredits,
        },
      },
    };
  }
  if (isMeterAccountSuspendedPayload(error.body)) {
    return {
      content: [{ type: "text", text: error.body.message }],
      isError: true,
      _meta: { meter: { error: "account_suspended" } },
    };
  }
  return null;
}

export type McpServerLike<TInput, TExtra, TResult> = {
  registerTool(
    name: string,
    definition: Record<string, unknown>,
    handler: (input: TInput, extra: TExtra) => TResult | Promise<TResult>
  ): unknown;
};

export function registerPaidTool<TInput, TExtra, TResult>(input: {
  server: McpServerLike<TInput, TExtra, TResult | McpPaymentRequiredResult>;
  meter: MeterPublicApiClient;
  name: string;
  definition: Record<string, unknown>;
  billing: MeteredToolOptions<TInput, TExtra>;
  handler: (toolInput: TInput, extra: TExtra) => TResult | Promise<TResult>;
}): unknown {
  const wrapped = paidTool(input.meter, input.name, input.billing, input.handler);
  return input.server.registerTool(input.name, input.definition, async (toolInput, extra) => {
    try {
      return await wrapped(toolInput, extra);
    } catch (error) {
      const paymentResult = meterErrorToMcpResult(error);
      if (paymentResult) return paymentResult;
      throw error;
    }
  });
}
