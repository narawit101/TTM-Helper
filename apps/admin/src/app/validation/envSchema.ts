import { z } from "zod";
export const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(12),
    REDIS_URL: z.string().optional()
});