import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login/login-form";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/70 bg-white shadow-panel backdrop-blur">
        <section className="flex flex-col px-6 py-10 sm:px-10">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-xl font-medium uppercase  text-emerald-600">
              Admin Login
            </p>
            {/* <h2 className="text-3xl font-semibold text-slate-900">แอดมินล็อกอิน</h2> */}
            <p className="text-sm text-slate-500 mt-2">
              ใช้อีเมลและรหัสผ่านของผู้ดูแลระบบ
            </p>
          </div>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
