"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { usePrivacyStore } from "@/stores/privacy-store";
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
    const symbol = CURRENCY_SYMBOLS[displayCurrency] || "$";
    const blur = isPrivacyMode ? "blur-sm select-none" : "";

    const cards = [
        {
            label: "Monthly cost",
            value: `${symbol}${formatAmount(monthly)}`,
            sub: "Normalized across all cycles",
        },
        {
            label: "Annualized",
            value: `${symbol}${formatAmount(annual)}`,
            sub: `${activeCount} active subscription${activeCount === 1 ? "" : "s"}`,
        },
        {
            label: "Next 30 days",
            value: `${symbol}${formatAmount(next30Total)}`,
            sub: `${next30Count} charge${next30Count === 1 ? "" : "s"}`,
            warning: hasShortfall,
        },
    ];

    if (incomeMonthly > 0) {
        cards.push({
            label: "Recurring income",
            value: `+${symbol}${formatAmount(incomeMonthly)}/mo`,
            sub: "Salary, rent, freelance & more",
        });
    }

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map((c) => (
                <div
                    key={c.label}
                    className={`rounded-2xl border p-5 ${
                        c.warning
                            ? "border-amber-200 bg-amber-50/40"
                            : "border-zinc-200 bg-white"
                    }`}
                >
                    <p className="text-xs font-medium tracking-[0.08em] uppercase text-zinc-400">
                        {c.label}
                    </p>
                    <p
                        className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${blur} ${
                            c.warning ? "text-amber-700" : "text-zinc-900"
                        }`}
                    >
                        {c.value}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
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
