import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/payment-modes";

const mockModes = [
  { id: "pm-1", tenantId: "tenant-1", name: "UPI", code: "UPI", status: "ACTIVE", gatewayId: "gw-1", gatewayName: "Razorpay Main", routingPriority: 1, createdAt: "2026-04-17T00:00:00Z" },
  { id: "pm-2", tenantId: "tenant-1", name: "Credit Card", code: "CARD", status: "ACTIVE", gatewayId: "gw-1", gatewayName: "Razorpay Main", routingPriority: 2, createdAt: "2026-04-17T00:00:00Z" },
];

export const paymentModesHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockModes })),

  http.post(BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `pm-${Date.now()}`, tenantId: "tenant-1", ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const mode = mockModes.find((m) => m.id === params["id"]);
    return mode ? HttpResponse.json(mode) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Payment mode not found" } }, { status: 404 });
  }),

  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const mode = mockModes.find((m) => m.id === params["id"]);
    return mode ? HttpResponse.json({ ...mode, ...body }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Payment mode not found" } }, { status: 404 });
  }),

  http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })),

  http.patch(`${BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const mode = mockModes.find((m) => m.id === params["id"]);
    return mode ? HttpResponse.json({ ...mode, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Payment mode not found" } }, { status: 404 });
  }),
];
