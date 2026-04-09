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

    return new Redis(url);
}

export const redis = globalForRedis.redis ?? createRedis();

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
    } catch (error) {
        console.error("Redis Cache Clear Error:", error);
    }
}
