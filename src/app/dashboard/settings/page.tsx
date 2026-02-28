"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, FloppyDisk, Check } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";

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
                        className="h-16 animate-pulse rounded-xl bg-zinc-100"
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <User size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                        Account Settings
                    </h2>
                    <p className="text-xs text-zinc-400">
                        Manage your personal information
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="space-y-5">
                    {/* Avatar placeholder */}
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-xl font-bold text-white">
                            {fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "?"}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">
                                {fullName || "Your Name"}
                            </p>
                            <p className="text-xs text-zinc-400">{email}</p>
                        </div>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-500 cursor-not-allowed"
                        />
                    </div>

                    {/* Timezone */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                            Timezone
                        </label>
                        <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors appearance-none"
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
                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                            Base Currency
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(["EUR", "USD"] as const).map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setBaseCurrency(c)}
                                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${baseCurrency === c
                                        ? "border-zinc-900 bg-zinc-900 text-white"
                                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
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
                            : "bg-zinc-900 text-white hover:bg-zinc-800"
                            }`}
                    >
                        {saved ? (
                            <>
                                <Check size={16} weight="bold" />
                                Saved
                            </>
                        ) : (
                            <>
                                <FloppyDisk size={16} />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
