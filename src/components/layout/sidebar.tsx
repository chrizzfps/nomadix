"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    SquaresFour,
    Vault,
    Receipt,
    IdentificationCard,
    Airplane,
    GearSix,
    SignOut,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
    { href: "/dashboard/vaults", label: "Vaults", icon: Vault },
    { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
    { href: "/dashboard/identity", label: "Identity", icon: IdentificationCard },
    { href: "/dashboard/travel", label: "Travel", icon: Airplane },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[220px] flex-col border-r border-zinc-200 bg-white lg:flex">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-900">{APP_NAME}</p>
                    <p className="text-[10px] text-zinc-400">Premium Plan</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 pt-2">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active
                                            ? "bg-zinc-900 text-white"
                                            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                        }`}
                                >
                                    <Icon
                                        size={18}
                                        weight={active ? "fill" : "regular"}
                                    />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Bottom */}
            <div className="border-t border-zinc-100 px-3 py-4 space-y-1">
                <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
                >
                    <GearSix size={18} />
                    Settings
                </Link>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
                >
                    <SignOut size={18} />
                    Log Out
                </button>
            </div>
        </aside>
    );
}
