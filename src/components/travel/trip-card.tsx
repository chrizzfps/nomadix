"use client";

import { motion } from "framer-motion";
import { MapPin, CalendarBlank, CurrencyEur, CurrencyDollar } from "@phosphor-icons/react";
import Link from "next/link";

interface TripCardProps {
    id: string;
    destinationName: string;
    startDate: string | null;
    endDate: string | null;
    totalBudget: number | null;
    currency: string;
    spent?: number;
}

const gradients = [
    "from-zinc-900 via-zinc-800 to-zinc-700",
    "from-zinc-800 via-zinc-700 to-zinc-600",
    "from-stone-900 via-stone-800 to-stone-700",
    "from-neutral-900 via-neutral-800 to-neutral-700",
];

export function TripCard({
    id,
    destinationName,
    startDate,
    endDate,
    totalBudget,
    currency,
    spent = 0,
}: TripCardProps) {
    const gradientIndex =
        destinationName.charCodeAt(0) % gradients.length;

    const formatDate = (d: string | null) => {
        if (!d) return "TBD";
        return new Date(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    let statusLabel = "Planning";
    let statusColor = "bg-zinc-600 text-zinc-300";

    if (start && end) {
        if (now < start) {
            const daysUntil = Math.ceil(
                (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            statusLabel = `In ${daysUntil}d`;
            statusColor = "bg-emerald-500/20 text-emerald-400";
        } else if (now >= start && now <= end) {
            statusLabel = "Active";
            statusColor = "bg-blue-500/20 text-blue-400";
        } else {
            statusLabel = "Completed";
            statusColor = "bg-zinc-600 text-zinc-400";
        }
    }

    const budgetPercent =
        totalBudget && totalBudget > 0
            ? Math.min((spent / totalBudget) * 100, 100)
            : 0;

    const CurrencyIcon = currency === "EUR" ? CurrencyEur : CurrencyDollar;
    const symbol = currency === "EUR" ? "€" : "$";

    return (
        <Link href={`/dashboard/travel/${id}`}>
            <motion.div
                whileHover={{ y: -2, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${gradients[gradientIndex]} p-5 text-white shadow-sm`}
            >
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <MapPin size={14} weight="fill" className="text-zinc-400" />
                        <span className="text-xs font-medium text-zinc-400">
                            Trip
                        </span>
                    </div>
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusColor}`}
                    >
                        {statusLabel}
                    </span>
                </div>

                {/* Destination */}
                <h3 className="mt-3 text-lg font-bold tracking-tight">
                    {destinationName}
                </h3>

                {/* Dates */}
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                    <CalendarBlank size={12} />
                    {formatDate(startDate)} — {formatDate(endDate)}
                </div>

                {/* Budget Bar */}
                {totalBudget && totalBudget > 0 ? (
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-zinc-400">
                                <CurrencyIcon size={12} />
                                Budget
                            </span>
                            <span className="font-semibold text-zinc-300">
                                {symbol}
                                {spent.toLocaleString()} / {symbol}
                                {totalBudget.toLocaleString()}
                            </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-700">
                            <div
                                className="h-full rounded-full bg-white/60 transition-all"
                                style={{ width: `${budgetPercent}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 flex items-center gap-1 text-xs text-zinc-500">
                        <CurrencyIcon size={12} />
                        No budget set
                    </div>
                )}
            </motion.div>
        </Link>
    );
}
