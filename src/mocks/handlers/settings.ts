import { http, HttpResponse } from "msw";

const BASE = "/api/tenant/settings";

const mockGeneral = { tenantId: "tenant-1", businessName: "Matrix Emart", supportEmail: "support@matrix.test", timezone: "Asia/Kolkata", currency: "INR", logoUrl: null };
const mockSecurity = { tenantId: "tenant-1", sessionTimeoutMinutes: 60, maxConcurrentSessions: 1, requireTwoFactor: false, passwordMinLength: 8, passwordRequireSpecialChar: true };
const mockTax = { tenantId: "tenant-1", gstEnabled: true, gstNumber: "29ABCDE1234F1Z5", defaultTaxRate: 18 };

export const settingsHandlers = [
  http.get(`${BASE}/general`, () => HttpResponse.json(mockGeneral)),
  http.put(`${BASE}/general`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockGeneral, ...body });
  }),

  http.get(`${BASE}/security`, () => HttpResponse.json(mockSecurity)),
  http.put(`${BASE}/security`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockSecurity, ...body });
  }),

  http.get(`${BASE}/tax`, () => HttpResponse.json(mockTax)),
  http.put(`${BASE}/tax`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockTax, ...body });
  }),
];
