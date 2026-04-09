import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { loginSchema } from "@/app/validation/userSchema";


export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    );
  }

  const { email, password, deviceKey, deviceName } = parsed.data;

  // Extension login (uses deviceKey)
  if (deviceKey) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { devices: true }
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    if (user.expiresAt && user.expiresAt < new Date()) {
      return NextResponse.json({ message: "Account has expired" }, { status: 403 });
    }

    const existingDevice = user.devices.find(d => d.deviceKey === deviceKey);
    let activeDevicesCount = user.devices.length;

    if (!existingDevice) {
      if (activeDevicesCount >= user.deviceLimit) {
        return NextResponse.json({ message: ` การเข้าสู่ระบบถูกจำกัด ${user.deviceLimit} อุปกรณ์` }, { status: 403 });
      }

      await prisma.device.create({
        data: {
          userId: user.id,
          deviceKey,
          deviceName: deviceName ?? "Unknown Device"
        }
      });
      activeDevicesCount++;
    }

    // Since we need to return AuthResponse
    const token = createSessionToken({ id: user.id, email: user.email, deviceKey });

    return NextResponse.json({
      accessToken: token,
      refreshToken: token,
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
  }

  // Admin login requires password
  if (!password) {
    return NextResponse.json({ message: "Invalid email or password" }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({
    where: {
      email
    }
  });

  if (!admin) {
    return NextResponse.json(
      {
        message: "Email or password is incorrect"
      },
      {
        status: 401
      }
    );
  }

  const passwordMatches = await bcrypt.compare(password, admin.password);

  if (!passwordMatches) {
    return NextResponse.json(
      {
        message: "Email or password is incorrect"
      },
      {
        status: 401
      }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", createSessionToken(admin), sessionCookieOptions);
  return response;
}
