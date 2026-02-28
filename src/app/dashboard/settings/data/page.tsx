"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Database,
    DownloadSimple,
    Trash,
    WarningCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

export default function DataManagementPage() {
    const supabase = createClient();

    const [isExporting, setIsExporting] = useState(false);
    const [showDeactivate, setShowDeactivate] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    const handleExport = async () => {
        setIsExporting(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const [profile, vaults, transactions, documents] = await Promise.all([
            supabase
                .from("users_profile")
                .select("*")
                .eq("id", user.id)
                .single(),
            supabase.from("vaults").select("*").eq("user_id", user.id),
            supabase.from("transactions").select("*").eq("user_id", user.id),
            supabase.from("documents").select("*").eq("user_id", user.id),
        ]);

        const exportData = {
            exported_at: new Date().toISOString(),
            profile: profile.data,
            vaults: vaults.data,
            transactions: transactions.data,
            documents: documents.data,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nomadix-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        setIsExporting(false);
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
                    <h2 className="text-lg font-semibold text-zinc-900">
                        Data Management
                    </h2>
                    <p className="text-xs text-zinc-400">
                        Export or manage your personal data
                    </p>
                </div>
            </div>

            {/* Export */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900">
                            Export Your Data
                        </h3>
                        <p className="mt-1 text-xs text-zinc-400">
                            Download all your vaults, transactions, and
                            documents as a JSON file.
                        </p>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                    >
                        <DownloadSimple size={16} />
                        {isExporting ? "Exporting..." : "Export JSON"}
                    </button>
                </div>
            </div>

            {/* Deactivate Account */}
            <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                        <WarningCircle
                            size={20}
                            weight="fill"
                            className="text-red-500"
                        />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-900">
                            Deactivate Account
                        </h3>
                        <p className="mt-1 text-xs text-red-600/70">
                            This will permanently delete your account and all
                            associated data. This action cannot be undone.
                        </p>

                        {!showDeactivate ? (
                            <button
                                onClick={() => setShowDeactivate(true)}
                                className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
                            >
                                <Trash size={16} />
                                Deactivate Account
                            </button>
                        ) : (
                            <div className="mt-4 space-y-3">
                                <p className="text-xs font-medium text-red-700">
                                    Type{" "}
                                    <span className="font-mono font-bold">
                                        DELETE
                                    </span>{" "}
                                    to confirm:
                                </p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) =>
                                        setConfirmText(e.target.value)
                                    }
                                    placeholder="DELETE"
                                    className="w-full max-w-xs rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm text-red-900 placeholder:text-red-300 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowDeactivate(false);
                                            setConfirmText("");
                                        }}
                                        className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        disabled={confirmText !== "DELETE"}
                                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Permanently Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
