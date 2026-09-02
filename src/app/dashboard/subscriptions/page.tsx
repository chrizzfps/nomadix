"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Repeat } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useCurrencyStore } from "@/stores/currency-store";
import { useRemindersStore } from "@/stores/reminders-store";
import { convertTransactionAmount } from "@/lib/currency-helpers";
import {
    totalsByDisplayCurrency,
    projectCashflow,
    firstShortfall,
    costPerCycle,
    todayISO,
} from "@/lib/subscriptions";
import { SubscriptionStats } from "@/components/subscriptions/subscription-stats";
import { SubscriptionRow } from "@/components/subscriptions/subscription-row";
import { SubscriptionFormModal } from "@/components/subscriptions/subscription-form-modal";
import { SubscriptionDetailModal } from "@/components/subscriptions/subscription-detail-modal";
import { ConfirmChargeModal } from "@/components/subscriptions/confirm-charge-modal";
import type { Subscription } from "@/types";

interface VaultOption {
    id: string;
    name: string;
    currency: "EUR" | "USD";
}

type StatusFilter = "all" | "active" | "paused" | "canceled";

function formatDbError(message: string) {
    if (message.includes("schema cache") || message.includes("Could not find")) {
        return "The subscriptions tables aren't set up yet. Run supabase/schema.sql in the Supabase SQL editor, then reload the API schema (Settings → API → Reload schema).";
    }
    return message;
}

