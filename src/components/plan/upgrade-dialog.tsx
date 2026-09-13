"use client";

// ============================================
// UpgradeDialog — the single Free→Pro upsell surface
// ============================================
//
// Every gate in the app (PlanGate, LimitBadge, a disabled "create" button,
// or a caught NOMADIX_PLAN_LIMIT:* error) opens this same dialog rather than
// rolling its own pricing copy — one place to update if the price or the
// feature matrix ever changes.
//
// Checkout wiring (PayPal) lands in a later phase; for now the CTA is a
// no-op placeholder so the rest of the gating can ship and be tested end to
// end before billing exists.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, Check } from "@phosphor-icons/react";
import { PLAN_PRICING } from "@/lib/plan";
import { useLanguageStore } from "@/stores/language-store";

interface UpgradeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Which gate triggered the dialog, for the headline copy. Optional —
     *  omit for a generic "upgrade" entry point (e.g. the billing page). */
    reason?: string;
}

const PRO_FEATURES = [
    "plan.feature.vaults",
    "plan.feature.receivables",
    "plan.feature.reports",
    "plan.feature.identity",
    "plan.feature.travel",
    "plan.feature.history",
    "plan.feature.export",
    "plan.feature.shareVault",
] as const;

export function UpgradeDialog({ isOpen, onClose, reason }: UpgradeDialogProps) {
    const t = useLanguageStore((s) => s.t);
    const [interval, setInterval] = useState<"month" | "year">("year");

    const price = interval === "month" ? PLAN_PRICING.monthly : PLAN_PRICING.yearly;

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
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                    <Crown size={20} weight="fill" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {t("plan.upgrade.title")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {reason
                                            ? t(`plan.limitReason.${reason}`)
                                            : t("plan.upgrade.subtitle")}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Interval toggle */}
                        <div className="mt-6 flex rounded-xl border border-border bg-accent/50 p-1">
                            <button
                                onClick={() => setInterval("month")}
                                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${interval === "month"
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground"
                                    }`}
                            >
                                {t("plan.interval.month")}
                            </button>
                            <button
                                onClick={() => setInterval("year")}
                                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${interval === "year"
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground"
                                    }`}
                            >
                                {t("plan.interval.year")}
                                <span className="ml-1 text-emerald-500">{t("plan.interval.yearBadge")}</span>
                            </button>
                        </div>

                        <div className="mt-4 flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">
                                ${price.amount}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                / {interval === "month" ? t("plan.interval.month") : t("plan.interval.year")}
                            </span>
                        </div>

                        <ul className="mt-5 space-y-2.5">
                            {PRO_FEATURES.map((key) => (
                                <li key={key} className="flex items-center gap-2 text-xs text-foreground/80">
                                    <Check size={14} className="text-emerald-500 font-bold shrink-0" />
                                    {t(key)}
                                </li>
                            ))}
                        </ul>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                {t("plan.upgrade.notNow")}
                            </button>
                            <button
                                disabled
                                title={t("plan.upgrade.checkoutSoon")}
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {t("plan.upgrade.cta")}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
