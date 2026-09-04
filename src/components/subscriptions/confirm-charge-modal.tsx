"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { formatDueDate } from "@/lib/subscriptions";
import type { Subscription } from "@/types";

interface ConfirmChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    subscription: Subscription | null;
    dueDate: string | null;
    vaultName?: string;
}

export function ConfirmChargeModal({
    isOpen,
    onClose,
    onDone,
    subscription,
    dueDate,
    vaultName,
}: ConfirmChargeModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && subscription) {
            setAmount(String(subscription.amount));
            setNote("");
            setError(null);
        }
    }, [isOpen, subscription]);

    if (!subscription || !dueDate) return null;

    const symbol = CURRENCY_SYMBOLS[subscription.currency] || "$";
    const parsed = parseFloat(amount);

    const handleConfirm = async () => {
        if (!amount || Number.isNaN(parsed) || parsed < 0) {
            setError(t("subs.confirm.invalidAmount"));
            return;
        }
        setIsSubmitting(true);
        setError(null);

        const { error: rpcError } = await supabase.rpc("nomadix_charge_occurrence", {
            p_subscription_id: subscription.id,
            p_due_date: dueDate,
            p_amount_override: parsed,
            p_note: note.trim() || null,
        });

        if (rpcError) {
            setError(rpcError.message);
            setIsSubmitting(false);
            return;
        }

        addToast(t("subs.toast.charged", { name: subscription.name }));
        setIsSubmitting(false);
        onDone();
        onClose();
    };

    const handleSkip = async () => {
        setIsSubmitting(true);
        setError(null);

        const { error: rpcError } = await supabase.rpc("nomadix_skip_occurrence", {
            p_subscription_id: subscription.id,
            p_due_date: dueDate,
            p_note: note.trim() || null,
        });

        if (rpcError) {
            setError(rpcError.message);
            setIsSubmitting(false);
            return;
        }

        addToast(t("subs.toast.skippedNamed", { name: subscription.name }));
        setIsSubmitting(false);
        onDone();
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
                        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-border px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                    <CreditCard size={20} className="text-foreground/70" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-foreground">
                                        {t("subs.confirm.title")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {t("subs.confirm.dueLabel", {
                                            name: subscription.name,
                                            date: formatDueDate(dueDate),
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            {error && (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    {t("subs.confirm.amount")}
                                </label>
                                <div className="flex items-center rounded-xl border border-border bg-accent px-4 py-3">
                                    <span className="mr-1 text-2xl font-semibold text-muted-foreground">
                                        {symbol}
                                    </span>
                                    <input
                                        autoFocus
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-transparent text-2xl font-semibold tabular-nums text-foreground outline-none"
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                {t("subs.confirm.vaultPrefix")}{" "}
                                <span className="font-medium text-foreground/80">{vaultName || "—"}</span>
                            </p>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    {t("subs.confirm.note")}
                                </label>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            {!Number.isNaN(parsed) && parsed > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        subscription.direction === "expense"
                                            ? "subs.confirm.willDeductFrom"
                                            : "subs.confirm.willAddTo",
                                        {
                                            amount: `${symbol}${parsed.toFixed(2)}`,
                                            vault: vaultName || t("subs.confirm.theVault"),
                                        }
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
                            <button
                                type="button"
                                onClick={handleSkip}
                                disabled={isSubmitting}
                                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/70 hover:bg-accent disabled:opacity-60"
                            >
                                {t("subs.confirm.skip")}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? t("subs.confirm.processing") : t("subs.confirm.confirmCharge")}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