export default function SubscriptionsPage() {
    const supabase = createClient();
    const { displayCurrency, getActiveRate } = useCurrencyStore();
    const runCatchUp = useRemindersStore((s) => s.runCatchUp);
    const reloadReminders = useRemindersStore((s) => s.load);

    const [vaults, setVaults] = useState<VaultOption[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [vaultFilter, setVaultFilter] = useState<string>("all");

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<Subscription | null>(null);
    const [detailSub, setDetailSub] = useState<Subscription | null>(null);
    const [confirmSub, setConfirmSub] = useState<Subscription | null>(null);
    const [confirmDueDate, setConfirmDueDate] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            setError("You must be logged in to view subscriptions.");
            setIsLoading(false);
            return;
        }

        const [{ data: vaultRows, error: vaultError }, { data: subRows, error: subError }] =
            await Promise.all([
                supabase.from("vaults").select("id,name,currency").eq("user_id", user.id),
                supabase
                    .from("subscriptions")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("next_due_date", { ascending: true }),
            ]);

        if (vaultError) {
            setError(formatDbError(vaultError.message));
            setIsLoading(false);
            return;
        }
        if (subError) {
            setError(formatDbError(subError.message));
            setIsLoading(false);
            return;
        }

        setVaults((vaultRows || []) as VaultOption[]);
        setSubscriptions((subRows || []) as Subscription[]);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            await runCatchUp();
            await load();
            reloadReminders(true);
        })();
    }, [runCatchUp, load, reloadReminders]);

    const vaultById = useMemo(() => {
        const map = new Map<string, VaultOption>();
        vaults.forEach((v) => map.set(v.id, v));
        return map;
    }, [vaults]);

    const convert = useCallback(
        (amount: number, from: "EUR" | "USD") =>
            convertTransactionAmount(amount, from, displayCurrency, null, getActiveRate()),
        [displayCurrency, getActiveRate]
    );

    const totals = useMemo(() => totalsByDisplayCurrency(subscriptions, convert), [
        subscriptions,
        convert,
    ]);

    const shortfall = useMemo(() => {
        // Approximate starting balance per display currency isn't tracked here —
        // the dashboard widget owns the real vault-balance projection. This page
        // only needs to know whether *any* shortfall risk exists for the stat tile.
        const startingBalance = 0;
        const points = projectCashflow(subscriptions, startingBalance, todayISO(), 30, convert);
        return firstShortfall(points);
    }, [subscriptions, convert]);

    const next30 = useMemo(() => {
        const points = projectCashflow(subscriptions, 0, todayISO(), 30, convert);
        const total = points.reduce((sum, p) => sum + Math.abs(p.delta), 0);
        const count = points.reduce((sum, p) => sum + p.items.length, 0);
        return { total, count };
    }, [subscriptions, convert]);

    const filtered = useMemo(() => {
        return subscriptions.filter((s) => {
            if (statusFilter !== "all" && s.status !== statusFilter) return false;
            if (vaultFilter !== "all" && s.vault_id !== vaultFilter) return false;
            return true;
        });
    }, [subscriptions, statusFilter, vaultFilter]);

    const handleChanged = useCallback(() => {
        load();
        reloadReminders(true);
    }, [load, reloadReminders]);

    const openCreate = () => {
        setEditing(null);
        setIsFormOpen(true);
    };

    const openEdit = (s: Subscription) => {
        setDetailSub(null);
        setEditing(s);
        setIsFormOpen(true);
    };

    const openConfirm = (s: Subscription, dueDate: string) => {
        setDetailSub(null);
        setConfirmSub(s);
        setConfirmDueDate(dueDate);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Subscriptions</h1>
                    <p className="mt-1 text-sm text-zinc-400">Recurring payments and income</p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    disabled={vaults.length === 0}
                    className="flex items-center gap-2 self-start rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Plus size={16} weight="bold" />
                    New Subscription
                </button>
            </div>

            {error && (
                <div className="mt-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="mt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
                        ))}
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                        <div className="h-6 w-40 animate-pulse rounded-lg bg-zinc-100" />
                        <div className="mt-4 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-50" />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mt-6">
                        <SubscriptionStats
                            monthly={totals.monthly}
                            annual={totals.annual}
                            next30Total={next30.total}
                            next30Count={next30.count}
                            hasShortfall={!!shortfall}
                            incomeMonthly={totals.incomeMonthly}
                            activeCount={totals.activeCount}
                            displayCurrency={displayCurrency}
                        />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-lg border border-zinc-200 p-0.5">
                            {(
                                [
                                    { value: "all", label: "All" },
                                    { value: "active", label: "Active" },
                                    { value: "paused", label: "Paused" },
                                    { value: "canceled", label: "Canceled" },
                                ] as const
                            ).map((f) => (
                                <button
                                    key={f.value}
                                    onClick={() => setStatusFilter(f.value)}
                                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                                        statusFilter === f.value
                                            ? "bg-zinc-900 text-white"
                                            : "text-zinc-500 hover:text-zinc-700"
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {vaults.length > 1 && (
                            <select
                                value={vaultFilter}
                                onChange={(e) => setVaultFilter(e.target.value)}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600"
                            >
                                <option value="all">All vaults</option>
                                {vaults.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                        <div className="hidden sm:grid grid-cols-[1fr_140px_120px_110px_130px] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                            <span>Subscription</span>
                            <span>Cycle</span>
                            <span>Vault</span>
                            <span>Next charge</span>
                            <span className="text-right">Amount</span>
                        </div>

                        <div className="divide-y divide-zinc-50">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Repeat size={40} weight="thin" className="text-zinc-300" />
                                    <p className="mt-3 text-sm font-semibold text-zinc-400">
                                        No subscriptions yet
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-300">
                                        Track Netflix, rent, gym, or any recurring income.
                                    </p>
                                </div>
                            ) : (
                                filtered.map((s) => {
                                    const vault = vaultById.get(s.vault_id);
                                    const displayAmount = convert(costPerCycle(s), s.currency);
                                    return (
                                        <SubscriptionRow
                                            key={s.id}
                                            subscription={s}
                                            vaultName={vault?.name || "—"}
                                            displayAmount={displayAmount}
                                            displayCurrency={displayCurrency}
                                            onClick={() => setDetailSub(s)}
                                        />
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}

            <SubscriptionFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSaved={handleChanged}
                vaults={vaults}
                editing={editing}
            />

            <SubscriptionDetailModal
                isOpen={!!detailSub}
                onClose={() => setDetailSub(null)}
                onChanged={handleChanged}
                subscription={detailSub}
                vaultName={detailSub ? vaultById.get(detailSub.vault_id)?.name || "—" : "—"}
                onEdit={openEdit}
                onOpenConfirm={openConfirm}
            />

            <ConfirmChargeModal
                isOpen={!!confirmSub}
                onClose={() => {
                    setConfirmSub(null);
                    setConfirmDueDate(null);
                }}
                onDone={handleChanged}
                subscription={confirmSub}
                dueDate={confirmDueDate}
                vaultName={confirmSub ? vaultById.get(confirmSub.vault_id)?.name : undefined}
            />
        </motion.div>
    );
}
