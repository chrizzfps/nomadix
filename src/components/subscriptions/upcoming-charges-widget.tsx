"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useCurrencyStore } from "@/stores/currency-store";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useRemindersStore } from "@/stores/reminders-store";
import { convertTransactionAmount } from "@/lib/currency-helpers";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import {
    upcomingDueDates,
    chargeBreakdown,
    dueStatus,
    projectCashflow,
    firstShortfall,
    formatDueDateShort,
    formatDueDate,
    todayISO,
} from "@/lib/subscriptions";
import { ConfirmChargeModal } from "@/components/subscriptions/confirm-charge-modal";
import { useLanguageStore } from "@/stores/language-store";
import type { Subscription } from "@/types";

interface FlatCharge {
    subscription: Subscription;
    dueDate: string;
    amount: number;
}

export function UpcomingChargesWidget() {
    const supabase = createClient();
    const { displayCurrency, getActiveRate } = useCurrencyStore();
    const { isPrivacyMode } = usePrivacyStore();
    const runCatchUp = useRemindersStore((s) => s.runCatchUp);
    const t = useLanguageStore((s) => s.t);

    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [startingBalance, setStartingBalance] = useState(0);
    const [vaultNames, setVaultNames] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [confirmSub, setConfirmSub] = useState<Subscription | null>(null);
    const [confirmDue, setConfirmDue] = useState<string | null>(null);

    const convert = useCallback(
        (amount: number, from: "EUR" | "USD") =>
            convertTransactionAmount(amount, from, displayCurrency, null, getActiveRate()),
        [displayCurrency, getActiveRate]
    );

    const load = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        const [{ data: vaultRows }, { data: txRows }, { data: subRows }] = await Promise.all([
            supabase.from("vaults").select("id,name,currency").eq("user_id", user.id),
            supabase.from("transactions").select("vault_id,amount").eq("user_id", user.id),
            supabase
                .from("subscriptions")
                .select("*")
                .eq("user_id", user.id)
                .eq("status", "active"),
        ]);

        const names = new Map<string, string>();
        let totalBalance = 0;
        (vaultRows || []).forEach((v: { id: string; name: string; currency: "EUR" | "USD" }) => {
            names.set(v.id, v.name);
        });
        const balanceByVault = new Map<string, number>();
        (txRows || []).forEach((t: { vault_id: string; amount: number }) => {
            balanceByVault.set(t.vault_id, (balanceByVault.get(t.vault_id) || 0) + t.amount);
        });
        (vaultRows || []).forEach((v: { id: string; currency: "EUR" | "USD" }) => {
            totalBalance += convert(balanceByVault.get(v.id) || 0, v.currency);
        });

        setVaultNames(names);
        setStartingBalance(totalBalance);
        setSubscriptions((subRows || []) as Subscription[]);
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase]);

    useEffect(() => {
        (async () => {
            await runCatchUp();
            await load();
        })();
    }, [runCatchUp, load]);

    const upcoming: FlatCharge[] = useMemo(() => {
        const flat: FlatCharge[] = [];
        for (const sub of subscriptions) {
            const dates = upcomingDueDates(sub, 6);
            for (const due of dates) {
                const { total } = chargeBreakdown(sub, due);
                flat.push({ subscription: sub, dueDate: due, amount: total });
            }
        }
        return flat.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
    }, [subscriptions]);

    const next30Total = useMemo(() => {
        return subscriptions.reduce((sum, sub) => {
            const dates = upcomingDueDates(sub, 40).filter(
                (d) => dueStatus(d).days >= 0 && dueStatus(d).days <= 30
            );
            const subtotal = dates.reduce((s, due) => {
                const { total } = chargeBreakdown(sub, due);
                const converted = convert(total, sub.currency);
                return s + (sub.direction === "expense" ? converted : 0);
            }, 0);
            return sum + subtotal;
        }, 0);
    }, [subscriptions, convert]);

    const shortfall = useMemo(() => {
        const points = projectCashflow(subscriptions, startingBalance, todayISO(), 30, convert);
        return firstShortfall(points);
    }, [subscriptions, startingBalance, convert]);

    const symbol = CURRENCY_SYMBOLS[displayCurrency] || "$";
    const blur = isPrivacyMode ? "blur-sm select-none" : "";

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="h-5 w-32 animate-pulse rounded-lg bg-accent" />
                <div className="mt-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 animate-pulse rounded-xl bg-accent" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border bg-card"
        >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold text-foreground">{t("subs.widget.title")}</h3>
                <Link
                    href="/dashboard/subscriptions"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground/70"
                >
                    {t("subs.widget.viewAll")} →
                </Link>
            </div>

            <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground">
                <span>{t("subs.widget.next30days")}</span>
                <span className={`text-sm font-semibold text-foreground tabular-nums ${blur}`}>
                    {symbol}
                    {next30Total.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}
                </span>
            </div>

            <div className="divide-y divide-border">
                {upcoming.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                        <p className="text-sm text-muted-foreground">{t("subs.widget.empty")}</p>
                        <Link
                            href="/dashboard/subscriptions"
                            className="mt-1 inline-block text-xs font-semibold text-foreground/70 hover:text-foreground"
                        >
                            {t("subs.widget.addSubscription")}
                        </Link>
                    </div>
                ) : (
                    upcoming.map((item, i) => {
                        const { tone } = dueStatus(item.dueDate);
                        const isIncome = item.subscription.direction === "income";
                        const needsConfirm =
                            item.subscription.is_variable_amount || !item.subscription.auto_charge;

                        return (
                            <div
                                key={`${item.subscription.id}-${item.dueDate}-${i}`}
                                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-foreground">
                                        {item.subscription.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {formatDueDateShort(item.dueDate)}
                                    </p>
                                </div>
                                {needsConfirm ? (
                                    <button
                                        onClick={() => {
                                            setConfirmSub(item.subscription);
                                            setConfirmDue(item.dueDate);
                                        }}
                                        className="shrink-0 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
                                    >
                                        {t("subs.widget.confirm")}
                                    </button>
                                ) : (
                                    <span
                                        className={`shrink-0 font-semibold tabular-nums ${blur} ${
                                            isIncome
                                                ? "text-emerald-600"
                                                : tone === "overdue"
                                                    ? "text-red-500"
                                                    : "text-foreground"
                                        }`}
                                    >
                                        {isIncome ? "+" : ""}
                                        {symbol}
                                        {convert(item.amount, item.subscription.currency).toFixed(2)}
                                    </span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {shortfall && (
                <div className="mx-4 mb-4 mt-1 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                    <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />
                    <span>
                        {t("subs.widget.shortfall", {
                            zero: `${symbol}0`,
                            date: formatDueDate(shortfall.dateISO),
                        })}
                    </span>
                </div>
            )}

            <ConfirmChargeModal
                isOpen={!!confirmSub}
                onClose={() => {
                    setConfirmSub(null);
                    setConfirmDue(null);
                }}
                onDone={load}
                subscription={confirmSub}
                dueDate={confirmDue}
                vaultName={confirmSub ? vaultNames.get(confirmSub.vault_id) : undefined}
            />
        </motion.div>
    );
}
