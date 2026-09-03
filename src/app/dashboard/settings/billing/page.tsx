"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    CreditCard,
    Check,
    DownloadSimple,
    Crown,
    Vault,
    IdentificationCard,
    Receipt,
    ArrowsClockwise,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";

interface UsageStats {
    vaults: number;
    documents: number;
    transactions: number;
}

export default function BillingPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [billingCycle, setBillingCycle] = useState<"annual" | "monthly">("annual");
    const [usage, setUsage] = useState<UsageStats>({ vaults: 0, documents: 0, transactions: 0 });
    const [isLoading, setIsLoading] = useState(true);

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
            setIsLoading(false);
        }
        loadUsage();
    }, [supabase]);

    const handleDownloadInvoice = (invoiceId: string) => {
        addToast(`Downloading invoice ${invoiceId}...`, "info");
        setTimeout(() => {
            addToast(`Invoice ${invoiceId} downloaded.`, "success");
        }, 1000);
    };

    const handleManageSubscription = () => {
        addToast("Nomadix Premium Plan is currently active with lifetime status.", "info");
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
                    <CreditCard size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">Billing & Subscription</h2>
                    <p className="text-xs text-zinc-400">
                        Manage your Nomadix Pro membership, payment cycle, and invoices
                    </p>
                </div>
            </div>

            {/* Plan Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-100">
                    <div className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                            <Crown size={24} weight="fill" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-zinc-900">Nomadix Premium Plan</h3>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    Active
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Full access to global multi-currency tools, encrypted document vaults, and AI reports
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setBillingCycle("monthly")}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                                billingCycle === "monthly"
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-500 hover:bg-zinc-100"
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            onClick={() => setBillingCycle("annual")}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                                billingCycle === "annual"
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-500 hover:bg-zinc-100"
                            }`}
                        >
                            Annual
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">
                                Save 25%
                            </span>
                        </button>
                    </div>
                </div>

                {/* Pricing & Benefits */}
                <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2">
                    <div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold tracking-tight text-zinc-900">
                                {billingCycle === "annual" ? "$99" : "$12"}
                            </span>
                            <span className="text-xs font-medium text-zinc-400">
                                {billingCycle === "annual" ? "/ year" : "/ month"}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                            {billingCycle === "annual"
                                ? "Billed annually. Renews automatically with nomad perk price lock."
                                : "Billed monthly. Cancel anytime with no commitments."}
                        </p>
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={handleManageSubscription}
                                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                            >
                                Manage Plan
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                            Included in your plan
                        </p>
                        <ul className="space-y-2 text-xs text-zinc-600">
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
            </div>

            {/* Account Usage Metrics */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Account Usage
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <Vault size={16} /> Vaults Created
                            </span>
                            <span className="font-semibold text-zinc-900">{usage.vaults} / ∞</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                            <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${Math.min(100, usage.vaults * 20)}%` }} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <IdentificationCard size={16} /> Documents Stored
                            </span>
                            <span className="font-semibold text-zinc-900">{usage.documents} / ∞</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                            <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${Math.min(100, usage.documents * 25)}%` }} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <Receipt size={16} /> Recorded Transactions
                            </span>
                            <span className="font-semibold text-zinc-900">{usage.transactions} / ∞</span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                            <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${Math.min(100, usage.transactions * 10)}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoices History */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Payment Receipts & Invoices
                </h3>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between p-4 text-xs">
                        <div>
                            <p className="font-semibold text-zinc-900">Nomadix Premium Plan (Annual)</p>
                            <p className="text-zinc-400">INV-2026-001 · Jan 15, 2026</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-zinc-900">$99.00 USD</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Paid
                            </span>
                            <button
                                type="button"
                                onClick={() => handleDownloadInvoice("INV-2026-001")}
                                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                <DownloadSimple size={15} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 text-xs">
                        <div>
                            <p className="font-semibold text-zinc-900">Nomadix Premium Plan (Annual)</p>
                            <p className="text-zinc-400">INV-2025-089 · Jan 15, 2025</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-zinc-900">$99.00 USD</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Paid
                            </span>
                            <button
                                type="button"
                                onClick={() => handleDownloadInvoice("INV-2025-089")}
                                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                <DownloadSimple size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
