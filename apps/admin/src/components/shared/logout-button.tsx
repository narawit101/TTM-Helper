"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="md"
      isLoading={isPending}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/auth/logout", {
            method: "POST"
          });
          router.replace("/login");
          router.refresh();
        });
      }}
      type="button"
      className="group flex w-full items-center justify-center gap-3 text-slate-700 transition-all hover:bg-red-50 hover:text-red-500"
    >
      <Icon icon="majesticons:logout-line" className="text-xl flex-shrink-0 text-slate-500 transition-colors group-hover:text-red-500" />
      <span className="font-medium">ออกจากระบบ</span>
    </Button>
  );
}
