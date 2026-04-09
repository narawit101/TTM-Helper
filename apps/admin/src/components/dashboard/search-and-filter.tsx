"use client";

import { Icon } from "@iconify/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { useTransition, useState, useEffect } from "react";
import { CustomSelect } from "@/components/ui/select";

// --- Main Component ---
export function SearchAndFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
    const [deviceQuery, setDeviceQuery] = useState(searchParams.get("device") || "");
    const [customDaysQuery, setCustomDaysQuery] = useState(searchParams.get("customDays") || "");

    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            let hasChanges = false;

            if (searchQuery !== (searchParams.get("q") || "")) {
                searchQuery ? params.set("q", searchQuery) : params.delete("q");
                hasChanges = true;
            }
            if (deviceQuery !== (searchParams.get("device") || "")) {
                deviceQuery ? params.set("device", deviceQuery) : params.delete("device");
                hasChanges = true;
            }
            if (customDaysQuery !== (searchParams.get("customDays") || "")) {
                customDaysQuery ? params.set("customDays", customDaysQuery) : params.delete("customDays");
                hasChanges = true;
            }

            if (hasChanges) {
                params.set("page", "1");
                startTransition(() => {
                    const nextUrl = `${pathname}?${params.toString()}`;
                    router.replace(nextUrl as Route);
                });
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [searchQuery, deviceQuery, customDaysQuery, pathname, router, searchParams]);

    const currentStatus = searchParams.get("status") || "all";

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === "all") {
            params.delete(key);
            if (key === "status") params.delete("customDays");
        } else {
            params.set(key, value);
        }
        params.set("page", "1");

        startTransition(() => {
            const nextUrl = `${pathname}?${params.toString()}`;
            router.replace(nextUrl as Route);
        });
    };

    const statusOptions = [
        { label: "สถานะ: ทั้งหมด", value: "all" },
        { label: "เปิดใช้งาน", value: "active" },
        { label: "หมดอายุแล้ว", value: "expired" },
        { label: "หมดอายุใน 7 วัน", value: "7days" },
        { label: "หมดอายุใน 30 วัน", value: "30days" },
        { label: "หมดอายุใน 1 ปี", value: "365day" },
        { label: "กำหนดเอง (วัน)", value: "custom" },
    ];

    return (
        <div className={`flex flex-wrap items-center gap-3 w-full md:w-auto ${isPending ? "opacity-70" : ""}`}>
            <div className="relative flex-1 min-w-[200px] md:flex-none">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Icon icon="majesticons:search-line" className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาอีเมล"
                    className="block w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-400 sm:w-64"
                />
            </div>
            <div className="flex gap-3 items-center w-auto">
                {currentStatus === "custom" && (
                    <div className="relative flex-1 md:flex-none w-28 text-sm">
                        <input
                            type="number"
                            min="1"
                            value={customDaysQuery}
                            onChange={(e) => setCustomDaysQuery(e.target.value)}
                            placeholder="ระบุจำนวนวัน"
                            className="block w-full rounded-xl border-0 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-400"
                        />
                    </div>
                )}
                <div className="relative flex-1 md:flex-none w-40 text-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Icon icon="majesticons:monitor-line" className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="number"
                        min="1"
                        value={deviceQuery}
                        onChange={(e) => setDeviceQuery(e.target.value)}
                        placeholder="จำกัดอุปกรณ์"
                        className="block w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-400"
                    />
                </div>
                <CustomSelect
                    icon="majesticons:filter-line"
                    value={currentStatus}
                    options={statusOptions}
                    onChange={(val) => updateFilter("status", val)}
                />
            </div>
        </div>
    );
}

