// Server startup validation. Called from src/instrumentation.ts before any request.
// process.exit(1) is intentional — a misconfigured server must not serve requests.

const REQUIRED_ENV_VARS: Array<{ key: string; description: string }> = [
  { key: "DATABASE_URL", description: "PostgreSQL connection string" },
  { key: "JWT_ACCESS_SECRET", description: "JWT access token signing secret (min 32 chars)" },
  { key: "JWT_REFRESH_SECRET", description: "JWT refresh token signing secret (min 32 chars)" },
  {
    key: "ENCRYPTION_MASTER_KEY",
    description: "AES-256-GCM master key for gateway credentials (must be 64 hex chars = 32 bytes)",
  },
  { key: "UPSTASH_REDIS_REST_URL", description: "Upstash Redis URL for sessions + rate limiting" },
  { key: "UPSTASH_REDIS_REST_TOKEN", description: "Upstash Redis token" },
];

export function runStartupChecks(): void {
  const missing: string[] = [];

  for (const { key, description } of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(`  • ${key}: ${description}`);
    }
  }

  // Validate ENCRYPTION_MASTER_KEY length (must be exactly 64 hex chars = 32 bytes for AES-256)
  const masterKey = process.env["ENCRYPTION_MASTER_KEY"];
  if (masterKey && masterKey.length !== 64) {
    missing.push(
      `  • ENCRYPTION_MASTER_KEY: must be exactly 64 hex characters (is ${masterKey.length})`
    );
  }

  if (missing.length > 0) {
    console.error("FATAL: Required environment variables are missing or invalid:");
    missing.forEach((m) => console.error(m));
    console.error("Server cannot start. Set these variables and restart.");
    process.exit(1);
  }

  if (process.env.NODE_ENV !== "test") {
    console.info("✓ Startup checks passed");
  }
}
