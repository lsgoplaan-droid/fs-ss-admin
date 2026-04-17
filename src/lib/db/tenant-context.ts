// RLS tenant context middleware.
// Every DB operation on tenant-scoped tables must run inside withTenantContext().
// Uses transaction-scoped set_config (3rd arg = true) so the variable resets
// automatically when the transaction ends — safe with connection pools.
//
// CRITICAL: Do NOT call set_config with local=false — that is connection-scoped
// and bleeds across pool connections to other tenants.

import { Prisma } from "@prisma/client";
import { prisma } from "./client";

type PrismaTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantContextError";
  }
}

// Execute fn inside a transaction with app.tenant_id set for the duration.
// Throws TenantContextError if tenantId is null/undefined (programming error —
// means the /tenant/* middleware guard failed to catch a null tenant_id JWT claim).
export async function withTenantContext<T>(
  tenantId: string | null | undefined,
  fn: (tx: PrismaTx) => Promise<T>
): Promise<T> {
  if (!tenantId) {
    // Log request path to help diagnose which route bypassed the null-check guard
    console.error(
      "[TenantContextError] withTenantContext called with null tenantId — " +
        "check that the /tenant/* middleware guard is applied to this route"
    );
    throw new TenantContextError(
      "tenantId is required but was null/undefined. " +
        "This is a programming error — the /tenant/* middleware must validate tenant_id before this call."
    );
  }

  return prisma.$transaction(async (tx) => {
    // transaction-scoped: resets when transaction ends, safe with PgBouncer/Prisma pools
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

// Convenience wrapper for read-only queries that still need tenant isolation.
export async function withTenantReadContext<T>(
  tenantId: string | null | undefined,
  fn: (tx: PrismaTx) => Promise<T>
): Promise<T> {
  return withTenantContext(tenantId, fn);
}
