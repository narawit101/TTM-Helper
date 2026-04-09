"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";

const MENU_ITEMS = [
    {
        name: "การจัดการผู้ใช้",
        href: "/dashboard",
        icon: "majesticons:users-line",
    },
];

export function SideNav({ userEmail }: { userEmail?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = () => {
        startTransition(async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/login");
            router.refresh();
        });
    };

    return (
        <aside
            className={`hidden flex-shrink-0 flex-col border-r border-white/60 bg-white/75 shadow-panel backdrop-blur md:flex relative h-screen transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"
                }`}
        >
            {/* ปุ่ม Toggle เปิด/ปิด Sidebar */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-8 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900 hover:bg-slate-50 z-10 focus:outline-none transition-colors"
                title={isCollapsed ? "ขยายเมนู" : "ย่อเมนู"}
            >
                <Icon icon={isCollapsed ? "majesticons:chevron-right" : "majesticons:chevron-left"} />
            </button>

            <div className="flex flex-1 flex-col overflow-hidden pt-8 pb-8 px-4 h-full">

                {/* ส่วนหัวแสดงโปรไฟล์ */}
                <div className={`mb-8 flex min-h-[40px] items-center ${isCollapsed ? "justify-center px-0" : "gap-3 px-2"}`}>
                    <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        title={isCollapsed ? userEmail : undefined}
                    >
                        <Icon icon="majesticons:user-line" className="text-xl" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-bold text-slate-900" title={userEmail}>
                                {userEmail || "admin@example.com"}
                            </span>
                            <span className="text-xs font-medium text-slate-500">Admin</span>
                        </div>
                    )}
                </div>

                {/* เมนูนำทาง (Map Menu) */}
                <nav className="flex-1 space-y-2">
                    {MENU_ITEMS.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.name}
                                href={item.href as any}
                                title={isCollapsed ? item.name : undefined}
                                className={`flex items-center rounded-xl p-3 text-sm font-medium transition-all ${isActive
                                    ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                                    : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                    } ${isCollapsed ? "justify-center" : "gap-3 px-4"}`}
                            >
                                <Icon
                                    icon={item.icon}
                                    className={`text-xl flex-shrink-0 ${isActive ? "text-white" : "text-slate-500"}`}
                                />
                                {!isCollapsed && <span className="truncate">{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* ปุ่มออกจากระบบ (ด้านล่างสุด) */}
                <div className="mt-auto">
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        isLoading={isPending}
                        title={isCollapsed ? "ออกจากระบบ" : undefined}
                        className={`group w-full flex items-center text-slate-700 transition-all hover:bg-red-50 hover:text-red-500 ${
                            isCollapsed || isPending ? "justify-center px-0" : "justify-start gap-3 px-4"
                        }`}
                    >
                        <Icon icon="majesticons:logout-line" className="text-xl flex-shrink-0 text-slate-500 transition-colors group-hover:text-red-500" />
                        {!isCollapsed && <span className="truncate">ออกจากระบบ</span>}
                    </Button>
                </div>

            </div>
        </aside>
    );
}
