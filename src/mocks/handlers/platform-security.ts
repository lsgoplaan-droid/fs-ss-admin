import { http, HttpResponse } from "msw";

const SESSIONS_BASE = "/api/platform/security/sessions";
const API_KEYS_BASE = "/api/platform/security/api-keys";

const mockSessions = [
  { userId: "tenant-user-1", userEmail: "admin@tenant.test", tenantId: "tenant-1", sessionId: "sess-abc123", ipAddress: "192.168.1.10", userAgent: "Chrome/120", createdAt: "2026-04-17T00:00:00Z", lastSeenAt: "2026-04-17T01:00:00Z" },
];

const mockApiKeys = [
  { id: "ak-1", name: "CI Integration", keyPrefix: "sk_live_xxxx", status: "ACTIVE", lastUsedAt: null, createdAt: "2026-04-17T00:00:00Z" },
];

export const platformSecurityHandlers = [
  http.get(SESSIONS_BASE, () => HttpResponse.json({ items: mockSessions, total: 1 })),

  http.delete(`${SESSIONS_BASE}/:userId`, () => new HttpResponse(null, { status: 204 })),

  http.get(API_KEYS_BASE, () => HttpResponse.json({ items: mockApiKeys })),

  http.post(API_KEYS_BASE, async ({ request }) => {
    const { name } = await request.json() as { name: string };
    const created = { id: `ak-${Date.now()}`, name, keyPrefix: "sk_live_mock", status: "ACTIVE", lastUsedAt: null, createdAt: new Date().toISOString() };
    // Return full key only on creation
    return HttpResponse.json({ ...created, key: `sk_live_mock_${Date.now()}` }, { status: 201 });
  }),

  http.delete(`${API_KEYS_BASE}/:id`, () => new HttpResponse(null, { status: 204 })),
];
