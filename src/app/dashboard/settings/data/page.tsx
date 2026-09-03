"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Database,
    DownloadSimple,
    FileCsv,
    Trash,
    WarningCircle,
    CheckCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";

export default function DataManagementPage() {
    const router = useRouter();
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [isExportingJson, setIsExportingJson] = useState(false);
    const [isExportingCsv, setIsExportingCsv] = useState(false);
    const [showDeactivate, setShowDeactivate] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Export comprehensive JSON backup
    const handleExportJson = async () => {
        setIsExportingJson(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated.");

            const [profile, vaults, transactions, documents, subscriptions, categories] =
                await Promise.all([
                    supabase.from("users_profile").select("*").eq("id", user.id).maybeSingle(),
                    supabase.from("vaults").select("*").eq("user_id", user.id),
                    supabase.from("transactions").select("*").eq("user_id", user.id),
                    supabase.from("documents").select("*").eq("user_id", user.id),
                    supabase.from("subscriptions").select("*").eq("user_id", user.id),
                    supabase.from("transaction_categories").select("*").eq("user_id", user.id),
                ]);

            const exportData = {
                app: "Nomadix",
                exported_at: new Date().toISOString(),
                user_id: user.id,
                email: user.email,
                profile: profile.data,
                vaults: vaults.data || [],
                transactions: transactions.data || [],
                documents: documents.data || [],
                subscriptions: subscriptions.data || [],
                categories: categories.data || [],
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `nomadix-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            addToast("Full backup downloaded successfully", "success");
        } catch (e: any) {
            addToast(e?.message || "Failed to export data", "error");
        } finally {
            setIsExportingJson(false);
        }
    };

    // Export accounting-ready CSV of transactions
    const handleExportCsv = async () => {
        setIsExportingCsv(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated.");

            const { data: txs, error } = await supabase
                .from("transactions")
                .select("*")
                .eq("user_id", user.id)
                .order("date", { ascending: false });

            if (error) throw error;
            if (!txs || txs.length === 0) {
                addToast("No transactions found to export", "info");
                setIsExportingCsv(false);
                return;
            }

            // CSV header
            const headers = [
                "ID",
                "Date",
                "Description",
                "Type",
                "Category",
                "Amount",
                "Currency",
                "Vault ID",
                "Fee",
                "Exchange Rate",
                "Created At",
            ];

            const rows = txs.map((t) => [
                t.id,
                t.date || "",
                `"${(t.description || "").replace(/"/g, '""')}"`,
                t.type || "",
                `"${(t.category || "").replace(/"/g, '""')}"`,
                t.amount,
                t.original_currency || "USD",
                t.vault_id || "",
                t.fee || 0,
                t.exchange_rate_at_time || "",
                t.created_at || "",
            ]);

            const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `nomadix-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            addToast("Transactions CSV downloaded", "success");
        } catch (e: any) {
            addToast(e?.message || "Failed to export CSV", "error");
        } finally {
            setIsExportingCsv(false);
        }
    };

    // Deactivate / Account deletion
    const handlePermanentlyDelete = async () => {
        if (confirmText !== "DELETE") return;
        setIsDeleting(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user.");

            // Wipe user records
            await Promise.all([
                supabase.from("transactions").delete().eq("user_id", user.id),
                supabase.from("documents").delete().eq("user_id", user.id),
                supabase.from("vaults").delete().eq("user_id", user.id),
                supabase.from("subscriptions").delete().eq("user_id", user.id),
                supabase.from("user_exchange_rates").delete().eq("user_id", user.id),
            ]);

            // Sign out
            await supabase.auth.signOut();
            if (typeof window !== "undefined") {
                localStorage.clear();
            }

            addToast("Account data removed. You have been signed out.", "info");
            router.push("/auth/login");
        } catch (e: any) {
            addToast(e?.message || "Failed to delete account data", "error");
            setIsDeleting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Section Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <Database size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">{t("data.title")}</h2>
                    <p className="text-xs text-zinc-400">
                        {t("data.subtitle")}
                    </p>
                </div>
            </div>

            {/* Export Cards */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    {t("data.exportSection")}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* JSON Backup */}
                    <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 mb-3">
                                <DownloadSimple size={20} />
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-900">{t("data.jsonTitle")}</h4>
                            <p className="mt-1 text-xs text-zinc-400">
                                {t("data.jsonDesc")}
                            </p>
                        </div>
                        <div className="pt-4">
                            <button
                                type="button"
                                onClick={handleExportJson}
                                disabled={isExportingJson}
                                className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                            >
                                <DownloadSimple size={15} />
                                {isExportingJson ? "Exporting JSON..." : t("data.downloadJson")}
                            </button>
                        </div>
                    </div>

                    {/* CSV Export */}
                    <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 mb-3">
                                <FileCsv size={20} />
                            </div>
                            <h4 className="text-sm font-semibold text-zinc-900">{t("data.csvTitle")}</h4>
                            <p className="mt-1 text-xs text-zinc-400">
                                {t("data.csvDesc")}
                            </p>
                        </div>
                        <div className="pt-4">
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={isExportingCsv}
                                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50"
                            >
                                <FileCsv size={15} />
                                {isExportingCsv ? "Exporting CSV..." : t("data.downloadCsv")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Deactivate Account */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-red-500">
                    {t("data.danger")}
                </h3>

                <div className="rounded-2xl border border-red-200 bg-red-50/20 p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                            <WarningCircle size={20} weight="fill" className="text-red-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-red-900">
                                {t("data.deleteTitle")}
                            </h3>
                            <p className="mt-1 text-xs text-red-600/80">
                                {t("data.deleteDesc")}
                            </p>

                            {!showDeactivate ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeactivate(true)}
                                    className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50"
                                >
                                    <Trash size={15} />
                                    {t("data.deleteBtn")}
                                </button>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    <p className="text-xs font-medium text-red-700">
                                        Type <span className="font-mono font-bold">DELETE</span> to confirm:
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                        className="w-full max-w-xs rounded-xl border border-red-200 bg-white px-4 py-2 text-sm text-red-900 placeholder:text-red-300 focus:border-red-400 focus:outline-none"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDeactivate(false);
                                                setConfirmText("");
                                            }}
                                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-600 transition-all hover:bg-zinc-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePermanentlyDelete}
                                            disabled={confirmText !== "DELETE" || isDeleting}
                                            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {isDeleting ? "Wiping data..." : "Permanently Delete Everything"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
