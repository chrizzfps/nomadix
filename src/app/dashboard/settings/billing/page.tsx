"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    CreditCard,
    Check,
    Crown,
    Vault,
    IdentificationCard,
    Receipt,
    Clock,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useLanguageStore } from "@/stores/language-store";

interface UsageStats {
    vaults: number;
    documents: number;
    transactions: number;
}

export default function BillingPage() {
    const supabase = createClient();
    const t = useLanguageStore((s) => s.t);

    const [usage, setUsage] = useState<UsageStats>({ vaults: 0, documents: 0, transactions: 0 });

    useEffect(() => {
        async function loadUsage() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const [vRes, dRes, tRes] = await Promise.all([
                supabase.from("vaults").select("*", { count: "exact", head: true }).eq("user_id", user.id),
                supabase.from("documents").select("*", { count: "exact", head: true }).eq("user_id", user.id),
                supabase.from("transactions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
            ]);

            setUsage({
                vaults: vRes.count || 0,
                documents: dRes.count || 0,
                transactions: tRes.count || 0,
            });
        }
        loadUsage();
    }, [supabase]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <CreditCard size={20} className="text-muted-foreground" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{t("billing.title")}</h2>
                    <p className="text-xs text-muted-foreground">
                        {t("billing.subtitle")}
                    </p>
                </div>
            </div>

            {/* Plan Card */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <Crown size={24} weight="fill" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">{t("billing.planName")}</h3>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                {t("billing.active")}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Multi-currency vaults, encrypted storage, and real-time exchange rate sync
                        </p>
                    </div>
                </div>

                <div className="mt-6 space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {t("billing.included")}
                    </p>
                    <ul className="space-y-2 text-xs text-foreground/80">
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500 font-bold" />
                            Unlimited multi-currency vaults (USD, EUR, GBP, CHF)
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500 font-bold" />
                            Real-time automatic exchange rate polling & conversions
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500 font-bold" />
                            Automated multi-currency expense summaries and category trends
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500 font-bold" />
                            End-to-end encrypted passport & identity document storage
                        </li>
                        <li className="flex items-center gap-2">
                            <Check size={14} className="text-emerald-500 font-bold" />
                            Automated subscription tracking with price-change alerts
                        </li>
                    </ul>
                </div>
            </div>

            {/* Account Limits & Metered Usage */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("billing.usage")}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Vault size={16} /> Vaults Created
                            </span>
                            <span className="font-semibold text-foreground">{usage.vaults} / ∞</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-accent overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, usage.vaults * 20)}%` }} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <IdentificationCard size={16} /> Documents Stored
                            </span>
                            <span className="font-semibold text-foreground">{usage.documents} / ∞</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-accent overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, usage.documents * 25)}%` }} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Receipt size={16} /> Recorded Transactions
                            </span>
                            <span className="font-semibold text-foreground">{usage.transactions} / ∞</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-accent overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, usage.transactions * 10)}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoices History */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    Payment Receipts & Invoices
                </h3>
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-center">
                    <Clock size={28} weight="thin" className="text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">No invoices yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground/70">
                        Nomadix isn&apos;t connected to a payment processor yet, so there&apos;s nothing
                        to bill or invoice.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
