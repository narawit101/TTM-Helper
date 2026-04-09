import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { clearUserCache } from "@/lib/redis";
import { createUserSchema, updateUserSchema } from "@/app/validation/userSchema";


export async function POST(request: Request) {
    // ตรวจสอบสิทธิ์ว่ามีการล็อกอินเป็น Admin หรือไม่
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.issues },
            { status: 400 }
        );
    }

    const { email, deviceLimit, expiresInDays, customExpiresAt } = parsed.data;

    // ตรวจสอบว่าอีเมลนี้มีในระบบแล้วหรือไม่
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        return NextResponse.json(
            { message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
            { status: 400 }
        );
    }

    // คำนวณวันหมดอายุ +1, +3, +7, +30, +365 วัน
    let expiresAt: Date | null = null;
    if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    } else if (customExpiresAt) {
        expiresAt = new Date(customExpiresAt);
    }

    try {
        // สร้าง User ลงฐานข้อมูล
        // หมายเหตุ: createdAt จะใช้ค่าเริ่มต้นจาก Prisma ซึ่งตรงกับเวลาปัจจุบัน (UTC ซึ่งสามารถแปลงเป็น TH Time ได้ที่ฝั่งแสดงผล)
        const user = await prisma.user.create({
            data: { email, expiresAt, deviceLimit }
        });

        await clearUserCache();

        return NextResponse.json({
            message: "สร้างบัญชีผู้ใช้งานสำเร็จ",
            user
        });
    } catch (error) {
        return NextResponse.json(
            { message: "เกิดข้อผิดพลาดในการสร้างบัญชี" },
            { status: 500 }
        );
    }
}



export async function PUT(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.issues },
            { status: 400 }
        );
    }

    const { id, email, deviceLimit, expiresInDays, customExpiresAt } = parsed.data;

    const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingUserByEmail && existingUserByEmail.id !== id) {
        return NextResponse.json({ message: "อีเมลนี้มีผู้ใช้งานอื่นแล้ว" }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (!currentUser) {
        return NextResponse.json({ message: "ไม่พบผู้ใช้งาน" }, { status: 404 });
    }

    let expiresAt: Date | null = currentUser.expiresAt;
    if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    } else if (customExpiresAt) {
        expiresAt = new Date(customExpiresAt);
    } else if (body.expiresType === "never") {
        expiresAt = null;
    }

    try {
        const user = await prisma.user.update({
            where: { id },
            data: { email, expiresAt, deviceLimit }
        });
        await clearUserCache(id);
        return NextResponse.json({ message: "แก้ไขผู้ใช้งานสำเร็จ", user });
    } catch (error) {
        return NextResponse.json({ message: "เกิดข้อผิดพลาดในการแก้ไขข้อมูล" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.id) {
        return NextResponse.json({ message: "ไม่พบ ID ของผู้ใช้" }, { status: 400 });
    }

    try {
        await prisma.user.delete({ where: { id: body.id } });
        await clearUserCache(body.id);
        return NextResponse.json({ message: "ลบผู้ใช้งานเรียบร้อยแล้ว" });
    } catch (error) {
        return NextResponse.json({ message: "ลบผู้ใช้ไม่สำเร็จ หรือมีข้อมูลเกี่ยวข้องอยู่" }, { status: 500 });
    }
}

