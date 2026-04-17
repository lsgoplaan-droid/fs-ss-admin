import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/refresh") ||
    pathname.startsWith("/api/auth/password/reset")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("access_token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = await verifyAccessToken(token);

    // Platform admin routes — must have platform_admin role
    if (pathname.startsWith("/platform") || pathname.startsWith("/api/platform/")) {
      if (payload.role !== "platform_admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: { code: "FORBIDDEN", message: "Platform admin access required" } }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/403", request.url));
      }
    }

    // Tenant routes — must have tenant_id in JWT
    // tenant_id null check: platform admin token cannot access /tenant/* without impersonation
    if (pathname.startsWith("/tenant") || pathname.startsWith("/api/tenant/")) {
      if (!payload.tenantId) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: { code: "TENANT_ID_REQUIRED", message: "tenant_id is null — use impersonation to access tenant routes" } },
            { status: 400 }
          );
        }
        return NextResponse.redirect(new URL("/platform", request.url));
      }
    }

    // Forward token claims as headers for route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.sub!);
    requestHeaders.set("x-user-role", payload.role);
    requestHeaders.set("x-tenant-id", payload.tenantId ?? "");
    requestHeaders.set("x-session-id", payload.sessionId);
    if (payload.impersonatedBy) {
      requestHeaders.set("x-impersonated-by", payload.impersonatedBy);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Token expired or invalid
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "TOKEN_EXPIRED", message: "Access token expired" } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|403).*)",
  ],
};
