import { test } from "node:test";
import assert from "node:assert/strict";
import { runPricesList, runPricesSet, runServicesUpdate } from "../src/commands/services.js";
import { stubContext } from "./helpers.js";

const integration = {
  serviceId: "svc",
  gatewayEnabled: true,
  toolPrices: { echo: 1, summarize: 5 },
};
const service = { id: "svc", name: "Svc", creditName: "credits" };

test("prices list joins toolPrices with the USD rate", async () => {
  const { ctx, lines } = stubContext((call) =>
    call.path.endsWith("/integration")
      ? { service, integration, gatewayUrl: "https://meter.example/g" }
      : { service, creditUsd: 0.01, byCustomer: [], byTool: [], byProduct: [], revenueShare: [], recent: [], aiCosts: {} }
  );
  await runPricesList(ctx);
  const echoLine = lines.find((line) => line.startsWith("echo"));
  assert.match(echoLine ?? "", /1/);
  assert.match(echoLine ?? "", /\$0\.01/);
});

test("prices set merges one tool into existing toolPrices", async () => {
  const { ctx, calls } = stubContext((call) =>
    call.method === "PUT"
      ? { service, integration: { ...integration, toolPrices: { echo: 1, summarize: 9 } }, gatewayUrl: "" }
      : { service, integration, gatewayUrl: "" }
  );
  await runPricesSet(ctx, "summarize", 9);
  const put = calls.find((call) => call.method === "PUT");
  assert.deepEqual((put?.body as { toolPrices: object }).toolPrices, { echo: 1, summarize: 9 });
});

test("services update sends only provided fields", async () => {
  const { ctx, calls } = stubContext(() => ({ service }));
  await runServicesUpdate(ctx, { name: "New Name" });
  assert.deepEqual(calls[0]?.body, { name: "New Name" });
  assert.equal(calls[0]?.method, "PUT");
});
