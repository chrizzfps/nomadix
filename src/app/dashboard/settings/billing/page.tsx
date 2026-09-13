"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    CreditCard,
    Check,
    Crown,
    Vault,
    IdentificationCard,
    Repeat,
    HandCoins,
    Airplane,
    Clock,
} from "@phosphor-icons/react";
import { useLanguageStore } from "@/stores/language-store";
import { usePlan } from "@/hooks/use-plan";
import { usePlanLimit } from "@/hooks/use-plan-limit";
import { UpgradeDialog } from "@/components/plan/upgrade-dialog";
import type { GatedEntity } from "@/lib/plan";

const USAGE_ROWS: { entity: GatedEntity; icon: typeof Vault; labelKey: string }[] = [
    { entity: "vault", icon: Vault, labelKey: "billing.usage.vaults" },
    { entity: "document", icon: IdentificationCard, labelKey: "billing.usage.documents" },
    { entity: "subscription", icon: Repeat, labelKey: "billing.usage.subscriptions" },
    { entity: "receivable", icon: HandCoins, labelKey: "billing.usage.receivables" },
    { entity: "trip", icon: Airplane, labelKey: "billing.usage.trips" },
];

function UsageRow({ entity, icon: Icon, labelKey }: (typeof USAGE_ROWS)[number]) {
    const t = useLanguageStore((s) => s.t);
    const { used, limit } = usePlanLimit(entity);
    const pct = limit === null ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100);

    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <Icon size={16} /> {t(labelKey)}
                </span>
                <span className="font-semibold text-foreground">
                    {used} / {limit === null ? "∞" : limit}
                </span>
            </div>
            {limit !== null && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-accent overflow-hidden">
                    <div
                        className={`h-full rounded-full ${used >= limit ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
}

export default function BillingPage() {
    const t = useLanguageStore((s) => s.t);
    const { plan, isPro } = usePlan();
    const [showUpgrade, setShowUpgrade] = useState(false);

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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                        <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                                isPro ? "bg-primary text-primary-foreground" : "bg-accent text-foreground/70"
                            }`}
                        >
                            <Crown size={24} weight="fill" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-foreground">
                                    {isPro ? t("plan.tier.pro") : t("plan.tier.free")}
                                </h3>
                                {isPro && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                        {t("billing.active")}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isPro
                                    ? t("billing.proSubtitle")
                                    : t("billing.freeSubtitle")}
                            </p>
                        </div>
                    </div>
                    {!isPro && (
                        <button
                            onClick={() => setShowUpgrade(true)}
                            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                        >
                            <Crown size={15} weight="fill" />
                            {t("billing.upgradeCta")}
                        </button>
                    )}
                </div>

                {isPro && plan.currentPeriodEnd && (
                    <p className="mt-4 text-xs text-muted-foreground">
                        {plan.cancelAtPeriodEnd
                            ? t("billing.cancelsOn", {
                                  date: new Date(plan.currentPeriodEnd).toLocaleDateString(),
                              })
                            : t("billing.renewsOn", {
                                  date: new Date(plan.currentPeriodEnd).toLocaleDateString(),
                              })}
                    </p>
                )}

                {!isPro && (
                    <div className="mt-6 space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            {t("billing.included")}
                        </p>
                        <ul className="space-y-2 text-xs text-foreground/80">
                            {[
                                "plan.feature.vaults",
                                "plan.feature.receivables",
                                "plan.feature.reports",
                                "plan.feature.identity",
                                "plan.feature.travel",
                                "plan.feature.history",
                                "plan.feature.export",
                                "plan.feature.shareVault",
                            ].map((key) => (
                                <li key={key} className="flex items-center gap-2">
                                    <Check size={14} className="text-emerald-500 font-bold" />
                                    {t(key)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Account Limits & Metered Usage */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("billing.usage")}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {USAGE_ROWS.map((row) => (
                        <UsageRow key={row.entity} {...row} />
                    ))}
                </div>
            </div>

            {/* Invoices History */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("billing.receipts")}
                </h3>
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-center">
                    <Clock size={28} weight="thin" className="text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">{t("billing.noInvoices")}</p>
                    <p className="max-w-xs text-xs text-muted-foreground/70">
                        {t("billing.noInvoicesBody")}
                    </p>
                </div>
            </div>

            <UpgradeDialog isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </motion.div>
    );
}
