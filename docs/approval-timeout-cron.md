# Approval Timeout Cron — Specification

## Overview

A cron job runs every 15 minutes and auto-rejects approval instances that have exceeded their level's `timeoutHours` deadline without action.

```
Every 15 min
    │
    ▼
Acquire Redis SETNX lock
    │ FAIL ──► exit (another instance running)
    │ OK
    ▼
Query pending instances past deadline
    │
    ▼
For each expired instance
    ├── escalationRoleId present? ──► move to next level (ESCALATED)
    └── no escalationRole? ──────► auto-reject (REJECTED, reason: TIMEOUT)
    │
    ▼
Release Redis lock
```

## Implementation

### Lock

```typescript
const LOCK_KEY = "cron:approval-timeout:lock";
const LOCK_TTL_SECONDS = 300; // 5 min max run time

const acquired = await redis.set(LOCK_KEY, "1", { nx: true, ex: LOCK_TTL_SECONDS });
if (!acquired) return; // another instance holds the lock
```

Lock is released explicitly on completion; TTL acts as a safety net if the process crashes.

### Query

```sql
SELECT ai.*, wls.timeout_hours, wls.escalation_role_id
FROM approval_instances ai
JOIN workflow_level_snapshots wls
  ON wls.workflow_version_id = ai.workflow_version_id
  AND wls.level_number = ai.current_level
WHERE ai.status = 'PENDING'
  AND ai.current_level_started_at + (wls.timeout_hours * interval '1 hour') < NOW()
```

Uses `WorkflowLevelSnapshot` (immutable copy pinned at submission) — never reads from live `WorkflowLevel`.

### Transition — CAS Update

```typescript
const updated = await prisma.$executeRaw`
  UPDATE approval_instances
  SET status = ${nextStatus}, ...
  WHERE id = ${inst.id}
    AND status = 'PENDING'  -- CAS guard
`;
if (updated === 0) continue; // concurrent action won, skip
```

The `WHERE status = 'PENDING'` guard prevents double-processing if a human approves between query and update.

### Empty Escalation Role

```typescript
if (!snapshot.escalationRoleId) {
  // Auto-reject with TIMEOUT reason
  await rejectInstance(inst.id, "TIMEOUT");
  await writeAuditLog({ action: "APPROVAL_AUTO_REJECTED", reason: "TIMEOUT_NO_ESCALATION" });
} else {
  // Move to escalation role
  await escalateInstance(inst.id, snapshot.escalationRoleId);
}
```

### Audit Trail

Every timeout action writes an `AuditLog` entry:
- `action`: `APPROVAL_AUTO_REJECTED` or `APPROVAL_ESCALATED`
- `metadata`: `{ reason: "TIMEOUT", previousLevel: n, timeoutHours: n }`
- `actorUserId`: `null` (system action)

## Scheduling

### Development / CI

Invoked directly: `npx ts-node src/jobs/approval-timeout.ts`

### Production

Vercel Cron (if deployed on Vercel): `vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/approval-timeout", "schedule": "*/15 * * * *" }]
}
```

Route handler at `src/app/api/cron/approval-timeout/route.ts` — verifies `Authorization: Bearer ${CRON_SECRET}` before invoking.

## Failure Modes

| Failure | Behavior |
|---------|----------|
| Redis unavailable | Lock acquisition fails → cron skips run silently; next run retries |
| DB query error | Log error, release lock, do not partially commit |
| Crash mid-run | TTL expires lock after 5 min; next run re-acquires and re-processes (CAS guard prevents double-reject) |
| No escalation role | Auto-reject with TIMEOUT reason + audit log |
| Workflow deleted between submission and timeout | `workflowVersionId` points to immutable snapshot — unaffected |

## Related Files

- `src/jobs/approval-timeout.ts` — job implementation (Sprint 1)
- `src/app/api/cron/approval-timeout/route.ts` — HTTP trigger (Sprint 1)
- `prisma/schema.prisma` — `ApprovalInstance`, `WorkflowLevelSnapshot`
- `src/lib/redis.ts` — Redis client
- `TODOS.md` — T5: Approval Timeout Cron
