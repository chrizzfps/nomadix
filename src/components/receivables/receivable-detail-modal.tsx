"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, HandCoins, PencilSimple, Trash, CheckCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { effectiveStatus, outstandingAmount } from "@/lib/receivables";
import { DueBadge } from "@/components/subscriptions/due-badge";
import type { Receivable } from "@/types";

interface ReceivableDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    receivable: Receivable | null;
    onEdit: () => void;
    onCollect: () => void;
    onChanged: () => void;
}

export function ReceivableDetailModal({
    isOpen,
    onClose,
    receivable: r,
    onEdit,
    onCollect,
    onChanged,
}: ReceivableDetailModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);

    if (!r) return null;

    const symbol = CURRENCY_SYMBOLS[r.currency] || "$";
    const isClosed = r.status === "paid" || r.status === "canceled";
    const isOverdue = effectiveStatus(r).status === "overdue";

    const handleCancel = async () => {
        setIsCanceling(true);
        const { error } = await supabase
            .from("receivables")
            .update({ status: "canceled" })
            .eq("id", r.id);
        setIsCanceling(false);
        if (error) {
            addToast(error.message, "error");
            return;
        }
        addToast(t("receivables.toast.canceled"));
        setConfirmCancel(false);
        onChanged();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
                                    <HandCoins size={20} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">{r.client_name}</h2>
                                    <p className="text-xs text-muted-foreground">{r.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="rounded-xl border border-border bg-accent/40 p-4 text-center">
                                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                    {r.status === "paid"
                                        ? t("receivables.detail.collected")
                                        : t("receivables.detail.outstanding")}
                                </p>
                                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                                    {symbol}
                                    {(r.status === "paid" ? r.amount_collected : outstandingAmount(r)).toLocaleString(
                                        "en-US",
                                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                    )}
                                </p>
                                {r.status === "partial" && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {symbol}
                                        {r.amount_collected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        {" "}
                                        {t("receivables.detail.collectedOfTotal")}
                                        {" "}
                                        {symbol}
                                        {r.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t("receivables.field.expectedDate")}</span>
                                {isClosed ? (
                                    <span className="text-foreground">{r.expected_date}</span>
                                ) : (
                                    <DueBadge dueDate={r.expected_date} />
                                )}
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t("receivables.field.issueDate")}</span>
                                <span className="text-foreground">{r.issue_date}</span>
                            </div>

                            {r.notes && (
                                <div className="rounded-xl border border-border bg-accent/30 p-3">
                                    <p className="text-xs text-muted-foreground">{r.notes}</p>
                                </div>
                            )}

                            {isOverdue && (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                                    {t("receivables.detail.overdueWarning")}
                                </div>
                            )}
                        </div>

                        {!isClosed && (
                            <div className="mt-6 space-y-2">
                                <button
                                    onClick={onCollect}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98]"
                                >
                                    <CheckCircle size={16} weight="bold" />
                                    {t("receivables.detail.collectAction")}
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={onEdit}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
                                    >
                                        <PencilSimple size={15} />
                                        {t("common.edit")}
                                    </button>
                                    {confirmCancel ? (
                                        <button
                                            onClick={handleCancel}
                                            disabled={isCanceling}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                                        >
                                            {t("common.confirm")}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmCancel(true)}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                                        >
                                            <Trash size={15} />
                                            {t("receivables.detail.cancelAction")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
