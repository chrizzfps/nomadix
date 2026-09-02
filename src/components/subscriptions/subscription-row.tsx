"use client";

import { PauseCircle, Repeat } from "@phosphor-icons/react";
import { usePrivacyStore } from "@/stores/privacy-store";
import { CATEGORY_ICON_MAP } from "@/lib/transaction-categories";
import { cycleLabel } from "@/lib/subscriptions";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { DueBadge } from "./due-badge";
import type { Subscription } from "@/types";

interface SubscriptionRowProps {
    subscription: Subscription;
    vaultName: string;
    displayAmount: number;
    displayCurrency: string;
    onClick: () => void;
}

export function SubscriptionRow({
    subscription: s,
    vaultName,
    displayAmount,
    displayCurrency,
    onClick,
}: SubscriptionRowProps) {
    const { isPrivacyMode } = usePrivacyStore();
    const Icon = (s.icon_key && CATEGORY_ICON_MAP[s.icon_key]) || Repeat;
    const isIncome = s.direction === "income";
    const nativeSymbol = CURRENCY_SYMBOLS[s.currency] || "$";
    const displaySymbol = CURRENCY_SYMBOLS[displayCurrency] || "$";
    const showNative = s.currency !== displayCurrency;

    return (
        <div
            onClick={onClick}
            className="flex items-center gap-3 px-5 py-3 sm:grid sm:grid-cols-[1fr_140px_120px_110px_130px] sm:gap-4 text-sm transition-colors hover:bg-zinc-50 cursor-pointer"
        >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${s.color}14` }}
                >
                    <Icon size={17} style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-zinc-900">{s.name}</p>
                        {s.status === "paused" && (
                            <PauseCircle
                                size={13}
                                weight="fill"
                                className="shrink-0 text-zinc-400"
                            />
                        )}
                    </div>
                    <p className="truncate text-xs text-zinc-400">
                        {s.merchant || s.category || "—"}
                    </p>
                </div>
            </div>

            <span className="hidden sm:block text-zinc-500">
                {cycleLabel(s.billing_cycle, s.interval_count, s.custom_interval_days)}
            </span>

            <span className="hidden sm:block truncate text-zinc-500">{vaultName}</span>

            <div className="hidden sm:block">
                <DueBadge dueDate={s.next_due_date} />
            </div>

            <div className="text-right">
                <p
                    className={`font-semibold tabular-nums ${isPrivacyMode ? "blur-sm select-none" : ""} ${
                        isIncome ? "text-emerald-600" : "text-zinc-900"
                    }`}
                >
                    {isIncome ? "+" : ""}
                    {displaySymbol}
                    {Math.abs(displayAmount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}
                </p>
                {showNative && (
                    <p className="text-[10px] text-zinc-400">
                        ≈ {nativeSymbol}
                        {s.amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </p>
                )}
            </div>
        </div>
    );
}
