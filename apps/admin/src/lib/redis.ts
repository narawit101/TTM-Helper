import Redis from "ioredis";
import { revalidatePath } from "next/cache";

const globalForRedis = globalThis as {
  redis?: Redis;
};

function createRedis() {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL is not set");
  }

  const parsed = new URL(url);
  const port = parsed.port ? Number(parsed.port) : undefined;
  const db = parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : undefined;

  return new Redis({
    host: parsed.hostname,
    port: Number.isFinite(port) ? port : undefined,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
}

export function getRedis() {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedis();
  }

  return globalForRedis.redis;
}

export async function clearUserCache(userId?: string) {
  try {
    const redis = getRedis();
    await redis.connect().catch(() => null);

    const keys = await redis.keys("users:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    if (userId) {
      await redis.del(`user:me:${userId}`);
    }

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Redis Cache Clear Error:", error);
  }
}
