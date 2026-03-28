"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    User,
    UserCircle,
    ShieldCheck,
    Bell,
    CreditCard,
    Translate,
    Headset,
    Sliders,
    Database,
    Tag,
} from "@phosphor-icons/react";

const settingsNav = [
    { href: "/dashboard/settings", label: "Account", icon: User, exact: true },
    { href: "/dashboard/settings/profile", label: "Profile", icon: UserCircle },
    { href: "/dashboard/settings/preferences", label: "Preferences", icon: Sliders },
    { href: "/dashboard/settings/categories", label: "Categories", icon: Tag },
    { href: "/dashboard/settings/data", label: "Data", icon: Database },
    { href: "/dashboard/settings/security", label: "Security", icon: ShieldCheck },
    { href: "/dashboard/settings/notifications", label: "Notifications", icon: Bell },
    { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard },
    { href: "/dashboard/settings/language", label: "Language", icon: Translate },
    { href: "/dashboard/settings/support", label: "Support", icon: Headset },
];

export function SettingsSidebar() {
    const pathname = usePathname();

    const isActive = (href: string, exact?: boolean) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-[200px] shrink-0">
                <nav className="sticky top-8 space-y-1">
                    {settingsNav.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href, item.exact);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${active
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                    }`}
                            >
                                <Icon
                                    size={16}
                                    weight={active ? "fill" : "regular"}
                                />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Mobile horizontal tabs */}
            <div className="lg:hidden -mx-6 mb-6 overflow-x-auto border-b border-zinc-200 px-6">
                <div className="flex gap-1 pb-2">
                    {settingsNav.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href, item.exact);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${active
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-500 hover:bg-zinc-100"
                                    }`}
                            >
                                <Icon size={14} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
