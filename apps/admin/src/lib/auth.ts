import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { env } from "./env";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type SessionPayload = {
  sub: string;
  email: string;
  deviceKey?: string;
};

export const sessionCookieOptions = {
  httpOnly: true,
  maxAge: SESSION_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production"
};

export const clearSessionCookieOptions = {
  ...sessionCookieOptions,
  maxAge: 0
};

export function createSessionToken(user: { id: string; email: string; deviceKey?: string }) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      ...(user.deviceKey ? { deviceKey: user.deviceKey } : {})
    } satisfies SessionPayload,
    env.JWT_SECRET,
    {
      expiresIn: SESSION_MAX_AGE
    }
  );
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) {
    return null;
  }

  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}
