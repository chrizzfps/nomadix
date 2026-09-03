"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    UserCircle,
    Vault,
    IdentificationCard,
    CalendarBlank,
    Crown,
    MapPin,
    PencilSimple,
    FloppyDisk,
    Globe,
    Briefcase,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";

interface ExtendedNomadProfile {
    bio: string;
    occupation: string;
    taxResidency: string;
    website: string;
}

const DEFAULT_EXTENDED: ExtendedNomadProfile = {
    bio: "Digital nomad navigating multi-currency finances and global ventures.",
    occupation: "Remote Professional / Founder",
    taxResidency: "Spain / Nomad Tax Status",
    website: "https://nomadix.app",
};

const EXTENDED_KEY = "nomadix_profile_extended";

function loadExtendedProfile(): ExtendedNomadProfile {
    if (typeof window === "undefined") return DEFAULT_EXTENDED;
    try {
        const raw = localStorage.getItem(EXTENDED_KEY);
        if (!raw) return DEFAULT_EXTENDED;
        return { ...DEFAULT_EXTENDED, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_EXTENDED;
    }
}

export default function ProfilePage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [profile, setProfile] = useState<{
        full_name: string;
        email: string;
        timezone: string;
        base_currency: string;
        created_at: string;
    } | null>(null);

    const [stats, setStats] = useState({
        vaults: 0,
        documents: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [extended, setExtended] = useState<ExtendedNomadProfile>(loadExtendedProfile);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadData() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profileData } = await supabase
                .from("users_profile")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profileData) {
                setProfile({
                    full_name: profileData.full_name || "Nomad User",
                    email: user.email || "",
                    timezone: profileData.timezone || "Europe/Madrid",
                    base_currency: profileData.base_currency || "EUR",
                    created_at: profileData.created_at,
                });
                setEditName(profileData.full_name || "");
            }

            const { count: vaultCount } = await supabase
                .from("vaults")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id);

            const { count: docCount } = await supabase
                .from("documents")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id);

            setStats({
                vaults: vaultCount || 0,
                documents: docCount || 0,
            });

            setIsLoading(false);
        }

        loadData();
    }, [supabase]);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            if (editName.trim()) {
                await supabase
                    .from("users_profile")
                    .update({
                        full_name: editName.trim(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", user.id);

                setProfile((prev) => (prev ? { ...prev, full_name: editName.trim() } : null));
            }

            if (typeof window !== "undefined") {
                localStorage.setItem(EXTENDED_KEY, JSON.stringify(extended));
            }

            setIsEditing(false);
            addToast("Profile details updated successfully", "success");
        } catch (e: any) {
            addToast(e?.message || "Failed to update profile", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
                    ))}
                </div>
            </div>
        );
    }

    if (!profile) return null;

    const memberSince = new Date(profile.created_at || Date.now()).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });

    const initials = (profile.full_name || "N")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <UserCircle size={20} className="text-zinc-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900">{t("profile.title")}</h2>
                        <p className="text-xs text-zinc-400">
                            {t("profile.subtitle")}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all shadow-sm"
                >
                    <PencilSimple size={14} />
                    {isEditing ? t("profile.cancel") : t("profile.edit")}
                </button>
            </div>

            {/* Profile Card */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {/* Banner */}
                <div className="h-28 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950" />

                {/* Avatar + Info */}
                <div className="px-6 pb-6">
                    <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-zinc-900 text-3xl font-bold text-white shadow-lg shrink-0">
                            {initials}
                        </div>
                        <div className="mb-1 flex-1">
                            <h3 className="text-xl font-bold text-zinc-900">{profile.full_name}</h3>
                            <p className="text-xs font-medium text-zinc-500">{extended.occupation}</p>
                            <p className="mt-2 text-xs text-zinc-600 max-w-xl leading-relaxed">
                                {extended.bio}
                            </p>
                        </div>
                    </div>

                    {/* Details Badges */}
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <MapPin size={14} className="text-zinc-400" />
                            {extended.taxResidency}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Globe size={14} className="text-zinc-400" />
                            {extended.website}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <CalendarBlank size={14} className="text-zinc-400" />
                            Member since {memberSince}
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                            <Crown size={12} weight="fill" className="text-zinc-900" />
                            Premium Plan
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Profile Form Modal / Box */}
            {isEditing && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                    <h3 className="text-sm font-semibold text-zinc-900 mb-4">Edit Profile Information</h3>
                    <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Title / Occupation
                            </label>
                            <input
                                type="text"
                                value={extended.occupation}
                                onChange={(e) => setExtended({ ...extended, occupation: e.target.value })}
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Bio / Description
                            </label>
                            <textarea
                                value={extended.bio}
                                onChange={(e) => setExtended({ ...extended, bio: e.target.value })}
                                rows={3}
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                    Tax Residency / Country
                                </label>
                                <input
                                    type="text"
                                    value={extended.taxResidency}
                                    onChange={(e) => setExtended({ ...extended, taxResidency: e.target.value })}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                    Website / Link
                                </label>
                                <input
                                    type="text"
                                    value={extended.website}
                                    onChange={(e) => setExtended({ ...extended, website: e.target.value })}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                            >
                                <FloppyDisk size={14} />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <Vault size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">{stats.vaults}</p>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
                        {t("profile.activeVaults")}
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <IdentificationCard size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">{stats.documents}</p>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
                        {t("profile.documents")}
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <CalendarBlank size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">{memberSince}</p>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
                        {t("profile.memberSince")}
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                        <Crown size={18} weight="fill" className="text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">Premium</p>
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
                        {t("profile.plan")}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
