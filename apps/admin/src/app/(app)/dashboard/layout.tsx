import { SideNav } from "@/components/shared/side-nav";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
            <SideNav userEmail={session.email} />
            <div className="flex flex-1 flex-col overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
