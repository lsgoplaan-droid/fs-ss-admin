import { http, HttpResponse } from "msw";

const BASE = "/api/platform/tenants";

const mockTenants = [
  { id: "tenant-1", name: "Matrix Emart", slug: "matrix-emart", status: "ACTIVE", planId: "plan-pro", planName: "Pro", onboardingComplete: true, createdAt: "2026-04-17T00:00:00Z" },
  { id: "tenant-2", name: "Acme Corp", slug: "acme-corp", status: "ACTIVE", planId: "plan-starter", planName: "Starter", onboardingComplete: false, createdAt: "2026-04-15T00:00:00Z" },
];

export const platformTenantsHandlers = [
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    return HttpResponse.json({ items: mockTenants, total: mockTenants.length, page, limit });
  }),

  http.post(BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `tenant-${Date.now()}`, status: "ACTIVE", onboardingComplete: false, ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const tenant = mockTenants.find((t) => t.id === params["id"]);
    return tenant ? HttpResponse.json(tenant) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, { status: 404 });
  }),

  http.patch(`${BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const tenant = mockTenants.find((t) => t.id === params["id"]);
    return tenant ? HttpResponse.json({ ...tenant, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, { status: 404 });
  }),

  http.post(`${BASE}/:id/impersonate`, ({ params }) => {
    const tenant = mockTenants.find((t) => t.id === params["id"]);
    if (!tenant) return HttpResponse.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, { status: 404 });
    if (!tenant.onboardingComplete) {
      return HttpResponse.json({ error: { code: "ONBOARDING_INCOMPLETE", message: "Tenant onboarding is not complete" } }, { status: 422 });
    }
    return HttpResponse.json({
      user: { id: "tenant-user-1", email: "admin@tenant.test", name: "Tenant Admin", role: "tenant_admin", tenantId: params["id"], permissions: [] },
      requiresPasswordReset: false, requiresTwoFactor: false, concurrentSessionWarning: false,
    });
  }),
];
