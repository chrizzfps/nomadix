"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    FileText,
    TrendUp,
    TrendDown,
    ArrowRight,
    ArrowClockwise,
    Wallet,
    CaretRight,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { usePrivacyStore } from "@/stores/privacy-store";
import { formatMoney } from "@/lib/currency";
import { todayISO } from "@/lib/subscriptions";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai-providers";
import { TransactionDetailModal } from "@/components/vaults/transaction-detail-modal";
import type { MonthlyReportContext, ReportLanguage } from "@/lib/ai-report";

interface ReportResult {
    context: MonthlyReportContext;
    narrative: string;
    provider: AiProvider;
    model: string;
    cached?: boolean;
}

interface TxDetail {
    id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    original_currency: string;
    date: string | null;
    created_at: string;
    vault_name?: string;
    fee?: number | null;
    exchange_rate_at_time?: number | null;
}

const LANGUAGES: { id: ReportLanguage; label: string }[] = [
    { id: "en", label: "EN" },
    { id: "es", label: "ES" },
];

function modelLabel(provider: AiProvider, model: string): string {
    const info = AI_PROVIDERS.find((p) => p.id === provider);
    return info?.models.find((m) => m.id === model)?.label || model;
}

function parseNarrative(text: string): { paragraphs: string[]; bullets: string[][] } {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const paragraphs: string[] = [];
    const bulletGroups: string[][] = [];
    let current: string[] | null = null;

    for (const line of lines) {
        if (line.startsWith("- ")) {
            if (!current) {
                current = [];
                bulletGroups.push(current);
            }
            current.push(line.slice(2));
        } else {
            current = null;
            paragraphs.push(line);
        }
    }
    return { paragraphs, bullets: bulletGroups };
}

