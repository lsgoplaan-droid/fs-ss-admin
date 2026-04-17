import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/users";

const mockUsers = [
  { id: "u-1", email: "ops@tenant.test", name: "Ops Manager", roleId: "role-2", roleName: "Operations", status: "ACTIVE", lastLoginAt: null, mustResetPassword: false, twoFactorEnabled: false, createdAt: "2026-04-17T00:00:00Z" },
];

export const tenantUsersHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockUsers, total: 1, planLimit: 10 })),
  http.post(BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: `u-${Date.now()}`, ...body, status: "ACTIVE", mustResetPassword: true, twoFactorEnabled: false, createdAt: new Date().toISOString() }, { status: 201 });
  }),
  http.get(`${BASE}/:id`, ({ params }) => HttpResponse.json(mockUsers.find((u) => u.id === params["id"]) ?? { error: { code: "NOT_FOUND", message: "User not found" } })),
  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const u = mockUsers.find((u) => u.id === params["id"]);
    return u ? HttpResponse.json({ ...u, ...body }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
  }),
  http.patch(`${BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const u = mockUsers.find((u) => u.id === params["id"]);
    return u ? HttpResponse.json({ ...u, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
  }),
];
