"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, FloppyDisk, Check, ShieldCheck, UserCircle, Bell } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";

const TIMEZONES = [
    "Europe/Madrid",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Asia/Dubai",
    "Australia/Sydney",
    "Pacific/Auckland",
];

export default function AccountSettingsPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [timezone, setTimezone] = useState("Europe/Madrid");
    const [baseCurrency, setBaseCurrency] = useState<"EUR" | "USD">("EUR");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadProfile() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            setEmail(user.email || "");

            const { data: profile } = await supabase
                .from("users_profile")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profile) {
                setFullName(profile.full_name || "");
                setTimezone(profile.timezone || "Europe/Madrid");
                setBaseCurrency(profile.base_currency || "EUR");
            }
            setIsLoading(false);
        }

        loadProfile();
    }, [supabase]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSaved(false);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error: updateError } = await supabase
            .from("users_profile")
            .update({
                full_name: fullName.trim(),
                timezone,
                base_currency: baseCurrency,
                updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

        if (updateError) {
            setError(updateError.message);
            addToast(updateError.message, "error");
        } else {
            setSaved(true);
            addToast("Settings saved");
            setTimeout(() => setSaved(false), 2000);
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-16 animate-pulse rounded-xl bg-accent"
                    />
                ))}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Section Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <User size={20} className="text-foreground/70" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        {t("account.title")}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {t("account.subtitle")}
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="space-y-5">
                    {/* Avatar placeholder */}
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                            {fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "?"}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                {fullName || "Your Name"}
                            </p>
                            <p className="text-xs text-muted-foreground">{email}</p>
                        </div>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                            {t("account.fullName")}
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                            {t("account.email")}
                        </label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-muted-foreground cursor-not-allowed"
                        />
                    </div>

                    {/* Timezone */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                            {t("account.timezone")}
                        </label>
                        <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors appearance-none"
                        >
                            {TIMEZONES.map((tz) => (
                                <option key={tz} value={tz}>
                                    {tz.replace("_", " ")}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Base Currency */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                            {t("account.baseCurrency")}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(["EUR", "USD"] as const).map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setBaseCurrency(c)}
                                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${baseCurrency === c
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-card text-muted-foreground hover:border-ring"
                                        }`}
                                >
                                    {c === "EUR" ? "€ EUR" : "$ USD"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}
                </div>

                {/* Save Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !fullName.trim()}
                        className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${saved
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                    >
                        {saved ? (
                            <>
                                <Check size={16} weight="bold" />
                                {t("account.saved")}
                            </>
                        ) : (
                            <>
                                <FloppyDisk size={16} />
                                {isSaving ? t("account.saving") : t("account.saveChanges")}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Link
                    href="/dashboard/settings/security"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-ring hover:shadow-sm"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-foreground/80">
                        <ShieldCheck size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-foreground">Security & Password</p>
                        <p className="text-[11px] text-muted-foreground">Update credentials</p>
                    </div>
                </Link>

                <Link
                    href="/dashboard/settings/profile"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-ring hover:shadow-sm"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-foreground/80">
                        <UserCircle size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-foreground">Public Profile</p>
                        <p className="text-[11px] text-muted-foreground">Bio & tax residency</p>
                    </div>
                </Link>

                <Link
                    href="/dashboard/settings/notifications"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-ring hover:shadow-sm"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-foreground/80">
                        <Bell size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-foreground">Notification Alerts</p>
                        <p className="text-[11px] text-muted-foreground">Bills & vault warnings</p>
                    </div>
                </Link>
            </div>
        </motion.div>
    );
}
