import { http, HttpResponse } from "msw";

const BASE = "/api/platform/audit-logs";

const mockLogs = [
  { id: "pal-1", actorUserId: "platform-user-1", actorName: "Platform Admin", tenantId: null, action: "TENANT_CREATED", entityType: "TENANT", entityId: "tenant-1", metadata: {}, ipAddress: "127.0.0.1", userAgent: "Mozilla/5.0", timestamp: "2026-04-17T00:00:00Z" },
  { id: "pal-2", actorUserId: "platform-user-1", actorName: "Platform Admin", tenantId: "tenant-1", action: "IMPERSONATION_STARTED", entityType: "TENANT", entityId: "tenant-1", metadata: {}, ipAddress: "127.0.0.1", userAgent: "Mozilla/5.0", timestamp: "2026-04-17T01:00:00Z" },
];

export const platformAuditHandlers = [
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const items = cursor ? [] : mockLogs.slice(0, limit);
    return HttpResponse.json({ items, nextCursor: null, total: mockLogs.length });
  }),
];
