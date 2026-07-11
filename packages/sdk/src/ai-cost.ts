export type MeterAiCostSource = "reported" | "calculated" | "unpriced";

export type MeterAiTokenPricing = {
  inputPerMillionUsd?: number;
  outputPerMillionUsd?: number;
  cachedInputPerMillionUsd?: number;
  reasoningPerMillionUsd?: number;
  requestUsd?: number;
  version?: string;
};

export type MeterAiUsageInput = {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  requests?: number;
  costUsd?: number;
  pricing?: MeterAiTokenPricing;
  providerRequestId?: string;
};

export type MeterAiUsage = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  requests: number;
  costMicrousd?: number;
  costUsd?: number;
  costSource: MeterAiCostSource;
  pricing?: MeterAiTokenPricing;
  providerRequestId?: string;
};

const tokenCount = (value: number | undefined, name: string, fallback = 0) => {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
};

const money = (value: number | undefined, name: string) => {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`);
  return value;
};

export function calculateMeterAiUsage(input: MeterAiUsageInput): MeterAiUsage {
  const provider = input.provider.trim();
  const model = input.model.trim();
  if (!provider) throw new TypeError("provider is required");
  if (!model) throw new TypeError("model is required");
  if (provider.length > 100 || model.length > 200) throw new TypeError("provider or model is too long");
  const inputTokens = tokenCount(input.inputTokens, "inputTokens");
  const outputTokens = tokenCount(input.outputTokens, "outputTokens");
  const cachedInputTokens = tokenCount(input.cachedInputTokens, "cachedInputTokens");
  const reasoningTokens = tokenCount(input.reasoningTokens, "reasoningTokens");
  const requests = tokenCount(input.requests, "requests", 1);
  const reported = money(input.costUsd, "costUsd");
  let costMicrousd: number | undefined;
  let costSource: MeterAiCostSource = "unpriced";
  if (reported !== undefined) {
    costMicrousd = Math.round(reported * 1_000_000);
    costSource = "reported";
  } else if (input.pricing) {
    const inputRate = money(input.pricing.inputPerMillionUsd, "inputPerMillionUsd") ?? 0;
    const outputRate = money(input.pricing.outputPerMillionUsd, "outputPerMillionUsd") ?? 0;
    costMicrousd = Math.round(
      inputTokens * inputRate +
      outputTokens * outputRate +
      cachedInputTokens * (money(input.pricing.cachedInputPerMillionUsd, "cachedInputPerMillionUsd") ?? inputRate) +
      reasoningTokens * (money(input.pricing.reasoningPerMillionUsd, "reasoningPerMillionUsd") ?? outputRate) +
      requests * (money(input.pricing.requestUsd, "requestUsd") ?? 0) * 1_000_000
    );
    costSource = "calculated";
  }
  if (costMicrousd !== undefined && (!Number.isSafeInteger(costMicrousd) || costMicrousd < 0)) {
    throw new TypeError("AI cost exceeds the supported range");
  }
  return {
    provider,
    model,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    totalTokens: inputTokens + outputTokens + cachedInputTokens + reasoningTokens,
    requests,
    costMicrousd,
    costUsd: costMicrousd === undefined ? undefined : costMicrousd / 1_000_000,
    costSource,
    pricing: input.pricing,
    providerRequestId: input.providerRequestId,
  };
}
