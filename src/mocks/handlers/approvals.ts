import { http, HttpResponse } from "msw";

const WF_BASE = "/api/tenant/approval-workflows";
const INST_BASE = "/api/tenant/approval-instances";

const mockWorkflows = [
  {
    id: "wf-1", tenantId: "tenant-1", name: "Gateway Activation", entityType: "GATEWAY", status: "ACTIVE", createdAt: "2026-04-17T00:00:00Z",
    levels: [
      { id: "wl-1", workflowId: "wf-1", levelNumber: 1, approverRoleId: "role-1", approverRoleName: "Super Admin", timeoutHours: 24, escalationRoleId: null },
    ],
  },
];

const mockInstances = [
  {
    id: "inst-1", tenantId: "tenant-1", workflowId: "wf-1", workflowName: "Gateway Activation", workflowVersionId: "wfv-1",
    entityType: "GATEWAY", entityId: "gw-1", status: "PENDING", currentLevel: 1, submittedByUserId: "u-1",
    submittedByName: "Ops Manager", createdAt: "2026-04-17T00:00:00Z", actions: [],
  },
];

export const approvalsHandlers = [
  http.get(WF_BASE, () => HttpResponse.json({ items: mockWorkflows })),

  http.post(WF_BASE, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const created = { id: `wf-${Date.now()}`, tenantId: "tenant-1", status: "ACTIVE", ...body, createdAt: new Date().toISOString() };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${WF_BASE}/:id`, ({ params }) => {
    const wf = mockWorkflows.find((w) => w.id === params["id"]);
    return wf ? HttpResponse.json(wf) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Workflow not found" } }, { status: 404 });
  }),

  http.put(`${WF_BASE}/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const wf = mockWorkflows.find((w) => w.id === params["id"]);
    return wf ? HttpResponse.json({ ...wf, ...body }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Workflow not found" } }, { status: 404 });
  }),

  http.delete(`${WF_BASE}/:id`, () => new HttpResponse(null, { status: 204 })),

  http.patch(`${WF_BASE}/:id/status`, async ({ params, request }) => {
    const { status } = await request.json() as { status: string };
    const wf = mockWorkflows.find((w) => w.id === params["id"]);
    return wf ? HttpResponse.json({ ...wf, status }) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Workflow not found" } }, { status: 404 });
  }),

  http.get(INST_BASE, () => HttpResponse.json({ items: mockInstances, total: 1 })),

  http.get(`${INST_BASE}/:id`, ({ params }) => {
    const inst = mockInstances.find((i) => i.id === params["id"]);
    return inst ? HttpResponse.json(inst) : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Approval instance not found" } }, { status: 404 });
  }),

  http.post(`${INST_BASE}/:id/approve`, ({ params }) => {
    const inst = mockInstances.find((i) => i.id === params["id"]);
    return inst
      ? HttpResponse.json({ ...inst, status: "APPROVED" })
      : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Approval instance not found" } }, { status: 404 });
  }),

  http.post(`${INST_BASE}/:id/reject`, ({ params }) => {
    const inst = mockInstances.find((i) => i.id === params["id"]);
    return inst
      ? HttpResponse.json({ ...inst, status: "REJECTED" })
      : HttpResponse.json({ error: { code: "NOT_FOUND", message: "Approval instance not found" } }, { status: 404 });
  }),
];
