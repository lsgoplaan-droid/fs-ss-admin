// Runs once at server startup — validates required env vars before any request is handled.
// See src/lib/startup-checks.ts for validation logic.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupChecks } = await import("./lib/startup-checks");
    runStartupChecks();
  }
}
