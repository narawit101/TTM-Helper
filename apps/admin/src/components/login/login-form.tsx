"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        const formData = new FormData(event.currentTarget);
        const payload = {
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? "")
        };

        startTransition(async () => {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { message?: string } | null;
            const errorMsg = data?.message ?? "เข้าสู่ระบบไม่สำเร็จ";
            setError(errorMsg);
            toast.error(errorMsg);
            return;
          }

          toast.success("เข้าสู่ระบบสำเร็จ");
          // ใช้ window.location.href เพื่อบังคับโหลดหน้าใหม่ให้สถานะ Session อัปเดตสมบูรณ์และตัดปัญหา Cache ของ Next.js
          window.location.href = "/dashboard";
        });
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-900">อีเมล</span>
        <input
          required
          autoComplete="email"
          className="w-full rounded-2xl border bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
          name="email"
          placeholder="admin@example.com"
          type="email"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-900">รหัสผ่าน</span>
        <input
          required
          autoComplete="current-password"
          className="w-full rounded-2xl border bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
          name="password"
          placeholder="••••••••"
          type="password"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <Button
        className="w-full mt-4 text-center"
        size="lg"
        variant="primary"
        isLoading={isPending}
        type="submit"
      >
        {isPending ? "" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
