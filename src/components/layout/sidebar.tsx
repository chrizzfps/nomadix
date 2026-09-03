"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    SquaresFour,
    Vault,
    Receipt,
    ArrowsClockwise,
    Sparkle,
    IdentificationCard,
    Airplane,
    GearSix,
    SignOut,
} from "@phosphor-icons/react";
import { signOut } from "@/app/auth/actions";
import { APP_NAME } from "@/lib/constants";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useLanguageStore } from "@/stores/language-store";

const navItems = [
    { href: "/dashboard", key: "nav.dashboard", defaultLabel: "Dashboard", icon: SquaresFour },
    { href: "/dashboard/vaults", key: "nav.vaults", defaultLabel: "Vaults", icon: Vault },
    { href: "/dashboard/expenses", key: "nav.expenses", defaultLabel: "Expenses", icon: Receipt },
    { href: "/dashboard/subscriptions", key: "nav.subscriptions", defaultLabel: "Subscriptions", icon: ArrowsClockwise },
    { href: "/dashboard/reports", key: "nav.reports", defaultLabel: "Reports", icon: Sparkle },
    { href: "/dashboard/identity", key: "nav.identity", defaultLabel: "Identity", icon: IdentificationCard },
    { href: "/dashboard/travel", key: "nav.travel", defaultLabel: "Travel", icon: Airplane },
];

export function Sidebar() {
    const pathname = usePathname();
    const t = useLanguageStore((s) => s.t);

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[220px] flex-col border-r border-border bg-card lg:flex">
            {/* Logo */}
            <div className="flex items-center justify-between gap-3 px-6 py-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
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
                        <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
                        <p className="text-[10px] text-muted-foreground">Premium Plan</p>
                    </div>
                </div>
                <NotificationBell align="left" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 pt-2">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        const label = t(item.key) || item.defaultLabel;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                        active
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                    }`}
                                >
                                    <Icon
                                        size={18}
                                        weight={active ? "fill" : "regular"}
                                    />
                                    {label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Bottom */}
            <div className="border-t border-border px-3 py-4 space-y-1">
                <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                >
                    <GearSix size={18} />
                    {t("nav.settings")}
                </Link>
                <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                >
                    <SignOut size={18} />
                    {t("nav.signOut")}
                </button>
            </div>
        </aside>
    );
}
