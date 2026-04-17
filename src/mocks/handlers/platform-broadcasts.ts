import { http, HttpResponse } from "msw";

const BASE = "/api/platform/broadcasts";

const mockBroadcasts = [
  { id: "pbc-1", title: "Platform Maintenance", body: "Scheduled downtime on April 20 from 2–4 AM IST.", priority: "HIGH", status: "ACTIVE", targetAll: true, targetTenantIds: [], createdByUserId: "platform-user-1", createdAt: "2026-04-17T00:00:00Z" },
];

export const platformBroadcastsHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockBroadcasts, total: 1 })),

  http.post(BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `pbc-${Date.now()}`, status: "ACTIVE", createdByUserId: "platform-user-1", ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const bc = mockBroadcasts.find((b) => b.id === params["id"]);
    return bc ? HttpResponse.json(bc) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Broadcast not found" } }, { status: 404 });
  }),

  http.patch(`${BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const bc = mockBroadcasts.find((b) => b.id === params["id"]);
    return bc ? HttpResponse.json({ ...bc, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Broadcast not found" } }, { status: 404 });
  }),
];
