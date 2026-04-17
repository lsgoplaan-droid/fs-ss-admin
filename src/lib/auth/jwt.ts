import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Permission } from "@/lib/permissions";

const accessSecret = new TextEncoder().encode(process.env["JWT_ACCESS_SECRET"]);
const refreshSecret = new TextEncoder().encode(process.env["JWT_REFRESH_SECRET"]);

export type TokenRole = "platform_admin" | "tenant_admin";

export interface AccessTokenPayload extends JWTPayload {
  sub: string;           // user ID
  role: TokenRole;
  tenantId: string | null;
  permissions: Permission[];
  sessionId: string;
  impersonatedBy?: string; // platform user ID — present only in impersonation tokens
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  sessionId: string;
}

const ACCESS_TTL = parseInt(process.env["JWT_ACCESS_TTL_SECONDS"] ?? "28800");
const REFRESH_TTL = parseInt(process.env["JWT_REFRESH_TTL_SECONDS"] ?? "604800");
const IMPERSONATION_TTL = parseInt(process.env["JWT_IMPERSONATION_TTL_SECONDS"] ?? "1800");

export async function signAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">): Promise<string> {
  const ttl = payload.impersonatedBy ? IMPERSONATION_TTL : ACCESS_TTL;
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(accessSecret);
}

export async function signRefreshToken(payload: Omit<RefreshTokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret);
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload as RefreshTokenPayload;
}

// Impersonation tokens are non-renewable — detect by presence of impersonatedBy claim.
// The 401 handler checks this before attempting a refresh.
export function isImpersonationToken(payload: AccessTokenPayload): boolean {
  return !!payload.impersonatedBy;
}
