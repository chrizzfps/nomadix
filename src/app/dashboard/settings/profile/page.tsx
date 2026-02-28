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
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
    const supabase = createClient();

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
                    full_name: profileData.full_name,
                    email: user.email || "",
                    timezone: profileData.timezone || "Europe/Madrid",
                    base_currency: profileData.base_currency || "EUR",
                    created_at: profileData.created_at,
                });
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

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-24 animate-pulse rounded-2xl bg-zinc-100"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (!profile) return null;

    const memberSince = new Date(profile.created_at).toLocaleDateString(
        "en-US",
        { month: "short", year: "numeric" }
    );

    const initials = profile.full_name
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
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <UserCircle size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                        Profile
                    </h2>
                    <p className="text-xs text-zinc-400">
                        Your public profile overview
                    </p>
                </div>
            </div>

            {/* Profile Card */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {/* Banner */}
                <div className="h-24 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900" />

                {/* Avatar + Info */}
                <div className="px-6 pb-6">
                    <div className="-mt-10 flex items-end gap-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-zinc-900 text-2xl font-bold text-white shadow-lg">
                            {initials}
                        </div>
                        <div className="mb-1">
                            <h3 className="text-xl font-bold text-zinc-900">
                                {profile.full_name}
                            </h3>
                            <p className="text-sm text-zinc-500">
                                {profile.email}
                            </p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="mt-5 flex flex-wrap gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <MapPin size={14} />
                            {profile.timezone.replace("_", " ")}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <CalendarBlank size={14} />
                            Member since {memberSince}
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                            <Crown size={12} weight="fill" />
                            Premium Plan
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <Vault size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                        {stats.vaults}
                    </p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Active Vaults
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <IdentificationCard
                            size={18}
                            className="text-zinc-600"
                        />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                        {stats.documents}
                    </p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Documents
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <CalendarBlank size={18} className="text-zinc-600" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                        {memberSince}
                    </p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Member Since
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                        <Crown
                            size={18}
                            weight="fill"
                            className="text-emerald-500"
                        />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">Premium</p>
                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                        Current Plan
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