export default function ReportsPage() {
    const supabase = createClient();
    const { isPrivacyMode } = usePrivacyStore();
    const blur = isPrivacyMode ? "blur-sm select-none" : "";

    const [month, setMonth] = useState(todayISO().slice(0, 7));
    const [language, setLanguage] = useState<ReportLanguage>("en");
    const [result, setResult] = useState<ReportResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<{
        message: string;
        code?: string;
        provider?: AiProvider;
    } | null>(null);
    const [selectedTx, setSelectedTx] = useState<TxDetail | null>(null);

    const generate = async (force: boolean) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/ai/monthly-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, language, force }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError({
                    message: json.error || "Something went wrong.",
                    code: json.code,
                    provider: json.provider,
                });
                setResult(null);
            } else {
                setResult(json);
            }
        } catch {
            setError({ message: "Network error. Please try again." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setResult(null);
        generate(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, language]);

    const openExpense = async (id: string, vaultId: string) => {
        const [{ data: tx }, { data: vault }] = await Promise.all([
            supabase.from("transactions").select("*").eq("id", id).single(),
            supabase.from("vaults").select("name").eq("id", vaultId).single(),
        ]);
        if (tx) setSelectedTx({ ...tx, vault_name: vault?.name });
    };

    const ctx = result?.context;
    const narrative = result ? parseNarrative(result.narrative) : null;
    const delta =
        ctx?.previous && ctx.previous.net !== 0
            ? ((ctx.current.net - ctx.previous.net) / Math.abs(ctx.previous.net)) * 100
            : null;

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Reports</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        AI-generated monthly summary of your finances.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-xl border border-zinc-200 bg-white p-0.5">
                        {LANGUAGES.map((l) => (
                            <button
                                key={l.id}
                                onClick={() => setLanguage(l.id)}
                                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                    language === l.id
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-500 hover:text-zinc-700"
                                }`}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                    <button
                        onClick={() => generate(true)}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <ArrowClockwise size={15} className="animate-spin" />
                                {result ? "Regenerating…" : "Generating…"}
                            </>
                        ) : (
                            <>
                                <FileText size={15} />
                                {result ? "Regenerate" : "Generate report"}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && error.code === "no_api_key" && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
                    <FileText size={36} weight="thin" className="mx-auto text-zinc-300" />
                    <p className="mt-3 text-sm font-semibold text-zinc-700">{error.message}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                        Your key is stored encrypted and used only to generate this report.
                    </p>
                    <Link
                        href="/dashboard/settings/ai"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                    >
                        Go to Settings
                        <ArrowRight size={14} />
                    </Link>
                </div>
            )}

            {error && error.code !== "no_api_key" && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error.message}
                </div>
            )}

            {!result && !error && !isLoading && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-20">
                    <FileText size={40} weight="thin" className="text-zinc-300" />
                    <p className="mt-3 text-sm font-semibold text-zinc-400">No report yet</p>
                    <p className="mt-1 text-xs text-zinc-300">
                        Pick a month and generate your first AI summary.
                    </p>
                </div>
            )}

            {isLoading && !result && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
                        ))}
                    </div>
                    <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
                </div>
            )}

            {ctx && narrative && result && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`space-y-6 transition-opacity ${isLoading ? "opacity-50" : ""}`}
                >
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Income
                            </p>
                            <p className={`mt-2 text-2xl font-bold tabular-nums text-emerald-600 ${blur}`}>
                                {formatMoney(ctx.current.income, ctx.currency)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Expenses
                            </p>
                            <p className={`mt-2 text-2xl font-bold tabular-nums text-zinc-900 ${blur}`}>
                                {formatMoney(ctx.current.expense, ctx.currency)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Net
                            </p>
                            <p
                                className={`mt-2 text-2xl font-bold tabular-nums ${blur} ${
                                    ctx.current.net >= 0 ? "text-zinc-900" : "text-red-600"
                                }`}
                            >
                                {formatMoney(ctx.current.net, ctx.currency)}
                            </p>
                            {delta !== null && (
                                <p
                                    className={`mt-1 flex items-center gap-1 text-xs ${
                                        delta >= 0 ? "text-emerald-600" : "text-red-500"
                                    }`}
                                >
                                    {delta >= 0 ? (
                                        <TrendUp size={12} weight="bold" />
                                    ) : (
                                        <TrendDown size={12} weight="bold" />
                                    )}
                                    {Math.abs(delta).toFixed(0)}% vs last month
                                </p>
                            )}
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Net worth
                            </p>
                            <p className={`mt-2 text-2xl font-bold tabular-nums text-zinc-900 ${blur}`}>
                                {formatMoney(ctx.netWorth, ctx.currency)}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                                <Wallet size={12} />
                                Across {ctx.vaultBalances.length} vault
                                {ctx.vaultBalances.length === 1 ? "" : "s"}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-zinc-400" />
                                    <h3 className="text-sm font-semibold text-zinc-900">
                                        {ctx.monthLabel} summary
                                    </h3>
                                </div>
                                <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                    {modelLabel(result.provider, result.model)}
                                </span>
                            </div>
                            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600">
                                {narrative.paragraphs.length > 0 && <p>{narrative.paragraphs[0]}</p>}
                                {narrative.bullets.map((group, i) => (
                                    <ul key={i} className="space-y-1.5">
                                        {group.map((b, j) => (
                                            <li key={j} className="flex gap-2">
                                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                                                <span>{b}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ))}
                                {narrative.paragraphs.slice(1).map((p, i) => (
                                    <p key={i}>{p}</p>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                                <h3 className="text-sm font-semibold text-zinc-900">
                                    Top expense categories
                                </h3>
                                {ctx.topExpenseCategories.length === 0 ? (
                                    <p className="mt-2 text-xs text-zinc-400">No expenses this month.</p>
                                ) : (
                                    <div className="mt-3 space-y-2.5">
                                        {ctx.topExpenseCategories.map((c) => (
                                            <div key={c.category} className="flex items-center justify-between text-sm">
                                                <span className="text-zinc-600">{c.category}</span>
                                                <span className={`font-semibold tabular-nums text-zinc-900 ${blur}`}>
                                                    {formatMoney(c.amount, ctx.currency)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                                <h3 className="text-sm font-semibold text-zinc-900">Biggest expenses</h3>
                                {ctx.biggestExpenses.length === 0 ? (
                                    <p className="mt-2 text-xs text-zinc-400">No expenses this month.</p>
                                ) : (
                                    <div className="mt-3 space-y-1">
                                        {ctx.biggestExpenses.map((e) => (
                                            <button
                                                key={e.id}
                                                onClick={() => openExpense(e.id, e.vaultId)}
                                                className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-zinc-50"
                                            >
                                                <span className="truncate text-zinc-600">{e.description}</span>
                                                <span className="flex shrink-0 items-center gap-1">
                                                    <span className={`font-semibold tabular-nums text-zinc-900 ${blur}`}>
                                                        {formatMoney(e.amount, ctx.currency)}
                                                    </span>
                                                    <CaretRight size={12} className="text-zinc-300" />
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            <TransactionDetailModal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                onDeleted={() => setSelectedTx(null)}
                transaction={selectedTx}
            />
        </div>
    );
}
