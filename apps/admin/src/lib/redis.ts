import { Redis } from "ioredis";
import { revalidatePath } from "next/cache";

const globalForRedis = globalThis as unknown as {
    redis?: Redis;
};

// Check if REDIS_URL exists, otherwise fallback to local default
export const redis =
    globalForRedis.redis ??
    new Redis(process.env.REDIS_URL || "");

if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = redis;
}

export async function clearUserCache(userId?: string) {
    try {
        const keys = await redis.keys("users:*");
        if (keys.length > 0) {
            await redis.del(...keys);
        }
        if (userId) {
            await redis.del(`user:me:${userId}`);
        }
        revalidatePath("/dashboard");
    } catch (e) {
        console.error("Redis Cache Clear Error:", e);
    }
}
