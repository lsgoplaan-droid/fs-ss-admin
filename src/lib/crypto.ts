// AES-256-GCM encryption for payment gateway credentials.
// Credentials are encrypted before DB write and decrypted on read.
// The plaintext key is NEVER stored or logged.
// Key rotation procedure: docs/encryption-rotation.md

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

export class GatewayDecryptError extends Error {
  constructor(
    public readonly code: "MISSING_CIPHERTEXT" | "DECRYPT_FAILED" | "INVALID_FORMAT",
    options?: ErrorOptions
  ) {
    super(`Gateway credential decrypt failed: ${code}`, options);
    this.name = "GatewayDecryptError";
  }
}

function getMasterKey(): Buffer {
  const key = process.env["ENCRYPTION_MASTER_KEY"];
  // runStartupChecks() guarantees this is set — if we reach here without it, fail hard
  if (!key) throw new Error("ENCRYPTION_MASTER_KEY not set");
  return Buffer.from(key, "hex");
}

// Returns a colon-separated base64 string: iv:ciphertext:authTag
export function encryptCredential(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    encrypted.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

// Throws GatewayDecryptError — never returns null or undefined.
// Callers must handle GatewayDecryptError and return 500 GATEWAY_CREDENTIAL_UNAVAILABLE.
export function decryptCredential(ciphertext: string | null | undefined): string {
  if (!ciphertext) {
    throw new GatewayDecryptError("MISSING_CIPHERTEXT");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new GatewayDecryptError("INVALID_FORMAT");
  }

  try {
    const [ivB64, encryptedB64, tagB64] = parts as [string, string, string];
    const key = getMasterKey();
    const iv = Buffer.from(ivB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");
    const tag = Buffer.from(tagB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
  } catch (e) {
    // Do NOT include e.message in the thrown error — it may contain key material
    throw new GatewayDecryptError("DECRYPT_FAILED", { cause: e });
  }
}
