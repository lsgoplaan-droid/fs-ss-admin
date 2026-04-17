import { http, HttpResponse } from "msw";

const PLANS_BASE = "/api/platform/subscriptions/plans";
const TENANT_SUB_BASE = "/api/platform/tenants";

const mockPlans = [
  { id: "plan-starter", name: "Starter", maxGateways: 1, maxUsers: 5, maxMonthlyVolume: 100000, price: 0, status: "ACTIVE", createdAt: "2026-04-17T00:00:00Z" },
  { id: "plan-pro", name: "Pro", maxGateways: 3, maxUsers: 20, maxMonthlyVolume: 1000000, price: 2999, status: "ACTIVE", createdAt: "2026-04-17T00:00:00Z" },
  { id: "plan-enterprise", name: "Enterprise", maxGateways: 10, maxUsers: 100, maxMonthlyVolume: null, price: 9999, status: "ACTIVE", createdAt: "2026-04-17T00:00:00Z" },
];

export const platformSubscriptionsHandlers = [
  http.get(PLANS_BASE, () => HttpResponse.json({ items: mockPlans })),

  http.post(PLANS_BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `plan-${Date.now()}`, status: "ACTIVE", ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${PLANS_BASE}/:id`, ({ params }) => {
    const plan = mockPlans.find((p) => p.id === params["id"]);
    return plan ? HttpResponse.json(plan) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, { status: 404 });
  }),

  http.put(`${PLANS_BASE}/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const plan = mockPlans.find((p) => p.id === params["id"]);
    return plan ? HttpResponse.json({ ...plan, ...body }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, { status: 404 });
  }),

  // PATCH /api/platform/tenants/:tenantId/subscription
  http.patch(`${TENANT_SUB_BASE}/:tenantId/subscription`, async ({ params, request }) => {
    const { planId } = await request.json() as { planId: string };
    const plan = mockPlans.find((p) => p.id === planId);
    if (!plan) {
      return HttpResponse.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, { status: 404 });
    }
    return HttpResponse.json({ tenantId: params["tenantId"], planId, planName: plan.name, effectiveAt: new Date().toISOString() });
  }),
];
