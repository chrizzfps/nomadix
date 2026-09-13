"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Plus, HandCoins, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useCurrencyStore } from "@/stores/currency-store";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useLanguageStore } from "@/stores/language-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { receivableTotals } from "@/lib/receivables";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { ReceivableRow } from "@/components/receivables/receivable-row";
import { ReceivableFormModal } from "@/components/receivables/receivable-form-modal";
import { ReceivableDetailModal } from "@/components/receivables/receivable-detail-modal";
import { CollectReceivableModal } from "@/components/receivables/collect-receivable-modal";
import { ClientsManagerModal } from "@/components/receivables/clients-manager-modal";
import type { Client, Receivable } from "@/types";

interface VaultRow {
    id: string;
    name: string;
    currency: "EUR" | "USD";
    type: string;
}

type StatusFilter = "all" | "pending" | "overdue" | "paid";

function formatDbError(message: string, t: (key: string) => string) {
    if (message.includes("schema cache") || message.includes("Could not find")) {
        return t("receivables.tablesNotSetUp");
    }
    return message;
}

export default function ReceivablesPage() {
    const supabase = createClient();
    const { displayCurrency, convert } = useCurrencyStore();
    const isPrivacyMode = usePrivacyStore((s) => s.isPrivacyMode);
    const t = useLanguageStore((s) => s.t);
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    const [vaults, setVaults] = useState<VaultRow[]>([]);
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [vaultFilter, setVaultFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Receivable | null>(null);
    const [detailTarget, setDetailTarget] = useState<Receivable | null>(null);
    const [collectTarget, setCollectTarget] = useState<Receivable | null>(null);
    const [showClients, setShowClients] = useState(false);

    // A prefilter from the vault card's "N accounts" link
    // (/dashboard/receivables?vault=<id>) -- read client-side, matching the
    // rest of the app's avoidance of useSearchParams + its Suspense
    // requirement for a fully client-rendered page.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const vaultParam = params.get("vault");
        if (vaultParam) setVaultFilter(vaultParam);
    }, []);

    const load = useCallback(async () => {
        setError(null);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            setError(t("receivables.mustBeLoggedIn"));
            setIsLoading(false);
            return;
        }

        const [{ data: vaultRows, error: vaultError }, { data: recRows, error: recError }, { data: clientRows }] =
            await Promise.all([
                supabase.from("vaults").select("id,name,currency,type").eq("user_id", user.id),
                supabase
                    .from("receivables")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("expected_date", { ascending: true }),
                supabase.from("clients").select("*").eq("user_id", user.id).order("name"),
            ]);

        if (vaultError || recError) {
            setError(formatDbError((vaultError || recError)?.message || "", t));
            setIsLoading(false);
            return;
        }

        setVaults((vaultRows || []) as VaultRow[]);
        setReceivables((recRows || []) as Receivable[]);
        setClients((clientRows || []) as Client[]);
        setIsLoading(false);
    }, [supabase, t]);

    useEffect(() => {
        load();
    }, [load]);

    const receivableVaults = useMemo(() => vaults.filter((v) => v.type === "receivable"), [vaults]);
    const liquidVaults = useMemo(
        () => vaults.filter((v) => v.type !== "receivable") as { id: string; name: string; currency: "EUR" | "USD" }[],
        [vaults]
    );

    const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

    const totals = useMemo(() => receivableTotals(receivables, convert), [receivables, convert]);

    const filtered = useMemo(() => {
        return receivables.filter((r) => {
            if (vaultFilter && r.vault_id !== vaultFilter) return false;
            if (statusFilter === "paid") return r.status === "paid";
            if (statusFilter === "pending") return r.status === "pending" || r.status === "partial";
            if (statusFilter === "overdue") {
                return (
                    (r.status === "pending" || r.status === "partial") &&
                    r.expected_date < new Date().toISOString().slice(0, 10)
                );
            }
            return r.status !== "canceled";
        });
    }, [receivables, vaultFilter, statusFilter]);

    const activeVaultName = vaultFilter
        ? receivableVaults.find((v) => v.id === vaultFilter)?.name
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 lg:p-8"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {t("receivables.title")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">{t("receivables.subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <CurrencyToggle />
                    <button
                        onClick={() => setShowClients(true)}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent"
                    >
                        <UsersThree size={16} />
                        {t("receivables.manageClients")}
                    </button>
                    {receivableVaults.length > 0 && (
                        <button
                            onClick={() => {
                                setEditing(null);
                                setShowForm(true);
                            }}
                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                        >
                            <Plus size={16} weight="bold" />
                            {t("receivables.new")}
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="mt-8 space-y-4">
                    <div className="h-24 animate-pulse rounded-2xl bg-accent" />
                    <div className="h-64 animate-pulse rounded-2xl bg-accent" />
                </div>
            ) : error ? (
                <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
                    {error}
                </div>
            ) : receivableVaults.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed border-amber-300 bg-card px-5 py-10 text-center dark:border-amber-900/60">
                    <HandCoins size={32} weight="thin" className="mx-auto mb-3 text-amber-500" />
                    <p className="text-sm font-medium text-foreground">
                        {t("receivables.emptyVaultTitle")}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                        {t("receivables.emptyVaultBody")}
                    </p>
                    <Link
                        href="/dashboard/vaults"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                    >
                        {t("receivables.emptyVaultCta")}
                    </Link>
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[
                            {
                                label: t("receivables.stats.outstanding"),
                                value: totals.outstanding,
                                warning: false,
                            },
                            {
                                label: t("receivables.stats.overdue"),
                                value: totals.overdue,
                                warning: totals.overdue > 0,
                            },
                            {
                                label: t("receivables.stats.dueThisMonth"),
                                value: totals.dueThisMonth,
                                warning: false,
                            },
                            {
                                label: t("receivables.stats.collectedThisMonth"),
                                value: totals.collectedThisMonth,
                                warning: false,
                            },
                        ].map((c) => (
                            <div
                                key={c.label}
                                className={`rounded-2xl border p-5 ${
                                    c.warning
                                        ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/30"
                                        : "border-border bg-card"
                                }`}
                            >
                                <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                    {c.label}
                                </p>
                                <p
                                    className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${
                                        isPrivacyMode ? "blur-sm select-none" : ""
                                    } ${c.warning ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}
                                >
                                    {symbol}
                                    {c.value.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </p>
                                {c.warning && c.value > 0 && (
                                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                        <WarningCircle size={12} weight="fill" />
                                        {t("receivables.stats.overdueHint")}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                        {activeVaultName && (
                            <button
                                onClick={() => setVaultFilter(null)}
                                className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                            >
                                {activeVaultName} ×
                            </button>
                        )}
                        {(
                            [
                                { value: "all", label: t("receivables.filter.all") },
                                { value: "pending", label: t("receivables.filter.pending") },
                                { value: "overdue", label: t("receivables.filter.overdue") },
                                { value: "paid", label: t("receivables.filter.paid") },
                            ] as { value: StatusFilter; label: string }[]
                        ).map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                    statusFilter === f.value
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-accent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
                        {filtered.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                                {t("receivables.noResults")}
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filtered.map((r) => (
                                    <ReceivableRow
                                        key={r.id}
                                        receivable={r}
                                        clientColor={r.client_id ? clientById.get(r.client_id)?.color : undefined}
                                        onClick={() => setDetailTarget(r)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Modals */}
            <ReceivableFormModal
                isOpen={showForm}
                onClose={() => {
                    setShowForm(false);
                    setEditing(null);
                }}
                onSaved={load}
                vaults={receivableVaults}
                clients={clients}
                onClientsChanged={load}
                editing={editing}
                defaultVaultId={vaultFilter || undefined}
            />
            <ReceivableDetailModal
                isOpen={!!detailTarget}
                onClose={() => setDetailTarget(null)}
                receivable={detailTarget}
                onEdit={() => {
                    setEditing(detailTarget);
                    setDetailTarget(null);
                    setShowForm(true);
                }}
                onCollect={() => {
                    setCollectTarget(detailTarget);
                    setDetailTarget(null);
                }}
                onChanged={load}
            />
            <CollectReceivableModal
                isOpen={!!collectTarget}
                onClose={() => setCollectTarget(null)}
                onCollected={load}
                receivable={collectTarget}
                vaults={liquidVaults}
            />
            <ClientsManagerModal
                isOpen={showClients}
                onClose={() => setShowClients(false)}
                clients={clients}
                onChanged={load}
            />
        </motion.div>
    );
}
