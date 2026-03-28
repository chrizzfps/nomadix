"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    TrendUp,
    Plus,
    Armchair,
    Bag,
    Book,
    House,
    Airplane,
    Desktop,
    GameController,
    ShoppingBag,
    Coffee,
    Ticket,
    TShirt,
    Wallet,
    PiggyBank,
    ArrowUp,
    ArrowDown,
    ArrowsLeftRight,
} from "@phosphor-icons/react";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { useCurrencyStore } from "@/stores/currency-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { NewTransactionModal } from "@/components/vaults/new-transaction-modal";
import { TransactionEditModal } from "@/components/vaults/transaction-edit-modal";
import Link from "next/link";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

const categoryIcons: Record<string, React.ElementType> = {
    Housing: House,
    Home: Armchair,
    Travel: Airplane,
    Tech: Desktop,
    Technology: Desktop,
    Shopping: ShoppingBag,
    Food: Coffee,
    Snacks: Coffee,
    Tickets: Ticket,
    Clothing: TShirt,
    "Video Games": GameController,
    Accessories: Bag,
    Books: Book,
    Freelance: Desktop,
    Salary: Wallet,
    Investment: TrendUp,
    Other: Wallet,
    Health: PiggyBank,
    Wellness: PiggyBank,
    Transport: Airplane,
};

