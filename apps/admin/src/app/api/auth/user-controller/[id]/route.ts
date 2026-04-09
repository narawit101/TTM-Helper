import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { clearUserCache } from "@/lib/redis";
import { updateUserSchema } from "@/app/validation/userSchema";



export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;

  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  const { email, deviceLimit, expiresInDays, customExpiresAt } = parsed.data;

  const emailInUse = await prisma.user.findFirst({
    where: { email, id: { not: id } }
  });

  if (emailInUse) return NextResponse.json({ message: "อีเมลนี้ถูกใช้งานโดยผู้ใช้อื่นแล้ว" }, { status: 400 });

  const currentUser = await prisma.user.findUnique({
    where: { id }
  });

  if (!currentUser) return NextResponse.json({ message: "ไม่พบผู้ใช้งาน" }, { status: 404 });

  let updateData: Partial<typeof currentUser> = { email, deviceLimit };

  if (body.expiresType === "never") {
    updateData.expiresAt = null;
  } else if (expiresInDays) {
    // ถ้ายูสเซอร์เดิมมีวันหมดอายุ และยังไม่หมดอายุ ให้บวกทบจากวันเดิม แต่ถ้าหมดอายุไปแล้วให้บวกจากวันปัจจุบัน
    const baseDate = currentUser.expiresAt && currentUser.expiresAt > new Date()
      ? new Date(currentUser.expiresAt)
      : new Date();

    const expiresAt = new Date(baseDate);
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    updateData.expiresAt = expiresAt;
  } else if (customExpiresAt) {
    updateData.expiresAt = new Date(customExpiresAt);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });

    await clearUserCache(id);

    return NextResponse.json({ message: "User updated", user });
  } catch (error) {
    return NextResponse.json({ message: "Error updating user" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;

  try {
    await prisma.user.delete({ where: { id } });
    await clearUserCache(id);
    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting user" }, { status: 500 });
  }
}
