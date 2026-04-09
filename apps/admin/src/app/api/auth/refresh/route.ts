import { NextResponse } from "next/server";
import { verifySessionToken, createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);

    if (!body?.refreshToken) {
        return NextResponse.json({ message: "No refresh token" }, { status: 400 });
    }

    try {
        const payload = verifySessionToken(body.refreshToken);

        if (!payload?.sub) {
            return NextResponse.json({ message: "Invalid refresh token" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            include: { devices: true }
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 401 });
        }

        if (user.deviceLimit === 0) {
            return NextResponse.json({ message: "บัญชีของคุณถูกระงับการใช้งาน" }, { status: 403 });
        }

        if (user.expiresAt && user.expiresAt < new Date()) {
            return NextResponse.json({ message: "Account has expired" }, { status: 403 });
        }

        const activeDevicesCount = user.devices.length;

        const newToken = createSessionToken({
            id: user.id,
            email: user.email,
            deviceKey: payload.deviceKey
        });

        return NextResponse.json({
            accessToken: newToken,
            refreshToken: newToken,
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
                    activeDevices: activeDevicesCount
                }
            }
        });
    } catch {
        return NextResponse.json({ message: "Invalid refresh token" }, { status: 401 });
    }
}
