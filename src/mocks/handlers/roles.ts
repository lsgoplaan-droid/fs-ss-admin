import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/roles";

const mockRoles = [
  { id: "role-1", tenantId: "tenant-1", name: "Super Admin", status: "ACTIVE", createdAt: "2026-04-17T00:00:00Z", permissions: ["roles.view", "roles.create"] },
  { id: "role-2", tenantId: "tenant-1", name: "Operations", status: "ACTIVE", createdAt: "2026-04-17T00:00:00Z", permissions: ["gateways.view"] },
];

export const rolesHandlers = [
  http.get(BASE, () => HttpResponse.json({ items: mockRoles })),

  http.post(BASE, async ({ request }) => {
    const body = await request.json() as { name: string };
    if (mockRoles.some((r) => r.name === body.name)) {
      return HttpResponse.json(
        { error: { code: "DUPLICATE_ROLE_NAME", message: "A role with this name already exists", field: "name" } },
        { status: 409 }
      );
    }
    const created = { id: `role-${Date.now()}`, tenantId: "tenant-1", name: body.name, status: "ACTIVE", createdAt: new Date().toISOString(), permissions: [] };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${BASE}/:roleId`, ({ params }) =>
    HttpResponse.json(mockRoles.find((r) => r.id === params["roleId"]) ?? { error: { code: "NOT_FOUND", message: "Role not found" } })
  ),

  http.put(`${BASE}/:roleId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const role = mockRoles.find((r) => r.id === params["roleId"]);
    if (!role) return HttpResponse.json({ error: { code: "NOT_FOUND", message: "Role not found" } }, { status: 404 });
    return HttpResponse.json({ ...role, ...body });
  }),

  http.delete(`${BASE}/:roleId`, () => new HttpResponse(null, { status: 204 })),

  http.put(`${BASE}/:roleId/permissions`, async ({ params, request }) => {
    const { permissions } = await request.json() as { permissions: string[] };
    const role = mockRoles.find((r) => r.id === params["roleId"]);
    if (!role) return HttpResponse.json({ error: { code: "NOT_FOUND", message: "Role not found" } }, { status: 404 });
    return HttpResponse.json({ ...role, permissions });
  }),
];
