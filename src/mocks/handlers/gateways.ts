import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/payment-gateways";

const mockGateways = [
  { id: "gw-1", tenantId: "tenant-1", name: "Razorpay Main", provider: "RAZORPAY", apiKey: "rzp_test_xxx", mode: "TEST", status: "ACTIVE", routingPriority: 1, logoUrl: null, createdAt: "2026-04-17T00:00:00Z" },
];

export const gatewaysHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockGateways, planLimit: 3 })),

  http.post(BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `gw-${Date.now()}`, tenantId: "tenant-1", ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const gw = mockGateways.find((g) => g.id === params["id"]);
    return gw ? HttpResponse.json(gw) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Gateway not found" } }, { status: 404 });
  }),

  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const gw = mockGateways.find((g) => g.id === params["id"]);
    return gw ? HttpResponse.json({ ...gw, ...body }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Gateway not found" } }, { status: 404 });
  }),

  http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })),

  // Test connection — Razorpay/Cashfree succeed, Juspay returns 501
  http.post(`${BASE}/:id/test`, ({ params }) => {
    const gw = mockGateways.find((g) => g.id === params["id"]);
    if (!gw) return HttpResponse.json({ error: { code: "NOT_FOUND", message: "Gateway not found" } }, { status: 404 });
    if (gw.provider === "JUSPAY") {
      return HttpResponse.json({ error: { code: "NOT_IMPLEMENTED", message: "Gateway test for JUSPAY is available in Phase 1.5" } }, { status: 501 });
    }
    return HttpResponse.json({ ok: true, message: "Connected successfully" });
  }),

  http.patch(`${BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const gw = mockGateways.find((g) => g.id === params["id"]);
    return gw ? HttpResponse.json({ ...gw, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Gateway not found" } }, { status: 404 });
  }),
];
