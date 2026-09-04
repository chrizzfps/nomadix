"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useLanguageStore } from "@/stores/language-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import type { Currency } from "@/types";

interface SubscriptionStatsProps {
    monthly: number;
    annual: number;
    next30Total: number;
    next30Count: number;
    hasShortfall: boolean;
    incomeMonthly: number;
    activeCount: number;
    displayCurrency: Currency;
}

function formatAmount(amount: number) {
    return Math.abs(amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function SubscriptionStats({
    monthly,
    annual,
    next30Total,
    next30Count,
    hasShortfall,
    incomeMonthly,
    activeCount,
    displayCurrency,
}: SubscriptionStatsProps) {
    const { isPrivacyMode } = usePrivacyStore();
    const t = useLanguageStore((s) => s.t);
    const symbol = CURRENCY_SYMBOLS[displayCurrency] || "$";
    const blur = isPrivacyMode ? "blur-sm select-none" : "";

    const cards = [
        {
            label: t("subs.stats.monthlyCost"),
            value: `${symbol}${formatAmount(monthly)}`,
            sub: t("subs.stats.normalized"),
        },
        {
            label: t("subs.stats.annualized"),
            value: `${symbol}${formatAmount(annual)}`,
            sub: t(activeCount === 1 ? "subs.stats.activeOne" : "subs.stats.activeMany", {
                count: activeCount,
            }),
        },
        {
            label: t("subs.stats.next30Days"),
            value: `${symbol}${formatAmount(next30Total)}`,
            sub: t(next30Count === 1 ? "subs.stats.chargeOne" : "subs.stats.chargeMany", {
                count: next30Count,
            }),
            warning: hasShortfall,
        },
    ];

    if (incomeMonthly > 0) {
        cards.push({
            label: t("subs.stats.recurringIncome"),
            value: `+${symbol}${formatAmount(incomeMonthly)}${t("subs.stats.perMonth")}`,
            sub: t("subs.stats.incomeSub"),
        });
    }

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map((c) => (
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
                        className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${blur} ${
                            c.warning ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                        }`}
                    >
                        {c.value}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {c.warning && (
                            <WarningCircle size={12} weight="fill" className="text-amber-500" />
                        )}
                        {c.sub}
                    </p>
                </div>
            ))}
        </div>
    );
}
