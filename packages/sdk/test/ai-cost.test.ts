import assert from "node:assert/strict";
import test from "node:test";
import { calculateMeterAiUsage } from "../src/index.js";

test("calculates micro-USD cost from explicit versioned token rates", () => {
  const usage = calculateMeterAiUsage({
    provider: "example-ai",
    model: "model-1",
    inputTokens: 1_000,
    outputTokens: 500,
    cachedInputTokens: 200,
    reasoningTokens: 100,
    pricing: {
      inputPerMillionUsd: 2,
      outputPerMillionUsd: 8,
      cachedInputPerMillionUsd: 0.5,
      reasoningPerMillionUsd: 8,
      requestUsd: 0.001,
      version: "2026-07-11",
    },
  });
  assert.equal(usage.totalTokens, 1_800);
  assert.equal(usage.costMicrousd, 7_900);
  assert.equal(usage.costUsd, 0.0079);
  assert.equal(usage.costSource, "calculated");
});

test("keeps unpriced usage distinct from a measured zero cost", () => {
  const unpriced = calculateMeterAiUsage({ provider: "local", model: "search", inputTokens: 5 });
  const free = calculateMeterAiUsage({ provider: "local", model: "search", inputTokens: 5, costUsd: 0 });
  assert.equal(unpriced.costMicrousd, undefined);
  assert.equal(unpriced.costSource, "unpriced");
  assert.equal(free.costMicrousd, 0);
  assert.equal(free.costSource, "reported");
});
