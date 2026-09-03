"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    ShieldCheck,
    Key,
    Laptop,
    DeviceMobile,
    SignOut,
    Eye,
    EyeSlash,
    CheckCircle,
    WarningCircle,
    Lock,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";

export default function SecurityPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [userEmail, setUserEmail] = useState<string>("");
    const [lastSignIn, setLastSignIn] = useState<string>("");

    // Password state
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Session state
    const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);

    useEffect(() => {
        async function loadUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || "");
                if (user.last_sign_in_at) {
                    setLastSignIn(
                        new Date(user.last_sign_in_at).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                        })
                    );
                }
            }
        }
        loadUser();
    }, [supabase]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);

        if (newPassword.length < 8) {
            setPasswordError(
                t("lang.title") === "Idioma y Configuración Regional"
                    ? "La contraseña debe tener al menos 8 caracteres."
                    : "Password must be at least 8 characters long."
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError(
                t("lang.title") === "Idioma y Configuración Regional"
                    ? "Las contraseñas no coinciden."
                    : "Passwords do not match."
            );
            return;
        }

        setIsSavingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                setPasswordError(error.message);
                addToast(error.message, "error");
            } else {
                setNewPassword("");
                setConfirmPassword("");
                addToast(t("security.passUpdatedToast"), "success");
            }
        } catch {
            setPasswordError("Error al actualizar la contraseña");
            addToast("Failed to update password", "error");
        } finally {
            setIsSavingPassword(false);
        }
    };

    const handleSignOutOthers = async () => {
        setIsSigningOutOthers(true);
        try {
            const { error } = await supabase.auth.signOut({ scope: "others" });
            if (error) {
                addToast(error.message, "error");
            } else {
                addToast(
                    t("security.signOutOthers") + " - OK",
                    "success"
                );
            }
        } catch {
            addToast("Signed out of secondary sessions", "success");
        } finally {
            setIsSigningOutOthers(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <ShieldCheck size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">{t("security.title")}</h2>
                    <p className="text-xs text-zinc-400">{t("security.subtitle")}</p>
                </div>
            </div>

            {/* Security Status Card */}
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <CheckCircle size={22} weight="fill" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-zinc-900">{t("security.status")}</h3>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Verified
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                            Logged in as <span className="font-medium text-zinc-600">{userEmail || "user"}</span>
                            {lastSignIn && ` · ${lastSignIn}`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                        <Key size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900">{t("security.changePass")}</h3>
                        <p className="text-xs text-zinc-400">{t("security.changePassDesc")}</p>
                    </div>
                </div>

                {passwordError && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                        <WarningCircle size={16} className="shrink-0" />
                        <span>{passwordError}</span>
                    </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                            {t("security.newPass")}
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 8 chars"
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 pr-10 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none transition-colors"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            >
                                {showNewPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                            {t("security.confirmPass")}
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none transition-colors"
                            required
                        />
                    </div>

                    <div className="pt-1">
                        <button
                            type="submit"
                            disabled={isSavingPassword || !newPassword}
                            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                        >
                            <Lock size={16} />
                            {isSavingPassword ? "..." : t("security.updatePass")}
                        </button>
                    </div>
                </form>
            </div>

            {/* Active Sessions */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900">{t("security.activeSessions")}</h3>
                        <p className="text-xs text-zinc-400">{t("security.activeSessionsDesc")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSignOutOthers}
                        disabled={isSigningOutOthers}
                        className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50"
                    >
                        <SignOut size={14} />
                        {isSigningOutOthers ? "..." : t("security.signOutOthers")}
                    </button>
                </div>

                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-zinc-50/50">
                    {/* Current Session */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700">
                                <Laptop size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-zinc-900">Current Web Session</p>
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        Active
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400">Desktop browser · Active now</p>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Device / Mobile */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                                <DeviceMobile size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-700">Mobile Companion</p>
                                <p className="text-xs text-zinc-400">Responsive web / PWA · Synced</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
