import { NextResponse } from "next/server";
import { clearSessionCookieOptions, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // If there's a refreshToken, extract deviceKey and remove from DB
  if (body?.refreshToken) {
    try {
      const payload = verifySessionToken(body.refreshToken);
      if (payload?.deviceKey) {
        await prisma.device.deleteMany({
          where: { deviceKey: payload.deviceKey }
        });
      }
    } catch {
      // Ignore token verification errors for logout
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", "", clearSessionCookieOptions);
  return response;
}
