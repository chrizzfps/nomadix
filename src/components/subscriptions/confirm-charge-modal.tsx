"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
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
            setError("Enter a valid amount.");
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

        addToast(`${subscription.name} charged`);
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

        addToast(`${subscription.name} skipped this cycle`);
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
                        className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                                    <CreditCard size={20} className="text-zinc-600" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-zinc-900">
                                        Confirm charge
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        {subscription.name} · Due {formatDueDate(dueDate)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 px-6 py-5">
                            {error && (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Amount
                                </label>
                                <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                                    <span className="mr-1 text-2xl font-semibold text-zinc-400">
                                        {symbol}
                                    </span>
                                    <input
                                        autoFocus
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-transparent text-2xl font-semibold tabular-nums text-zinc-900 outline-none"
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-zinc-500">
                                Vault: <span className="font-medium text-zinc-700">{vaultName || "—"}</span>
                            </p>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Note (optional)
                                </label>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                            </div>

                            {!Number.isNaN(parsed) && parsed > 0 && (
                                <p className="text-xs text-zinc-400">
                                    This will {subscription.direction === "expense" ? "deduct" : "add"}{" "}
                                    <span className="font-semibold text-zinc-600">
                                        {symbol}
                                        {parsed.toFixed(2)}
                                    </span>{" "}
                                    {subscription.direction === "expense" ? "from" : "to"}{" "}
                                    {vaultName || "the vault"}.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={handleSkip}
                                disabled={isSubmitting}
                                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
                            >
                                Skip this cycle
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting}
                                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Processing..." : "Confirm charge"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
