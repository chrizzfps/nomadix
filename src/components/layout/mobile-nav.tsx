"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    SquaresFour,
    Vault,
    Receipt,
    ArrowsClockwise,
    Sparkle,
    IdentificationCard,
    Airplane,
    List,
    X,
    GearSix,
    SignOut,
} from "@phosphor-icons/react";
import { signOut } from "@/app/auth/actions";
import { AnimatePresence, motion } from "framer-motion";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useLanguageStore } from "@/stores/language-store";

const navItems = [
    { href: "/dashboard", key: "nav.dashboard", defaultLabel: "Dashboard", icon: SquaresFour },
    { href: "/dashboard/vaults", key: "nav.vaults", defaultLabel: "Vaults", icon: Vault },
    { href: "/dashboard/expenses", key: "nav.expenses", defaultLabel: "Expenses", icon: Receipt },
    { href: "/dashboard/subscriptions", key: "nav.subscriptions", defaultLabel: "Subs", icon: ArrowsClockwise },
    { href: "/dashboard/travel", key: "nav.travel", defaultLabel: "Travel", icon: Airplane },
];

const moreNavItems = [
    { href: "/dashboard/reports", key: "nav.reports", defaultLabel: "Reports", icon: Sparkle },
    { href: "/dashboard/identity", key: "nav.identity", defaultLabel: "Identity", icon: IdentificationCard },
];

export function MobileNav() {
    const pathname = usePathname();
    const t = useLanguageStore((s) => s.t);
    const [isOpen, setIsOpen] = useState(false);

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Mobile Top Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-xl px-4 py-3 lg:hidden">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <svg
                            width="14"
                            height="14"
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
                    <span className="text-sm font-semibold text-foreground">Nomadix</span>
                </div>
                <div className="flex items-center gap-1">
                    <NotificationBell align="right" />
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="rounded-lg p-1.5 text-foreground hover:bg-accent transition-colors"
                    >
                        {isOpen ? <X size={20} /> : <List size={20} />}
                    </button>
                </div>
            </div>

            {/* Hamburger Menu Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="fixed top-[57px] left-0 right-0 z-50 border-b border-border bg-card px-4 py-3 shadow-lg lg:hidden"
                        >
                            <div className="space-y-1">
                                {moreNavItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    const label = t(item.key) || item.defaultLabel;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsOpen(false)}
                                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                                active
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:bg-accent"
                                            }`}
                                        >
                                            <Icon size={18} weight={active ? "fill" : "regular"} />
                                            {label}
                                        </Link>
                                    );
                                })}
                                <Link
                                    href="/dashboard/settings"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent"
                                >
                                    <GearSix size={18} />
                                    {t("nav.settings")}
                                </Link>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        signOut();
                                    }}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent"
                                >
                                    <SignOut size={18} />
                                    {t("nav.signOut")}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
                <div className="flex items-center justify-around px-2 py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        const label = t(item.key) || item.defaultLabel;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors ${
                                    active ? "text-foreground" : "text-muted-foreground"
                                }`}
                            >
                                <Icon size={20} weight={active ? "fill" : "regular"} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
