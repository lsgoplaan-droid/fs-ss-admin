import { http, HttpResponse } from "msw";

const BASE = "/api/auth";

export const authHandlers = [
  http.post(`${BASE}/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    // Test fixture: platform admin
    if (body.email === "admin@platform.test" && body.password === "Test1234!") {
      return HttpResponse.json({
        user: {
          id: "platform-user-1",
          email: body.email,
          name: "Platform Admin",
          role: "platform_admin",
          tenantId: null,
          permissions: [],
        },
        requiresPasswordReset: false,
        requiresTwoFactor: false,
        concurrentSessionWarning: false,
      });
    }

    // Test fixture: tenant admin
    if (body.email === "admin@tenant.test" && body.password === "Test1234!") {
      return HttpResponse.json({
        user: {
          id: "tenant-user-1",
          email: body.email,
          name: "Tenant Admin",
          role: "tenant_admin",
          tenantId: "tenant-1",
          permissions: ["roles.view", "roles.create", "gateways.view", "gateways.create"],
        },
        requiresPasswordReset: false,
        requiresTwoFactor: false,
        concurrentSessionWarning: false,
      });
    }

    return HttpResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } },
      { status: 401 }
    );
  }),

  http.post(`${BASE}/refresh`, () => {
    return HttpResponse.json({
      user: { id: "tenant-user-1", email: "admin@tenant.test", name: "Tenant Admin", role: "tenant_admin", tenantId: "tenant-1", permissions: [] },
      requiresPasswordReset: false,
      requiresTwoFactor: false,
      concurrentSessionWarning: false,
    });
  }),

  http.post(`${BASE}/logout`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/password/reset-request`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/password/reset`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/password/change`, ({ request: _req }) => {
    // Simulate impersonation block
    return new HttpResponse(null, { status: 204 });
  }),
];
