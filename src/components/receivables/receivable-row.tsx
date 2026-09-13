"use client";

import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { DueBadge } from "@/components/subscriptions/due-badge";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { outstandingAmount } from "@/lib/receivables";
import { friendInitials } from "@/lib/social";
import { usePrivacyStore } from "@/stores/privacy-store";
import type { Receivable } from "@/types";

interface ReceivableRowProps {
    receivable: Receivable;
    clientColor?: string;
    onClick: () => void;
}

export function ReceivableRow({ receivable: r, clientColor, onClick }: ReceivableRowProps) {
    const isPrivacyMode = usePrivacyStore((s) => s.isPrivacyMode);
    const symbol = CURRENCY_SYMBOLS[r.currency] || "$";
    const isClosed = r.status === "paid" || r.status === "canceled";

    return (
        <div
            onClick={onClick}
            className="flex items-center gap-3 px-5 py-3 sm:grid sm:grid-cols-[1fr_140px_120px] sm:gap-4 text-sm transition-colors hover:bg-accent cursor-pointer"
        >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold text-white"
                    style={{ backgroundColor: clientColor || "#71717a" }}
                >
                    {friendInitials(r.client_name || "?")}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {r.client_name || "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                </div>
            </div>

            <div className="hidden sm:flex sm:items-center">
                {r.status === "paid" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle size={12} weight="fill" />
                        Collected
                    </span>
                ) : r.status === "canceled" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        <XCircle size={12} weight="fill" />
                        Canceled
                    </span>
                ) : (
                    <DueBadge dueDate={r.expected_date} />
                )}
            </div>

            <div className="text-right">
                <p
                    className={`font-semibold tabular-nums ${isPrivacyMode ? "blur-sm select-none" : ""} ${
                        isClosed ? "text-muted-foreground" : "text-foreground"
                    }`}
                >
                    {symbol}
                    {outstandingAmount(r).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}
                </p>
                {r.status === "partial" && (
                    <p className="text-[11px] text-muted-foreground">
                        of {symbol}
                        {r.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                )}
            </div>
        </div>
    );
}
