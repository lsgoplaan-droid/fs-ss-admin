import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/audit-logs";

const mockLogs = [
  { id: "al-1", tenantId: "tenant-1", actorUserId: "tenant-user-1", actorName: "Tenant Admin", action: "GATEWAY_CREATED", entityType: "GATEWAY", entityId: "gw-1", metadata: {}, ipAddress: "127.0.0.1", userAgent: "Mozilla/5.0", timestamp: "2026-04-17T00:00:00Z" },
  { id: "al-2", tenantId: "tenant-1", actorUserId: "tenant-user-1", actorName: "Tenant Admin", action: "ROLE_CREATED", entityType: "ROLE", entityId: "role-1", metadata: {}, ipAddress: "127.0.0.1", userAgent: "Mozilla/5.0", timestamp: "2026-04-17T00:01:00Z" },
];

export const auditHandlers = [
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const items = cursor ? [] : mockLogs.slice(0, limit);
    return HttpResponse.json({ items, nextCursor: null, total: mockLogs.length });
  }),
];
