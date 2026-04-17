import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/broadcasts";

const mockBroadcasts = [
  { id: "bc-1", title: "Platform Maintenance", body: "Scheduled downtime on April 20 from 2–4 AM IST.", priority: "HIGH", status: "ACTIVE", readAt: null, createdAt: "2026-04-17T00:00:00Z" },
  { id: "bc-2", title: "New Feature: Gateway Test", body: "You can now test payment gateways from the settings page.", priority: "NORMAL", status: "ACTIVE", readAt: null, createdAt: "2026-04-16T00:00:00Z" },
];

export const broadcastsHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockBroadcasts, unreadCount: 2 })),

  http.patch(`${BASE}/:id/read`, ({ params }) => {
    const bc = mockBroadcasts.find((b) => b.id === params["id"]);
    return bc
      ? HttpResponse.json({ ...bc, readAt: new Date().toISOString() })
      : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Broadcast not found" } }, { status: 404 });
  }),
];
