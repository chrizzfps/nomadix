"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Repeat,
    PencilSimple,
    PauseCircle,
    PlayCircle,
    XCircle,
    LinkSimple,
    CreditCard,
    Prohibit,
    CheckCircle,
    Clock,
    WarningCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { CATEGORY_ICON_MAP } from "@/lib/transaction-categories";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import {
    cycleLabel,
    monthlyEquivalent,
    annualEquivalent,
    costPerCycle,
    feeFor,
    formatDueDate,
} from "@/lib/subscriptions";
import { DueBadge } from "./due-badge";
import type { Subscription, SubscriptionOccurrence } from "@/types";

interface SubscriptionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChanged: () => void;
    subscription: Subscription | null;
    vaultName: string;
    onEdit: (s: Subscription) => void;
    onOpenConfirm: (s: Subscription, dueDate: string) => void;
}

const STATUS_DOT: Record<SubscriptionOccurrence["status"], string> = {
    charged: "bg-emerald-500",
    pending: "bg-amber-500",
    skipped: "bg-zinc-300",
    failed: "bg-red-500",
    canceled: "bg-zinc-300",
};

export function SubscriptionDetailModal({
    isOpen,
    onClose,
    onChanged,
    subscription,
    vaultName,
    onEdit,
    onOpenConfirm,
}: SubscriptionDetailModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [occurrences, setOccurrences] = useState<SubscriptionOccurrence[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    const loadHistory = useCallback(
        async (subscriptionId: string) => {
            setIsLoadingHistory(true);
            const { data } = await supabase
                .from("subscription_occurrences")
                .select("*")
                .eq("subscription_id", subscriptionId)
                .order("due_date", { ascending: false })
                .limit(12);
            setOccurrences((data || []) as SubscriptionOccurrence[]);
            setIsLoadingHistory(false);
        },
        [supabase]
    );

    useEffect(() => {
        if (isOpen && subscription) {
            setConfirmingCancel(false);
            loadHistory(subscription.id);
        }
    }, [isOpen, subscription, loadHistory]);

    if (!subscription) return null;
    const s = subscription;
    const Icon = (s.icon_key && CATEGORY_ICON_MAP[s.icon_key]) || Repeat;
    const symbol = CURRENCY_SYMBOLS[s.currency] || "$";

    const chargeNow = async () => {
        setBusy(true);
        if (s.is_variable_amount) {
            onOpenConfirm(s, s.next_due_date);
            setBusy(false);
            return;
        }
        const { error } = await supabase.rpc("nomadix_charge_occurrence", {
            p_subscription_id: s.id,
            p_due_date: s.next_due_date,
        });
        if (error) {
            addToast(error.message, "error");
        } else {
            addToast(`${s.name} charged`);
            onChanged();
            loadHistory(s.id);
        }
        setBusy(false);
    };

    const skipCycle = async () => {
        setBusy(true);
        const { error } = await supabase.rpc("nomadix_skip_occurrence", {
            p_subscription_id: s.id,
            p_due_date: s.next_due_date,
        });
        if (error) {
            addToast(error.message, "error");
        } else {
            addToast("Skipped this cycle");
            onChanged();
            loadHistory(s.id);
        }
        setBusy(false);
    };

    const togglePause = async () => {
        setBusy(true);
        const nextStatus = s.status === "paused" ? "active" : "paused";
        const { error } = await supabase
            .from("subscriptions")
            .update({ status: nextStatus })
            .eq("id", s.id);
        if (error) {
            addToast(error.message, "error");
        } else {
            addToast(nextStatus === "paused" ? "Subscription paused" : "Subscription resumed");
            onChanged();
        }
        setBusy(false);
    };

    const cancelSubscription = async () => {
        setBusy(true);
        const { error } = await supabase
            .from("subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("id", s.id);
        if (error) {
            addToast(error.message, "error");
        } else {
            addToast("Subscription canceled");
            onChanged();
            onClose();
        }
        setBusy(false);
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
                        className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                                    style={{ backgroundColor: `${s.color}14` }}
                                >
                                    <Icon size={20} style={{ color: s.color }} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold text-zinc-900">{s.name}</h2>
                                        <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                            {s.status}
                                        </span>
                                    </div>
                                    <div className="mt-0.5">
                                        <DueBadge dueDate={s.next_due_date} />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                {[
                                    {
                                        label: "Amount",
                                        value: `${symbol}${s.amount.toFixed(2)} · ${cycleLabel(s.billing_cycle, s.interval_count, s.custom_interval_days)}`,
                                    },
                                    { label: "Vault", value: vaultName },
                                    { label: "Category", value: s.category || "—" },
                                    { label: "Next charge", value: formatDueDate(s.next_due_date) },
                                    { label: "Monthly equiv.", value: `${symbol}${monthlyEquivalent(s).toFixed(2)}` },
                                    { label: "Annualized", value: `${symbol}${annualEquivalent(s).toFixed(2)}` },
                                ].map((item) => (
                                    <div key={item.label}>
                                        <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                            {item.label}
                                        </p>
                                        <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                                            {item.value}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {s.fee_mode !== "none" && (
                                <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/60">
                                    {[
                                        { label: "Subtotal", value: s.amount },
                                        {
                                            label: s.fee_mode === "percent" ? `Fee (${s.fee_value}%)` : "Fee",
                                            value: feeFor(s.amount, s.fee_mode, s.fee_value),
                                        },
                                        { label: "Total", value: costPerCycle(s) },
                                    ].map((col) => (
                                        <div key={col.label} className="px-3 py-2.5 text-center">
                                            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                                {col.label}
                                            </p>
                                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
                                                {symbol}
                                                {col.value.toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-5 flex flex-wrap gap-2">
                                <button
                                    onClick={chargeNow}
                                    disabled={busy || s.status !== "active"}
                                    className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <CreditCard size={14} />
                                    Charge now
                                </button>
                                <button
                                    onClick={skipCycle}
                                    disabled={busy || s.status !== "active"}
                                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                    <Prohibit size={14} />
                                    Skip this cycle
                                </button>
                                <button
                                    onClick={togglePause}
                                    disabled={busy || s.status === "canceled" || s.status === "ended"}
                                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                    {s.status === "paused" ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                                    {s.status === "paused" ? "Resume" : "Pause"}
                                </button>
                                <button
                                    onClick={() => onEdit(s)}
                                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                                >
                                    <PencilSimple size={14} />
                                    Edit
                                </button>
                                {s.cancel_url && (
                                    <a
                                        href={s.cancel_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                                    >
                                        <LinkSimple size={14} />
                                        Open cancellation page
                                    </a>
                                )}
                                {s.status !== "canceled" && (
                                    <button
                                        onClick={() =>
                                            confirmingCancel ? cancelSubscription() : setConfirmingCancel(true)
                                        }
                                        disabled={busy}
                                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                            confirmingCancel
                                                ? "bg-red-600 text-white hover:bg-red-700"
                                                : "border border-red-100 text-red-600 hover:bg-red-50"
                                        }`}
                                    >
                                        <XCircle size={14} />
                                        {confirmingCancel ? "Confirm cancel?" : "Cancel subscription"}
                                    </button>
                                )}
                            </div>

                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-zinc-900">Payment history</h3>
                                {isLoadingHistory ? (
                                    <div className="mt-3 space-y-2">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-50" />
                                        ))}
                                    </div>
                                ) : occurrences.length === 0 ? (
                                    <p className="mt-2 text-sm text-zinc-400">No charges yet.</p>
                                ) : (
                                    <div className="mt-3 divide-y divide-zinc-50 rounded-2xl border border-zinc-200">
                                        {occurrences.map((occ) => {
                                            const isSkipped = occ.status === "skipped" || occ.status === "canceled";
                                            const isFailed = occ.status === "failed";
                                            return (
                                                <div
                                                    key={occ.id}
                                                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[occ.status]}`}
                                                        />
                                                        <span className="text-zinc-700">{formatDueDate(occ.due_date)}</span>
                                                        {isFailed && (
                                                            <WarningCircle size={13} className="text-red-500" />
                                                        )}
                                                        {occ.status === "charged" && (
                                                            <CheckCircle size={13} className="text-emerald-500" />
                                                        )}
                                                        {occ.status === "pending" && (
                                                            <Clock size={13} className="text-amber-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span
                                                            className={`font-semibold tabular-nums ${
                                                                isSkipped ? "text-zinc-300 line-through" : "text-zinc-900"
                                                            }`}
                                                        >
                                                            {symbol}
                                                            {(
                                                                (occ.actual_amount ?? occ.expected_amount) +
                                                                (occ.fee_amount || 0)
                                                            ).toFixed(2)}
                                                        </span>
                                                        {occ.fee_amount > 0 && (
                                                            <span className="text-[10px] text-zinc-400">
                                                                incl. {symbol}{occ.fee_amount.toFixed(2)} fee
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
