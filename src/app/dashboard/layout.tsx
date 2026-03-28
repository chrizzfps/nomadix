import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ToastContainer } from "@/components/shared/toast";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="min-h-screen bg-zinc-50">
                <Sidebar />
                <MobileNav />
                <main className="lg:ml-[220px]">
                    <div className="pt-14 pb-20 lg:pt-0 lg:pb-0">
                        {children}
                    </div>
                </main>
                <ToastContainer />
            </div>
        </AuthGuard>
    );
}
