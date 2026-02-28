"use client";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                    Settings
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Manage your account, preferences, and security.
                </p>
            </div>

            {/* Settings Sidebar (mobile tabs) */}
            <div className="lg:hidden">
                <SettingsSidebar />
            </div>

            {/* Desktop Layout: sidebar + content */}
            <div className="flex gap-8">
                <div className="hidden lg:block">
                    <SettingsSidebar />
                </div>
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
