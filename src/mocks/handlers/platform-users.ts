import { http, HttpResponse } from "msw";

const BASE = "/api/platform/users";

const mockPlatformUsers = [
  { id: "platform-user-1", email: "admin@platform.test", name: "Platform Admin", role: "platform_admin", status: "ACTIVE", twoFactorEnabled: false, lastLoginAt: null, createdAt: "2026-04-17T00:00:00Z" },
];

export const platformUsersHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockPlatformUsers, total: 1 })),

  http.post(BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `platform-user-${Date.now()}`, status: "ACTIVE", twoFactorEnabled: false, lastLoginAt: null, ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const user = mockPlatformUsers.find((u) => u.id === params["id"]);
    return user ? HttpResponse.json(user) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
  }),

  http.patch(`${BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const user = mockPlatformUsers.find((u) => u.id === params["id"]);
    return user ? HttpResponse.json({ ...user, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
  }),
];
