"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    BarChart,
    Bar,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Receipt, TrendUp, TrendDown, CalendarBlank, Vault } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { useCurrencyStore } from "@/stores/currency-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";

interface VaultBasic {
    id: string;
    name: string;
    currency: string;
}

interface TransactionRow {
    id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    original_currency: string;
    created_at: string;
    date: string | null;
    vault_id: string;
}

function toISODate(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function clampDateRange(from: string, to: string) {
    if (!from || !to) return { from, to };
    if (from <= to) return { from, to };
    return { from: to, to: from };
}

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function monthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: number | string | undefined, symbol: string) {
    const n = typeof value === "number" ? value : Number(value || 0);
    return `${symbol}${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export default function ExpensesPage() {
    const supabase = createClient();
    const { displayCurrency, convert, loadRate } = useCurrencyStore();
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    const [vaults, setVaults] = useState<VaultBasic[]>([]);
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [vaultFilter, setVaultFilter] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return toISODate(d);
    });
    const [dateTo, setDateTo] = useState<string>(() => toISODate(new Date()));

    const loadData = useCallback(async () => {
        setError(null);
        setIsLoading(true);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            setError("Unable to load expenses. Please try again.");
            setIsLoading(false);
            return;
        }

        const { data: vaultRows, error: vaultError } = await supabase
            .from("vaults")
            .select("id, name, currency")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        const { data: txRows, error: txError } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (vaultError || txError) {
            setError("Unable to load expenses. Please try again.");
        }

        setVaults((vaultRows || []) as VaultBasic[]);
        setTransactions(
            (txRows || []).map((t) => ({
                ...t,
                amount: Number(t.amount),
            }))
        );
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadRate().then(() => loadData());
    }, [loadData, loadRate]);

    const normalizedRange = useMemo(
        () => clampDateRange(dateFrom, dateTo),
        [dateFrom, dateTo]
    );

    const rangeBounds = useMemo(() => {
        const from = normalizedRange.from ? startOfDay(new Date(normalizedRange.from)) : null;
        const to = normalizedRange.to ? endOfDay(new Date(normalizedRange.to)) : null;
        return { from, to };
    }, [normalizedRange.from, normalizedRange.to]);

    const filteredExpenses = useMemo(() => {
        const { from, to } = rangeBounds;
        return transactions.filter((t) => {
            const isExpense = t.type === "expense" || t.amount < 0;
            if (!isExpense) return false;
            if (vaultFilter !== "all" && t.vault_id !== vaultFilter) return false;
            const txDate = new Date(t.date || t.created_at);
            if (from && txDate < from) return false;
            if (to && txDate > to) return false;
            return true;
        });
    }, [rangeBounds, transactions, vaultFilter]);

    const totalsByCategory = useMemo(() => {
        const map = new Map<string, number>();
        filteredExpenses.forEach((t) => {
            const key = t.category || "Other";
            const value = Math.abs(
                convert(t.amount, (t.original_currency || "USD") as "EUR" | "USD")
            );
            map.set(key, (map.get(key) || 0) + value);
        });
        const items = Array.from(map.entries())
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);
        const grandTotal = items.reduce((acc, x) => acc + x.total, 0);
        return {
            items: items.map((x) => ({
                ...x,
                percent: grandTotal > 0 ? (x.total / grandTotal) * 100 : 0,
            })),
            grandTotal,
        };
    }, [convert, filteredExpenses]);

    const largestExpense = useMemo<{
        amount: number;
        description: string;
        date: string;
        vaultId: string;
    } | null>(() => {
        let best: {
            amount: number;
            description: string;
            date: string;
            vaultId: string;
        } | null = null;
        filteredExpenses.forEach((t) => {
            const value = Math.abs(
                convert(t.amount, (t.original_currency || "USD") as "EUR" | "USD")
            );
            if (!best || value > best.amount) {
                best = {
                    amount: value,
                    description: t.description || t.category || "Expense",
                    date: t.date || t.created_at,
                    vaultId: t.vault_id,
                };
            }
        });
        return best;
    }, [convert, filteredExpenses]);

    const periodComparison = useMemo(() => {
        const { from, to } = rangeBounds;
        if (!from || !to) return null;
        const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
        const prevTo = new Date(from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(from);
        prevFrom.setDate(prevFrom.getDate() - days);
        const prevBounds = { from: startOfDay(prevFrom), to: endOfDay(prevTo) };

        const sumInBounds = (bounds: { from: Date; to: Date }) =>
            transactions.reduce((acc, t) => {
                const isExpense = t.type === "expense" || t.amount < 0;
                if (!isExpense) return acc;
                if (vaultFilter !== "all" && t.vault_id !== vaultFilter) return acc;
                const txDate = new Date(t.date || t.created_at);
                if (txDate < bounds.from || txDate > bounds.to) return acc;
                return (
                    acc +
                    Math.abs(
                        convert(t.amount, (t.original_currency || "USD") as "EUR" | "USD")
                    )
                );
            }, 0);

        const current = totalsByCategory.grandTotal;
        const previous = sumInBounds(prevBounds);
        const delta = current - previous;
        const pct = previous > 0 ? (delta / previous) * 100 : null;
        return { current, previous, delta, pct, days };
    }, [convert, rangeBounds, totalsByCategory.grandTotal, transactions, vaultFilter]);

    const monthlyAverage = useMemo(() => {
        const { from, to } = rangeBounds;
        if (!from || !to) return null;
        const months = new Set<string>();
        filteredExpenses.forEach((t) => months.add(monthKey(new Date(t.date || t.created_at))));
        const count = Math.max(1, months.size);
        return totalsByCategory.grandTotal / count;
    }, [filteredExpenses, rangeBounds, totalsByCategory.grandTotal]);

    const timeSeries = useMemo(() => {
        const { from, to } = rangeBounds;
        if (!from || !to) return [];
        const rangeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
        const byDay = rangeDays <= 60;

        const map = new Map<string, number>();
        filteredExpenses.forEach((t) => {
            const d = new Date(t.date || t.created_at);
            const key = byDay ? toISODate(d) : monthKey(d);
            const value = Math.abs(
                convert(t.amount, (t.original_currency || "USD") as "EUR" | "USD")
            );
            map.set(key, (map.get(key) || 0) + value);
        });

        const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
        return keys.map((k) => ({ name: k, expenses: Math.round(map.get(k) || 0) }));
    }, [convert, filteredExpenses, rangeBounds]);

    const categoryBarData = useMemo(() => {
        return totalsByCategory.items.slice(0, 8).map((x) => ({
            name: x.category,
            total: Math.round(x.total),
        }));
    }, [totalsByCategory.items]);

    const pieData = useMemo(() => {
        return totalsByCategory.items.slice(0, 8).map((x) => ({
            name: x.category,
            value: x.total,
        }));
    }, [totalsByCategory.items]);

    const palette = [
        "#18181b",
        "#27272a",
        "#3f3f46",
        "#52525b",
        "#71717a",
        "#a1a1aa",
        "#d4d4d8",
        "#e4e4e7",
    ];

    const vaultNameMap = useMemo(() => {
        const m = new Map<string, string>();
        vaults.forEach((v) => m.set(v.id, v.name));
        return m;
    }, [vaults]);

    const metrics = useMemo(() => {
        const total = totalsByCategory.grandTotal;
        const topCategory = totalsByCategory.items[0]?.category || "—";
        const topCategoryPct = totalsByCategory.items[0]?.percent ?? 0;
        return { total, topCategory, topCategoryPct };
    }, [totalsByCategory.grandTotal, totalsByCategory.items]);

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8 space-y-6">
                <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-100" />
                <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-72 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                        Expenses
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Analyze your spending across categories and time.
                    </p>
                </motion.div>
                <div className="flex items-center gap-3">
                    <CurrencyToggle />
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4"
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                            <CalendarBlank size={14} />
                            Date range
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="sr-only" htmlFor="dateFrom">
                                From
                            </label>
                            <input
                                id="dateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                            <label className="sr-only" htmlFor="dateTo">
                                To
                            </label>
                            <input
                                id="dateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                            <Vault size={14} />
                            Vault
                        </div>
                        <div className="mt-2">
                            <label className="sr-only" htmlFor="vaultFilter">
                                Vault filter
                            </label>
                            <select
                                id="vaultFilter"
                                value={vaultFilter}
                                onChange={(e) => setVaultFilter(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                            >
                                <option value="all">All vaults</option>
                                {vaults.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                            <Receipt size={14} />
                            Total spent
                        </div>
                        <div className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
                            {symbol}
                            {metrics.total.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                            Top category: {metrics.topCategory} (
                            {metrics.topCategoryPct.toFixed(1)}%)
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                            Period vs period
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            {periodComparison?.pct != null ? (
                                periodComparison.pct >= 0 ? (
                                    <TrendUp size={18} className="text-zinc-700" />
                                ) : (
                                    <TrendDown size={18} className="text-zinc-700" />
                                )
                            ) : (
                                <TrendUp size={18} className="text-zinc-700" />
                            )}
                            <div className="text-2xl font-bold tabular-nums text-zinc-900">
                                {periodComparison?.pct == null
                                    ? "—"
                                    : `${periodComparison.pct >= 0 ? "+" : ""}${periodComparison.pct.toFixed(
                                          1
                                      )}%`}
                            </div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                            {periodComparison?.days
                                ? `Compared to previous ${periodComparison.days} days`
                                : "Set a date range to compare"}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
                        {error}
                    </div>
                )}
            </motion.div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2"
                >
                    <h2 className="text-base font-semibold text-zinc-900">
                        Spending over time
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">
                        {normalizedRange.from} → {normalizedRange.to}
                    </p>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timeSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                                <Tooltip
                                    formatter={(value: number | string | undefined) =>
                                        formatMoney(value, symbol)
                                    }
                                />
                                <Line
                                    type="monotone"
                                    dataKey="expenses"
                                    stroke="#18181b"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5"
                >
                    <h2 className="text-base font-semibold text-zinc-900">
                        Category share
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">
                        Top categories by spend
                    </p>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    formatter={(
                                        value: number | string | undefined,
                                        name: string | undefined
                                    ) => [formatMoney(value, symbol), name || ""]}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 11, color: "#71717a" }}
                                />
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={2}
                                >
                                    {pieData.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={palette[i % palette.length]}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2"
                >
                    <h2 className="text-base font-semibold text-zinc-900">
                        Spend by category
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">
                        Total and distribution for the selected filters
                    </p>
                    <div className="mt-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryBarData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                                <Tooltip
                                    formatter={(value: number | string | undefined) =>
                                        formatMoney(value, symbol)
                                    }
                                />
                                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                                    {categoryBarData.map((_, i) => (
                                        <Cell
                                            key={i}
                                            fill={palette[i % palette.length]}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
                        <div className="grid grid-cols-[1fr_120px_80px] gap-3 border-b border-zinc-100 bg-white px-4 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                            <span>Category</span>
                            <span className="text-right">Total</span>
                            <span className="text-right">%</span>
                        </div>
                        <div className="divide-y divide-zinc-50 bg-white">
                            {totalsByCategory.items.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-zinc-400">
                                    No expenses found for the selected filters.
                                </div>
                            ) : (
                                totalsByCategory.items.map((x) => (
                                    <div
                                        key={x.category}
                                        className="grid grid-cols-[1fr_120px_80px] gap-3 px-4 py-3 text-sm"
                                    >
                                        <span className="font-medium text-zinc-900">
                                            {x.category}
                                        </span>
                                        <span className="text-right font-semibold tabular-nums text-zinc-900">
                                            {symbol}
                                            {x.total.toLocaleString("en-US", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                        <span className="text-right text-zinc-500 tabular-nums">
                                            {x.percent.toFixed(1)}%
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5"
                >
                    <h2 className="text-base font-semibold text-zinc-900">
                        Highlights
                    </h2>
                    <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                                Monthly average
                            </p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                                {monthlyAverage == null ? (
                                    "—"
                                ) : (
                                    <>
                                        {symbol}
                                        {monthlyAverage.toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                                Largest expense
                            </p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                                {largestExpense ? (
                                    <>
                                        {symbol}
                                        {largestExpense.amount.toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </>
                                ) : (
                                    "—"
                                )}
                            </p>
                            {largestExpense && (
                                <p className="mt-1 text-xs text-zinc-400">
                                    {largestExpense.description} ·{" "}
                                    {vaultNameMap.get(largestExpense.vaultId) || "Unknown"} ·{" "}
                                    {new Date(largestExpense.date).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </p>
                            )}
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                                Total transactions
                            </p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                                {filteredExpenses.length.toLocaleString("en-US")}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                                Filtered expenses in the selected range
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
