"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { User } from "@/types/user";

export function DeleteUserForm({ user }: { user: User }) {
    const router = useRouter();
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    async function handleDeleteSubmit() {
        setLoading(true);
        try {
            const response = await fetch(`/api/auth/user-controller/${user.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || "ลบผู้ใช้งานไม่สำเร็จ");
            }
            toast.success("ลบผู้ใช้งานเรียบร้อยแล้ว");
            setIsDeleteOpen(false);
            router.refresh();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "ลบผู้ใช้งานไม่สำเร็จ";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    if (!mounted) return null;

    const deleteModalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsDeleteOpen(false)} />
            <div className="relative w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">ลบรายชื่อผู้ใช้งาน</h2>
                    <p className="mt-2 text-sm text-slate-500">
                        คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-semibold text-slate-700">{user.email}</span>? หากลบแล้วจะไม่สามารถเรียกคืนข้อมูลได้อีก
                    </p>
                </div>
                <div className="mt-6 flex gap-3">
                    <Button type="button" onClick={() => setIsDeleteOpen(false)} variant="secondary" size="lg" className="w-full" disabled={loading}>
                        ยกเลิก
                    </Button>
                    <Button type="button" onClick={handleDeleteSubmit} isLoading={loading} variant="danger" size="lg" className="w-full">
                        {loading ? "" : "ลบผู้ใช้งาน"}
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setIsDeleteOpen(true)}
                disabled={loading}
                className="flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                title="ลบผู้ใช้งาน"
            >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>

            {isDeleteOpen && createPortal(deleteModalContent, document.body)}
        </>
    );
}