function formatCurrency(amount: number, currency: string) {
    const symbol = CURRENCY_SYMBOLS[currency] || "$";
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000) {
        return `${symbol}${(absAmount / 1000).toFixed(1)}k`;
    }
    return `${symbol}${absAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatFullCurrency(amount: number, currency: string) {
    const symbol = CURRENCY_SYMBOLS[currency] || "$";
    return `${symbol}${Math.abs(amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

interface Transaction {
    id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    original_currency: string;
    created_at: string;
    date: string | null;
    vault_id: string;
    vault_name?: string;
}

interface VaultBasic {
    id: string;
    name: string;
    currency: string;
    type: string;
}

export default function DashboardPage() {
    const supabase = createClient();
    const { displayCurrency, convert, loadRate } = useCurrencyStore();

    const [userName, setUserName] = useState("");
    const [recentTx, setRecentTx] = useState<Transaction[]>([]);
    const [rawBalances, setRawBalances] = useState<{
        total: { amount: number; currency: string }[];
        savings: { amount: number; currency: string }[];
        checking: { amount: number; currency: string }[];
        cash: { amount: number; currency: string }[];
    }>({ total: [], savings: [], checking: [], cash: [] });
    const [chartData, setChartData] = useState<
        { name: string; income: number; expenses: number }[]
    >([]);
    const [vaults, setVaults] = useState<VaultBasic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddTx, setShowAddTx] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const loadData = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch profile name
        const { data: profile } = await supabase
            .from("users_profile")
            .select("full_name")
            .eq("id", user.id)
            .single();
        setUserName(profile?.full_name || "Nomad");

        // Fetch vaults
        const { data: vaultRows } = await supabase
            .from("vaults")
            .select("id, name, currency, type")
            .eq("user_id", user.id);

        setVaults(vaultRows || []);

        // Fetch all transactions
        const { data: txRows } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        const allTx = (txRows || []).map((tx) => ({
            ...tx,
            amount: Number(tx.amount),
        }));

        // Build vault name lookup
        const vaultNameMap = new Map<string, string>();
        (vaultRows || []).forEach((v) => vaultNameMap.set(v.id, v.name));

        // Enrich with vault name and set recent (last 5)
        const enriched = allTx.map((tx) => ({
            ...tx,
            vault_name: vaultNameMap.get(tx.vault_id) || "Unknown",
        }));
        setRecentTx(enriched.slice(0, 5));

        // Compute raw balances per vault (keeping native currency)
        const vaultCurrencyMap = new Map<string, string>();
        const vaultTypeMap = new Map<string, string>();
        (vaultRows || []).forEach((v) => {
            vaultCurrencyMap.set(v.id, v.currency);
            vaultTypeMap.set(v.id, v.type);
        });

        // Sum per vault, then group by type
        const vaultSums = new Map<string, number>();
        allTx.forEach((tx) => {
            vaultSums.set(tx.vault_id, (vaultSums.get(tx.vault_id) || 0) + tx.amount);
        });

        const balances: {
            total: { amount: number; currency: string }[];
            savings: { amount: number; currency: string }[];
            checking: { amount: number; currency: string }[];
            cash: { amount: number; currency: string }[];
        } = { total: [], savings: [], checking: [], cash: [] };

        vaultSums.forEach((sum, vaultId) => {
            const curr = vaultCurrencyMap.get(vaultId) || "USD";
            const vType = vaultTypeMap.get(vaultId) || "checking";
            const entry = { amount: sum, currency: curr };
            balances.total.push(entry);
            if (vType === "savings") balances.savings.push(entry);
            else if (vType === "checking") balances.checking.push(entry);
            else if (vType === "cash") balances.cash.push(entry);
        });

        setRawBalances(balances);

        // Build chart data — group by week
        const now = new Date();
        const weeks: { name: string; income: number; expenses: number }[] = [];
        for (let w = 3; w >= 0; w--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - w * 7 - 6);
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - w * 7);

            let income = 0;
            let expenses = 0;
            allTx.forEach((tx) => {
                const txDate = new Date(tx.created_at);
                if (txDate >= weekStart && txDate <= weekEnd) {
                    if (tx.amount > 0) income += tx.amount;
                    else expenses += Math.abs(tx.amount);
                }
            });

            weeks.push({
                name: `Week ${4 - w}`,
                income: Math.round(income),
                expenses: Math.round(expenses),
            });
        }
        setChartData(weeks);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadRate().then(() => loadData());
    }, [loadData, loadRate]);

    // Convert raw balances to display currency
    const symbol = CURRENCY_SYMBOLS[displayCurrency];
    const sumConverted = (entries: { amount: number; currency: string }[]) =>
        entries.reduce((acc, e) => acc + convert(e.amount, e.currency as "EUR" | "USD"), 0);

    const totalBalance = sumConverted(rawBalances.total);
    const checkingBalance = sumConverted(rawBalances.checking);
    const savingsBalance = sumConverted(rawBalances.savings);
    const cashBalance = sumConverted(rawBalances.cash);

    const summaryCards = [
        { label: "Total Balance", value: totalBalance, icon: Wallet },
        { label: "Checking", value: checkingBalance, icon: Wallet },
        { label: "Savings", value: savingsBalance, icon: PiggyBank },
        { label: "Cash", value: cashBalance, icon: Wallet },
    ];

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8 space-y-6">
                <div className="h-10 w-56 animate-pulse rounded-lg bg-zinc-100" />
                <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                        Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Welcome back, {userName}.
                    </p>
                </div>
                <CurrencyToggle />
            </div>

            {/* Main Grid */}
            <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* Total Balance Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="rounded-2xl border border-zinc-200 bg-white p-6"
                    >
                        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                            Total Combined Balance
                        </p>
                        <div className="mt-3 flex items-baseline gap-3">
                            <span className="text-4xl font-bold tracking-tight text-zinc-900">
                                {symbol}
                                {totalBalance.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                            {totalBalance > 0 && (
                                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                                    <TrendUp size={12} weight="bold" />
                                    Active
                                </span>
                            )}
                        </div>
                    </motion.div>

                    {/* Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-2xl border border-zinc-200 bg-white p-6"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-zinc-900">
                                    Income vs Expenses
                                </h3>
                                <p className="mt-0.5 text-xs text-zinc-400">
                                    Last 4 weeks overview
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#f4f4f5"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{
                                            fontSize: 11,
                                            fill: "#a1a1aa",
                                        }}
                                        dy={8}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#18181b",
                                            border: "none",
                                            borderRadius: "12px",
                                            padding: "8px 12px",
                                            fontSize: "12px",
                                            color: "#fff",
                                        }}
                                        itemStyle={{ color: "#fff" }}
                                        cursor={{
                                            stroke: "#d4d4d8",
                                            strokeDasharray: "4 4",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="income"
                                        stroke="#09090b"
                                        strokeWidth={2}
                                        dot={{
                                            r: 4,
                                            fill: "#fff",
                                            strokeWidth: 2,
                                            stroke: "#09090b",
                                        }}
                                        activeDot={{
                                            r: 6,
                                            fill: "#09090b",
                                        }}
                                        name="Income"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="expenses"
                                        stroke="#d4d4d8"
                                        strokeWidth={2}
                                        dot={{
                                            r: 4,
                                            fill: "#fff",
                                            strokeWidth: 2,
                                            stroke: "#d4d4d8",
                                        }}
                                        activeDot={{
                                            r: 6,
                                            fill: "#d4d4d8",
                                        }}
                                        name="Expenses"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Summary Cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                    >
                        {summaryCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div
                                    key={card.label}
                                    className="rounded-2xl border border-zinc-200 bg-white p-4 text-center"
                                >
                                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                                        <Icon
                                            size={18}
                                            className="text-zinc-600"
                                        />
                                    </div>
                                    <p className="text-[10px] font-medium tracking-wide uppercase text-zinc-400">
                                        {card.label}
                                    </p>
                                    <p className="mt-1 text-base font-bold text-zinc-900">
                                        {formatCurrency(
                                            card.value,
                                            displayCurrency
                                        )}
                                    </p>
                                </div>
                            );
                        })}
                    </motion.div>
                </div>

                {/* Right Column — Transactions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl border border-zinc-200 bg-white"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                        <h3 className="text-base font-semibold text-zinc-900">
                            Transactions
                        </h3>
                        <button
                            onClick={() => setShowAddTx(true)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
                        >
                            <Plus size={14} weight="bold" />
                        </button>
                    </div>

                    {/* Transaction List */}
                    <div className="divide-y divide-zinc-50">
                        {recentTx.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm text-zinc-400">
                                No transactions yet. Add one!
                            </div>
                        ) : (
                            recentTx.map((tx) => {
                                const isIncome = tx.amount > 0;
                                const IconCmp =
                                    categoryIcons[tx.category || ""] || Wallet;
                                return (
                                    <div
                                        key={tx.id}
                                        onClick={() => setSelectedTx(tx)}
                                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 cursor-pointer"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                                            {tx.type === "transfer" ? (
                                                <ArrowsLeftRight
                                                    size={18}
                                                    className="text-zinc-600"
                                                />
                                            ) : isIncome ? (
                                                <ArrowDown
                                                    size={18}
                                                    className="text-zinc-600"
                                                />
                                            ) : (
                                                <IconCmp
                                                    size={18}
                                                    className="text-zinc-600"
                                                />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-zinc-900">
                                                {tx.description || tx.type}
                                            </p>
                                            <p className="text-[11px] text-zinc-400">
                                                {tx.category || tx.type}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-sm font-semibold tabular-nums ${isIncome
                                                ? "text-emerald-600"
                                                : "text-zinc-900"
                                                }`}
                                        >
                                            {isIncome ? "+" : "-"}
                                            {symbol}
                                            {Math.abs(
                                                convert(
                                                    tx.amount,
                                                    (tx.original_currency || "USD") as "EUR" | "USD"
                                                )
                                            ).toLocaleString("en-US", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* View All */}
                    <div className="border-t border-zinc-100 px-5 py-3">
                        <Link
                            href="/dashboard/vaults"
                            className="block w-full rounded-xl border border-zinc-200 py-2.5 text-center text-xs font-semibold text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-900"
                        >
                            View All Transactions
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* New Transaction Modal */}
            <NewTransactionModal
                isOpen={showAddTx}
                onClose={() => setShowAddTx(false)}
                onCreated={loadData}
                vaults={vaults.map((v) => ({
                    id: v.id,
                    name: v.name,
                    currency: v.currency,
                }))}
            />
            <TransactionEditModal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                onUpdated={(tx) => {
                    setRecentTx((prev) =>
                        prev.map((t) =>
                            t.id === tx.id
                                ? {
                                    ...t,
                                    ...tx,
                                    amount:
                                        typeof tx.amount === "number"
                                            ? tx.amount
                                            : t.amount,
                                }
                                : t
                        )
                    );
                    setSelectedTx((prev) =>
                        prev && prev.id === tx.id ? { ...prev, ...tx } : prev
                    );
                }}
                onDeleted={(id) => {
                    setRecentTx((prev) => prev.filter((t) => t.id !== id));
                    setSelectedTx(null);
                }}
                transaction={selectedTx}
            />
        </div>
    );
}
