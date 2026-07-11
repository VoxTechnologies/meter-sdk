import { createBuyerPortalRedirectHandler } from "@meter/adapters";
import { MeterPublicApiClient } from "@meter/sdk";

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
});

export const GET = createBuyerPortalRedirectHandler({
  meter,
  authenticate: async (request) => {
    const userId = request.headers.get("x-authenticated-user-id");
    return userId ? { id: userId } : null;
  },
});
