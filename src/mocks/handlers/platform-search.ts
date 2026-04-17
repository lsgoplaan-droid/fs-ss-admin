import { http, HttpResponse } from "msw";

const BASE = "/api/platform/search";

export const platformSearchHandlers = [
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    if (!q.trim()) {
      return HttpResponse.json({ tenants: [], users: [] });
    }
    return HttpResponse.json({
      tenants: [
        { id: "tenant-1", name: "Matrix Emart", slug: "matrix-emart", status: "ACTIVE" },
      ].filter((t) => t.name.toLowerCase().includes(q.toLowerCase())),
      users: [
        { id: "platform-user-1", email: "admin@platform.test", name: "Platform Admin", role: "platform_admin" },
      ].filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())),
    });
  }),
];
