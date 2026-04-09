"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import { User } from "@/types/user";

export function UpdateUserForm({ user }: { user: User }) {
    const router = useRouter();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [expiresType, setExpiresType] = useState("unchanged");
    const [isCustomDate, setIsCustomDate] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Clear form states when modal is closed
    useEffect(() => {
        if (!isEditOpen) {
            setError(null);
            setExpiresType("unchanged");
            setIsCustomDate(false);
        }
    }, [isEditOpen]);

    async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        
        const payload: Partial<User> & { expiresType?: string; customExpiresAt?: string; expiresInDays?: number } = {
            id: user.id,
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
            if (expiresType !== "never" && expiresType !== "unchanged") {
                payload.expiresInDays = Number(expiresType);
            }
        }

        try {
            const response = await fetch(`/api/auth/user-controller/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.errors?.[0]?.message || "อัปเดตข้อมูลไม่สำเร็จ");
            }

            setIsEditOpen(false);
            toast.success("อัปเดตข้อมูลผู้ใช้งานแล้ว");
            router.refresh();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "อัปเดตข้อมูลไม่สำเร็จ";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
            setError(null);
        }
    }

    if (!mounted) return null;

    const editModalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsEditOpen(false)} />
            <div className="relative w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-900">แก้ไขข้อมูลผู้ใช้งาน</h2>
                    <Button type="button" onClick={() => setIsEditOpen(false)} variant="ghost" className="!h-8 !w-8 p-0 rounded-full bg-slate-100 hover:bg-slate-200">
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

                <form onSubmit={handleEditSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-slate-700">อีเมล</label>
                        <input id="email" name="email" type="email" defaultValue={user.email} required className="mt-1.5 block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-inset focus:ring-slate-900 sm:text-sm sm:leading-6 transition-all" />
                    </div>

                    <div>
                        <label htmlFor="deviceLimit" className="block text-sm font-semibold text-slate-700">จำกัดอุปกรณ์ <span className="ml-1 text-[11px] font-normal text-rose-500">*(ใส่ 0 เพื่อแบนการใช้งาน)</span></label>
                        <input id="deviceLimit" name="deviceLimit" type="number" min="0" defaultValue={user.deviceLimit} required className="mt-1.5 block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-inset focus:ring-slate-900 sm:text-sm sm:leading-6 transition-all" />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">ปรับวันหมดอายุ</label>
                        {!isCustomDate && (
                            <CustomSelect
                                name="expiresType"
                                value={expiresType}
                                onChange={setExpiresType}
                                options={[
                                    { label: `คงเดิม (${user.expiresAt ? "หมดอายุตามกำหนด" : "ไม่มีวันหมดอายุ"})`, value: "unchanged" },
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
                                id={`editIsCustomDate-${user.id}`}
                                checked={isCustomDate}
                                onChange={(e) => setIsCustomDate(e.target.checked)}
                                label="กำหนดวันที่และเวลาหมดอายุเอง"
                            />
                        </div>
                    </div>

                    {isCustomDate && (
                        <div id="editCustomDateContainer">
                            <label htmlFor={`customExpiresAt-${user.id}`} className="block text-sm font-semibold text-slate-700">ระบุวันที่และเวลาหมดอายุ</label>
                            <input id={`customExpiresAt-${user.id}`} name="customExpiresAt" type="datetime-local" required={isCustomDate} className="mt-1.5 block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-1 focus:ring-inset focus:ring-slate-900 sm:text-sm sm:leading-6 transition-all" />
                        </div>
                    )}

                    <div className="pt-2 flex gap-1">
                        <Button type="button" onClick={() => setIsEditOpen(false)} variant="secondary" size="lg" className="w-full" disabled={loading}>
                            ยกเลิก
                        </Button>
                        <Button type="submit" isLoading={loading} variant="primary" size="lg" className="w-full">
                            {loading ? "" : "บันทึก"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setIsEditOpen(true)}
                className="flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="แก้ไขข้อมูลผู้ใช้งาน"
            >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>

            {isEditOpen && createPortal(editModalContent, document.body)}
        </>
    );
}
