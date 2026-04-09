import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().optional(),
    deviceKey: z.string().optional(),
    deviceName: z.string().optional()
});

export const createUserSchema = z.object({
    email: z.string().email(),
    deviceLimit: z.number().int().min(0).default(1),
    expiresInDays: z.number().int().positive().optional(), // สำหรับ +1, +3, +7, +30, +365 หรือจำนวนวันอื่นๆ
    customExpiresAt: z.string().datetime().optional() // สำหรับการกำหนดวันหมดอายุเองเฉพาะเจาะจง (ISO 8601 string)
});

export const updateUserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    deviceLimit: z.number().int().min(0).default(1),
    expiresInDays: z.number().int().positive().optional(),
    customExpiresAt: z.string().datetime().optional()
});
