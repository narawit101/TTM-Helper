"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import { User } from "@/types/user";

export function CreateUserForm() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [expiresType, setExpiresType] = useState("1");
    const [isCustomDate, setIsCustomDate] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Clear form states when modal is closed
    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setExpiresType("1");
            setIsCustomDate(false);
        }
    }, [isOpen]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);

        // Define a structured payload type mapping closer to our schema definitions
        const payload: Partial<User> & { expiresType?: string; customExpiresAt?: string; expiresInDays?: number } = {
            email: formData.get("email") as string,
            deviceLimit: Number(formData.get("deviceLimit") || 1),
        };

        if (isCustomDate) {
            const customDate = formData.get("customExpiresAt") as string;
            if (customDate) {
                payload.customExpiresAt = new Date(customDate).toISOString();
                payload.expiresType = "custom";
            }
        } else {
            payload.expiresType = expiresType;
            if (expiresType !== "never") {
                payload.expiresInDays = Number(expiresType);
            }
        }

        try {
            const response = await fetch("/api/auth/user-controller", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.errors?.[0]?.message || "สร้างผู้ใช้งานไม่สำเร็จ");
            }

            setIsOpen(false);
            toast.success("สร้างผู้ใช้งานสำเร็จแล้ว");
            router.refresh(); // Refresh the table
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "สร้างผู้ใช้งานไม่สำเร็จ";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            setError(null);
        }
    }

    if (!isOpen || !mounted) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                variant="primary"
                size="md"
            >
                + เพิ่มผู้ใช้งาน
            </Button>
        );
    }

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                onClick={() => setIsOpen(false)}
            />
            <div className="relative w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-900">เพิ่มผู้ใช้งานใหม่</h2>
                    <Button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        variant="ghost" className="!h-8 !w-8 p-0 rounded-full bg-slate-100 hover:bg-slate-200"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </Button>
                </div>

                {error ? (
                    <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
                        {error}
                    </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-slate-700">อีเมล</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="mt-1.5 block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-inset focus:ring-slate-900 sm:text-sm sm:leading-6 transition-all"
                            placeholder="user@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="deviceLimit" className="block text-sm font-semibold text-slate-700">จำกัดจำนวนอุปกรณ์</label>
                        <input
                            id="deviceLimit"
                            name="deviceLimit"
                            type="number"
                            min="0"
                            defaultValue="1"
                            required
                            className="mt-1.5 block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-inset focus:ring-slate-900 sm:text-sm sm:leading-6 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">วันหมดอายุ</label>
                        {!isCustomDate && (
                            <CustomSelect
                                name="expiresType"
                                value={expiresType}
                                onChange={setExpiresType}
                                options={[
                                    { label: "เพิ่ม 1 วัน", value: "1" },
                                    { label: "เพิ่ม 3 วัน", value: "3" },
                                    { label: "เพิ่ม 7 วัน", value: "7" },
                                    { label: "เพิ่ม 30 วัน", value: "30" },
                                    { label: "เพิ่ม 365 วัน", value: "365" },
                                    { label: "ไม่มีวันหมดอายุ", value: "never" },
                                ]}
                            />
                        )}

                        <div className="mt-4">
                            <Checkbox
                                id="isCustomDate"
                                checked={isCustomDate}
                                onChange={(e) => setIsCustomDate(e.target.checked)}
                                label="กำหนดวันที่และเวลาหมดอายุเอง"
                            />
                        </div>
                    </div>

                    {isCustomDate && (
                        <div id="customDateContainer">
                            <label htmlFor="customExpiresAt" className="block text-sm font-semibold text-slate-700">ระบุวันที่และเวลาหมดอายุ</label>
                            <input
                                id="customExpiresAt"
                                name="customExpiresAt"
                                type="datetime-local"
                                required={isCustomDate}
                                className="mt-1.5 block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-inset focus:ring-slate-900 sm:text-sm sm:leading-6 transition-all"
                            />
                        </div>
                    )}

                    <div className="pt-1 flex gap-2">
                        <Button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            variant="secondary" size="lg" className="w-full"
                            disabled={loading}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            variant="primary" size="lg" className="w-full" isLoading={loading}
                        >
                            {loading ? "" : "บันทึก"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                variant="primary" size="md"
            >
                + เพิ่มผู้ใช้งาน
            </Button>
            {createPortal(modalContent, document.body)}
        </>
    );
}


