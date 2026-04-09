import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "@/components/dashboard/create-user-form";
import { SearchAndFilter } from "@/components/dashboard/search-and-filter";
import { Pagination } from "@/components/shared/pagination";
import { UserTable } from "@/components/dashboard/user-table";
import { Prisma } from "@prisma/client";
import { User } from "@/types/user";

function TableSkeleton() {
  return (
    <div className="w-full flex-col flex items-center justify-center p-20 gap-4">
      <div className="flex h-12 items-center justify-center gap-2">
        <div className="h-3 w-3 animate-bounce rounded-full bg-slate-900" style={{ animationDelay: '0ms' }} />
        <div className="h-3 w-3 animate-bounce rounded-full bg-slate-900" style={{ animationDelay: '150ms' }} />
        <div className="h-3 w-3 animate-bounce rounded-full bg-slate-900" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลผู้ใช้งาน...</p>
    </div>
  );
}

async function UserTableData({ searchParams }: { searchParams?: { q?: string; status?: string; device?: string; customDays?: string; page?: string } }) {
  const q = searchParams?.q || "";
  const statusFilter = searchParams?.status || "all";
  const deviceFilter = searchParams?.device || "";
  const customDaysFilter = searchParams?.customDays || "";

  const currentPage = Number(searchParams?.page) || 1;
  const pageSize = 10;

  const whereCondition: Prisma.UserWhereInput = {};

  if (q) {
    whereCondition.OR = [
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (statusFilter === "active") {
    whereCondition.OR = [
      ...(Array.isArray(whereCondition.OR) ? whereCondition.OR : []),
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ];
  } else if (statusFilter === "expired") {
    whereCondition.expiresAt = { lte: new Date() };
  } else if (statusFilter === "7days") {
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    whereCondition.expiresAt = { gt: new Date(), lte: next7Days };
  } else if (statusFilter === "30days") {
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);
    whereCondition.expiresAt = { gt: new Date(), lte: next30Days };
  } else if (statusFilter === "365day") {
    const next365Days = new Date();
    next365Days.setDate(next365Days.getDate() + 365);
    whereCondition.expiresAt = { gt: new Date(), lte: next365Days };
  } else if (statusFilter === "custom" && customDaysFilter) {
    const days = parseInt(customDaysFilter, 10);
    if (!isNaN(days) && days > 0) {
      const nextXDays = new Date();
      nextXDays.setDate(nextXDays.getDate() + days);
      whereCondition.expiresAt = { gt: new Date(), lte: nextXDays };
    }
  }

  if (deviceFilter) {
    const deviceNum = parseInt(deviceFilter, 10);
    if (!isNaN(deviceNum) && deviceNum > 0) {
      whereCondition.deviceLimit = deviceNum;
    }
  }

  const skip = (currentPage - 1) * pageSize;
  const cacheKey = `users:page:${currentPage}:status:${statusFilter}:device:${deviceFilter}:custom:${customDaysFilter}:q:${q}`.toLowerCase().replace(/\s+/g, "_");

  let totalUsers = 0;
  let users: User[] = [];

  const { redis } = await import("@/lib/redis");
  const cachedData = await redis.get(cacheKey).catch(() => null);

  if (cachedData) {
    // โหลดจากแคช - ไวมากๆ 
    // จำลอง Delay 500ms ทำให้เห็นว่าเวลาดึงจากแคชมันมีจุดกระพริบนิดนึง
    // await new Promise(r => setTimeout(r, 500));

    const parsed = JSON.parse(cachedData);
    totalUsers = parsed.totalUsers;
    users = parsed.users;
  } else {
    // โหลดจริงจากฐานข้อมูล - เสมือนโหลดครั้งแรก
    // จำลอง Delay เพิ่มให้เห็นความแตกต่างชัดเจน (2 วินาที)
    // await new Promise(r => setTimeout(r, 2000));

    const [dbTotalUsers, dbUsers] = await Promise.all([
      prisma.user.count({ where: whereCondition }),
      prisma.user.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      })
    ]);

    totalUsers = dbTotalUsers;
    users = dbUsers;

    await redis.set(cacheKey, JSON.stringify({ totalUsers, users }), "EX", 60).catch(() => null);
  }

  return (
    <>
      <UserTable users={users} />
      <Pagination totalItems={totalUsers} pageSize={pageSize} currentPage={currentPage} />
    </>
  );
}

export default async function DashboardPage(props: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    device?: string;
    customDays?: string;
    page?: string;
  }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;

  return (
    <main className="w-full px-4 py-4 sm:px-6 lg:px-6">
      <div className="space-y-6">

        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header Section */}
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 md:flex-row md:items-center md:justify-between bg-white z-10 relative">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">รายชื่อผู้ใช้งาน</h2>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <SearchAndFilter />
              <CreateUserForm />
            </div>
          </div>

          {/* Suspense เฉพาะข้อมูลส่วนตาราง */}
          <Suspense key={JSON.stringify(searchParams)} fallback={<TableSkeleton />}>
            <UserTableData searchParams={searchParams} />
          </Suspense>

        </div>
      </div>
    </main>
  );
}
