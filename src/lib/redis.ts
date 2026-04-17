import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env["UPSTASH_REDIS_REST_URL"]!,
  token: process.env["UPSTASH_REDIS_REST_TOKEN"]!,
});

// Session registry — single concurrent session per user.
// Key: session:{userId}  Value: sessionId  TTL: access token TTL
export const SESSION_KEY = (userId: string) => `session:${userId}`;

// Rate limiters
const LOGIN_PER_MIN = parseInt(process.env["RATE_LIMIT_LOGIN_PER_MIN"] ?? "10");
const REFRESH_PER_MIN = parseInt(process.env["RATE_LIMIT_REFRESH_PER_MIN"] ?? "30");
const GATEWAY_TEST_PER_MIN = parseInt(process.env["RATE_LIMIT_GATEWAY_TEST_PER_MIN"] ?? "5");

export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(LOGIN_PER_MIN, "1 m"),
  prefix: "rl:login",
});

export const refreshRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(REFRESH_PER_MIN, "1 m"),
  prefix: "rl:refresh",
});

export const gatewayTestRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(GATEWAY_TEST_PER_MIN, "1 m"),
  prefix: "rl:gateway_test",
});
