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
    Sparkle,
} from "@phosphor-icons/react";
import { useLanguageStore } from "@/stores/language-store";

const settingsNav = [
    { href: "/dashboard/settings", key: "settings.account", defaultLabel: "Account", icon: User, exact: true },
    { href: "/dashboard/settings/profile", key: "settings.profile", defaultLabel: "Profile", icon: UserCircle },
    { href: "/dashboard/settings/preferences", key: "settings.preferences", defaultLabel: "Preferences", icon: Sliders },
    { href: "/dashboard/settings/categories", key: "settings.categories", defaultLabel: "Categories", icon: Tag },
    { href: "/dashboard/settings/ai", key: "settings.ai", defaultLabel: "AI Assistant", icon: Sparkle },
    { href: "/dashboard/settings/data", key: "settings.data", defaultLabel: "Data", icon: Database },
    { href: "/dashboard/settings/security", key: "settings.security", defaultLabel: "Security", icon: ShieldCheck },
    { href: "/dashboard/settings/notifications", key: "settings.notifications", defaultLabel: "Notifications", icon: Bell },
    { href: "/dashboard/settings/billing", key: "settings.billing", defaultLabel: "Billing", icon: CreditCard },
    { href: "/dashboard/settings/language", key: "settings.language", defaultLabel: "Language & Region", icon: Translate },
    { href: "/dashboard/settings/support", key: "settings.support", defaultLabel: "Support", icon: Headset },
];

export function SettingsSidebar() {
    const pathname = usePathname();
    const t = useLanguageStore((s) => s.t);

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
                        const label = t(item.key) || item.defaultLabel;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                }`}
                            >
                                <Icon
                                    size={16}
                                    weight={active ? "fill" : "regular"}
                                />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Mobile horizontal tabs */}
            <div className="lg:hidden -mx-6 mb-6 overflow-x-auto border-b border-border px-6">
                <div className="flex gap-1 pb-2">
                    {settingsNav.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href, item.exact);
                        const label = t(item.key) || item.defaultLabel;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent"
                                }`}
                            >
                                <Icon size={14} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
