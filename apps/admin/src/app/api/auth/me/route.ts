import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = verifySessionToken(token);

        if (!payload?.sub) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { redis } = await import("@/lib/redis");
        const cacheKey = `user:me:${payload.sub}`;

        let user = null;
        const cachedUser = await redis.get(cacheKey).catch(() => null);

        if (cachedUser) {
            user = JSON.parse(cachedUser);
            user.createdAt = new Date(user.createdAt);
            if (user.expiresAt) user.expiresAt = new Date(user.expiresAt);
        } else {
            user = await prisma.user.findUnique({
                where: { id: payload.sub },
                include: { devices: true }
            });

            if (user) {
                await redis.set(cacheKey, JSON.stringify(user), "EX", 180).catch(() => null);
            }
        }

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 401 });
        }

        if (user.deviceLimit === 0) {
            return NextResponse.json({ message: "บัญชีของคุณถูกระงับการใช้งาน" }, { status: 403 });
        }

        if (user.expiresAt && user.expiresAt < new Date()) {
            return NextResponse.json({ message: "Account has expired" }, { status: 403 });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.email,
                role: "user",
                permissions: [],
                subscription: {
                    plan: "premium",
                    status: "active",
                    startsAt: user.createdAt.toISOString(),
                    expiresAt: user.expiresAt ? user.expiresAt.toISOString() : null,
                    maxDevices: user.deviceLimit,
                    activeDevices: user.devices.length
                }
            }
        });

    } catch {
        return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
}
