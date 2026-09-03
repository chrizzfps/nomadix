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
import { useLanguageStore } from "@/stores/language-store";
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
    const t = useLanguageStore((s) => s.t);
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
                    message: json.error || t("reports.somethingWrong"),
                    code: json.code,
                    provider: json.provider,
                });
                setResult(null);
            } else {
                setResult(json);
            }
        } catch {
            setError({ message: t("reports.networkError") });
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
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("reports.title")}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("reports.subtitle")}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-xl border border-border bg-card p-0.5">
                        {LANGUAGES.map((l) => (
                            <button
                                key={l.id}
                                onClick={() => setLanguage(l.id)}
                                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                                    language === l.id
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground/80"
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
                        className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                        onClick={() => generate(true)}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <ArrowClockwise size={15} className="animate-spin" />
                                {result ? t("reports.regenerating") : t("reports.generating")}
                            </>
                        ) : (
                            <>
                                <FileText size={15} />
                                {result ? t("reports.regenerate") : t("reports.generateReport")}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && error.code === "no_api_key" && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                    <FileText size={36} weight="thin" className="mx-auto text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-foreground/80">{error.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {t("reports.keyStoredEncrypted")}
                    </p>
                    <Link
                        href="/dashboard/settings/ai"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                        {t("reports.goToSettings")}
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
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20">
                    <FileText size={40} weight="thin" className="text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-muted-foreground">{t("reports.noReportYet")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {t("reports.pickMonth")}
                    </p>
                </div>
            )}

            {isLoading && !result && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-2xl bg-accent" />
                        ))}
                    </div>
                    <div className="h-48 animate-pulse rounded-2xl bg-accent" />
                </div>
            )}

            {ctx && narrative && result && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`space-y-6 transition-opacity ${isLoading ? "opacity-50" : ""}`}
                >
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                {t("reports.income")}
                            </p>
                            <p className={`mt-2 text-2xl font-bold tabular-nums text-emerald-600 ${blur}`}>
                                {formatMoney(ctx.current.income, ctx.currency)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                {t("reports.expenses")}
                            </p>
                            <p className={`mt-2 text-2xl font-bold tabular-nums text-foreground ${blur}`}>
                                {formatMoney(ctx.current.expense, ctx.currency)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                {t("reports.net")}
                            </p>
                            <p
                                className={`mt-2 text-2xl font-bold tabular-nums ${blur} ${
                                    ctx.current.net >= 0 ? "text-foreground" : "text-red-600"
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
                                    {t("reports.vsLastMonth", { pct: Math.abs(delta).toFixed(0) })}
                                </p>
                            )}
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-5">
                            <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                {t("reports.netWorth")}
                            </p>
                            <p className={`mt-2 text-2xl font-bold tabular-nums text-foreground ${blur}`}>
                                {formatMoney(ctx.netWorth, ctx.currency)}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Wallet size={12} />
                                {t(
                                    ctx.vaultBalances.length === 1
                                        ? "reports.acrossVaultOne"
                                        : "reports.acrossVaultMany",
                                    { count: ctx.vaultBalances.length }
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                        <div className="rounded-2xl border border-border bg-card p-6">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-muted-foreground" />
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {t("reports.monthSummary", { month: ctx.monthLabel })}
                                    </h3>
                                </div>
                                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {modelLabel(result.provider, result.model)}
                                </span>
                            </div>
                            <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/70">
                                {narrative.paragraphs.length > 0 && <p>{narrative.paragraphs[0]}</p>}
                                {narrative.bullets.map((group, i) => (
                                    <ul key={i} className="space-y-1.5">
                                        {group.map((b, j) => (
                                            <li key={j} className="flex gap-2">
                                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
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
                            <div className="rounded-2xl border border-border bg-card p-6">
                                <h3 className="text-sm font-semibold text-foreground">
                                    {t("reports.topExpenseCategories")}
                                </h3>
                                {ctx.topExpenseCategories.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">{t("reports.noExpensesMonth")}</p>
                                ) : (
                                    <div className="mt-3 space-y-2.5">
                                        {ctx.topExpenseCategories.map((c) => (
                                            <div key={c.category} className="flex items-center justify-between text-sm">
                                                <span className="text-foreground/70">{c.category}</span>
                                                <span className={`font-semibold tabular-nums text-foreground ${blur}`}>
                                                    {formatMoney(c.amount, ctx.currency)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-6">
                                <h3 className="text-sm font-semibold text-foreground">{t("reports.biggestExpenses")}</h3>
                                {ctx.biggestExpenses.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">{t("reports.noExpensesMonth")}</p>
                                ) : (
                                    <div className="mt-3 space-y-1">
                                        {ctx.biggestExpenses.map((e) => (
                                            <button
                                                key={e.id}
                                                onClick={() => openExpense(e.id, e.vaultId)}
                                                className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-accent"
                                            >
                                                <span className="truncate text-foreground/70">{e.description}</span>
                                                <span className="flex shrink-0 items-center gap-1">
                                                    <span className={`font-semibold tabular-nums text-foreground ${blur}`}>
                                                        {formatMoney(e.amount, ctx.currency)}
                                                    </span>
                                                    <CaretRight size={12} className="text-muted-foreground" />
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
