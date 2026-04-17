# Gateway Credential Encryption — Key Rotation Procedure

## Encryption Scheme

AES-256-GCM with a 256-bit master key stored in `ENCRYPTION_MASTER_KEY` (64 hex chars).

```
Plaintext (API key/secret)
    │
    ▼
Random 96-bit IV (crypto.randomBytes(12))
    │
    ▼
AES-256-GCM encrypt
    │
    ▼
Stored: base64(iv):base64(ciphertext):base64(authTag)
```

Format stored in `payment_gateways.api_key_encrypted` and `api_secret_encrypted`.

## Key Rotation — Step by Step

Key rotation re-encrypts all gateway credentials under a new master key with zero downtime.

```
Phase 1: Add new key (dual-read)
────────────────────────────────
OLD_KEY ──► decrypts existing ciphertexts (still in prod)
NEW_KEY ──► added to env as ENCRYPTION_MASTER_KEY_NEW

Phase 2: Re-encrypt all rows
────────────────────────────────
For each gateway row:
  plaintext = decrypt(api_key_encrypted, OLD_KEY)
  api_key_encrypted = encrypt(plaintext, NEW_KEY)
  plaintext = decrypt(api_secret_encrypted, OLD_KEY)
  api_secret_encrypted = encrypt(plaintext, NEW_KEY)

Phase 3: Promote new key
────────────────────────────────
ENCRYPTION_MASTER_KEY = NEW_KEY
Remove ENCRYPTION_MASTER_KEY_NEW

Phase 4: Verify
────────────────────────────────
Run startup checks — all gateways decrypt successfully
Remove OLD_KEY reference
```

## Migration Script

```typescript
// scripts/rotate-encryption-key.ts
// Usage: OLD_KEY=<hex> NEW_KEY=<hex> npx ts-node scripts/rotate-encryption-key.ts

import { PrismaClient } from "@prisma/client";
import { encryptCredential, decryptCredential } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  const oldKey = process.env.OLD_KEY;
  const newKey = process.env.NEW_KEY;
  if (!oldKey || !newKey) throw new Error("OLD_KEY and NEW_KEY required");
  if (oldKey.length !== 64 || newKey.length !== 64) throw new Error("Keys must be exactly 64 hex chars");

  const gateways = await prisma.paymentGateway.findMany({
    select: { id: true, apiKeyEncrypted: true, apiSecretEncrypted: true },
  });

  console.log(`Rotating ${gateways.length} gateway credentials...`);

  for (const gw of gateways) {
    // Decrypt with old key
    process.env.ENCRYPTION_MASTER_KEY = oldKey;
    const apiKey = decryptCredential(gw.apiKeyEncrypted);
    const apiSecret = decryptCredential(gw.apiSecretEncrypted);

    // Re-encrypt with new key
    process.env.ENCRYPTION_MASTER_KEY = newKey;
    await prisma.paymentGateway.update({
      where: { id: gw.id },
      data: {
        apiKeyEncrypted: encryptCredential(apiKey),
        apiSecretEncrypted: encryptCredential(apiSecret),
      },
    });

    console.log(`  ✓ ${gw.id}`);
  }

  console.log("Rotation complete. Update ENCRYPTION_MASTER_KEY in your deployment environment.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

## Safety Checklist

Before rotation:
- [ ] New key generated: `openssl rand -hex 32`
- [ ] Database backup taken
- [ ] Rotation tested in staging environment
- [ ] Deployment pipeline ready to update env var atomically

During rotation:
- [ ] Application scaled down to zero replicas (or maintenance mode enabled)
- [ ] Script run against production DB: `OLD_KEY=<old> NEW_KEY=<new> npx ts-node scripts/rotate-encryption-key.ts`
- [ ] `ENCRYPTION_MASTER_KEY` updated in deployment environment
- [ ] Application restarted

After rotation:
- [ ] Startup checks pass (`runStartupChecks()` logs no errors)
- [ ] Smoke test: `POST /api/tenant/payment-gateways/:id/test` succeeds on one live gateway
- [ ] Old key securely deleted from secrets manager

## Error Handling

`decryptCredential()` throws `GatewayDecryptError` with codes:

| Code | Cause | Action |
|------|-------|--------|
| `MISSING_CIPHERTEXT` | Row has null credential | Skip row (gateway has no credentials stored) |
| `INVALID_FORMAT` | Stored value corrupted | Manual investigation required |
| `DECRYPT_FAILED` | Wrong key or tampered data | Abort rotation, restore backup |

## Related Files

- `src/lib/crypto.ts` — `encryptCredential`, `decryptCredential`, `GatewayDecryptError`
- `src/lib/startup-checks.ts` — validates `ENCRYPTION_MASTER_KEY` length on boot
- `src/instrumentation.ts` — calls `runStartupChecks()` on server start
