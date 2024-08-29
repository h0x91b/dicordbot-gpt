// src/services/rateLimit.ts
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
});

redis.on("error", (err) => console.error("Redis error:", err));

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

async function checkRateLimit(
  userId: string,
  limit: number,
  window: number,
  key: string
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}:${userId}`;

  const pipeline = redis.pipeline();
  pipeline.incr(redisKey);
  pipeline.ttl(redisKey);

  const results = await pipeline.exec();

  if (!results || results.length !== 2) {
    throw new Error("Redis operation failed");
  }

  const [[incrErr, current], [ttlErr, ttl]] = results;

  if (incrErr || ttlErr) {
    throw new Error("Redis operation failed");
  }

  if (typeof current !== "number" || typeof ttl !== "number") {
    throw new Error("Unexpected result type from Redis");
  }

  if (ttl === -1 || ttl === -2) {
    await redis.expire(redisKey, window * 2);
  }

  const resetTime = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : window);

  const result: RateLimitResult = {
    success: current <= limit,
    limit,
    remaining: Math.max(0, limit - current),
    resetTime,
  };

  console.log(`Rate limit for user ${userId} (${key}):`, result);

  return result;
}

export async function checkUserRateLimit(
  userId: string
): Promise<RateLimitResult | null> {
  const limits = [
    { limit: 4, window: 60, key: "minute" },
    { limit: 25, window: 3600, key: "hour" },
    { limit: 75, window: 86400, key: "day" },
  ];

  for (const { limit, window, key } of limits) {
    const result = await checkRateLimit(userId, limit, window, key);
    if (!result.success) {
      console.log(`Rate limit exceeded for user ${userId} (${key}):`, result);
      return result;
    }
  }

  console.log(`All rate limits passed for user ${userId}`);
  return null;
}
