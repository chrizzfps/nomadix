"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    ArrowUp,
    ArrowDown,
    ArrowsLeftRight,
    House,
    Airplane,
    Desktop,
    ShoppingBag,
    Coffee,
    Heart,
    Car,
} from "@phosphor-icons/react";
import { VaultCard } from "@/components/vaults/vault-card";
import { CreateVaultModal } from "@/components/vaults/create-vault-modal";
import { NewTransactionModal } from "@/components/vaults/new-transaction-modal";
import { TransactionDetailModal } from "@/components/vaults/transaction-detail-modal";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { useCurrencyStore } from "@/stores/currency-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

interface VaultData {
    id: string;
    name: string;
    currency: string;
    type: "savings" | "checking" | "cash";
    is_protected: boolean;
    balance: number;
}

interface TransactionData {
    id: string;
    vault_id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    date: string | null;
    original_currency: string;
    created_at: string;
    vault_name?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
    Housing: House,
    Travel: Airplane,
    Tech: Desktop,
    Shopping: ShoppingBag,
    Food: Coffee,
    Health: Heart,
    Transport: Car,
};

export default function VaultsPage() {
    const supabase = createClient();
    const { displayCurrency, convert, loadRate } = useCurrencyStore();
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    const [vaults, setVaults] = useState<VaultData[]>([]);
    const [transactions, setTransactions] = useState<TransactionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateVault, setShowCreateVault] = useState(false);
    const [showNewTransaction, setShowNewTransaction] = useState(false);
    const [selectedTx, setSelectedTx] = useState<TransactionData | null>(null);
    const [activityFilter, setActivityFilter] = useState<
        "all" | "income" | "expense" | "transfer"
    >("all");

    const loadData = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch vaults
        const { data: vaultRows } = await supabase
            .from("vaults")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        // Fetch all transactions
        const { data: txRows } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        // Build vault name lookup
        const vaultMap = new Map<string, string>();
        (vaultRows || []).forEach((v) => vaultMap.set(v.id, v.name));

        // Compute balances per vault
        const balanceMap = new Map<string, number>();
        (txRows || []).forEach((tx) => {
            const prev = balanceMap.get(tx.vault_id) || 0;
            balanceMap.set(tx.vault_id, prev + Number(tx.amount));
        });

        const enrichedVaults: VaultData[] = (vaultRows || []).map((v) => ({
            id: v.id,
            name: v.name,
            currency: v.currency,
            type: v.type as "savings" | "checking" | "cash",
            is_protected: v.is_protected,
            balance: balanceMap.get(v.id) || 0,
        }));

        const enrichedTx: TransactionData[] = (txRows || []).map((tx) => ({
            ...tx,
            amount: Number(tx.amount),
            vault_name: vaultMap.get(tx.vault_id) || "Unknown",
        }));

        setVaults(enrichedVaults);
        setTransactions(enrichedTx);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadRate().then(() => loadData());
    }, [loadData, loadRate]);

    const totalBalance = vaults.reduce(
        (sum, v) => sum + convert(v.balance, v.currency as "EUR" | "USD"),
        0
    );

    const filteredActivity =
        activityFilter === "all"
            ? transactions
            : transactions.filter((a) => a.type === activityFilter);

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8 space-y-6">
                <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-100" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-40 animate-pulse rounded-2xl bg-zinc-100"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                        Vaults
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Manage your multi-currency financial vaults.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <CurrencyToggle />
                    <button
                        onClick={() => setShowNewTransaction(true)}
                        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50"
                    >
                        <ArrowsLeftRight size={16} />
                        Transaction
                    </button>
                    <button
                        onClick={() => setShowCreateVault(true)}
                        className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
                    >
                        <Plus size={16} weight="bold" />
                        New Vault
                    </button>
                </div>
            </div>

            {/* Vault Cards Grid */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {vaults.map((vault, i) => (
                    <motion.div
                        key={vault.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                    >
                        <VaultCard
                            id={vault.id}
                            name={vault.name}
                            balance={vault.balance}
                            currency={vault.currency}
                            type={vault.type}
                            isProtected={vault.is_protected}
                            onUpdated={loadData}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Total */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="mt-4 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3"
            >
                <span className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Total Across All Vaults
                </span>
                <span className="text-lg font-bold text-zinc-900">
                    {symbol}
                    {totalBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}
                </span>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
            >
                {/* Activity Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-semibold text-zinc-900">
                        Recent Activity
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-zinc-200 p-0.5">
                            {(
                                [
                                    { value: "all", label: "All" },
                                    { value: "income", label: "Income" },
                                    { value: "expense", label: "Expense" },
                                    { value: "transfer", label: "Transfer" },
                                ] as const
                            ).map((f) => (
                                <button
                                    key={f.value}
                                    onClick={() => setActivityFilter(f.value)}
                                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${activityFilter === f.value
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-500 hover:text-zinc-700"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Activity Table */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    {/* Table Header */}
                    <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_100px_120px] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                        <span>Date</span>
                        <span>Description</span>
                        <span>Vault</span>
                        <span>Category</span>
                        <span className="text-right">Amount</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-zinc-50">
                        {filteredActivity.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm text-zinc-400">
                                No transactions found.
                            </div>
                        ) : (
                            filteredActivity.slice(0, 10).map((item) => {
                                const isIncome = item.type === "income";
                                const isTransfer = item.type === "transfer";
                                const IconCmp =
                                    categoryIcons[item.category || ""];
                                const currSymbol =
                                    CURRENCY_SYMBOLS[
                                    item.original_currency
                                    ] || "$";

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedTx(item)}
                                        className="flex items-center gap-3 px-5 py-3 sm:grid sm:grid-cols-[80px_1fr_1fr_100px_120px] sm:gap-4 text-sm transition-colors hover:bg-zinc-50 cursor-pointer"
                                    >
                                        <span className="hidden sm:block text-xs text-zinc-400">
                                            {formatDate(
                                                item.date || item.created_at
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                                                {IconCmp ? (
                                                    <IconCmp
                                                        size={14}
                                                        className="text-zinc-500"
                                                    />
                                                ) : isTransfer ? (
                                                    <ArrowsLeftRight
                                                        size={14}
                                                        className="text-zinc-500"
                                                    />
                                                ) : isIncome ? (
                                                    <ArrowDown
                                                        size={14}
                                                        className="text-zinc-500"
                                                    />
                                                ) : (
                                                    <ArrowUp
                                                        size={14}
                                                        className="text-zinc-500"
                                                    />
                                                )}
                                            </div>
                                            <span className="truncate font-medium text-zinc-900">
                                                {item.description || item.type}
                                            </span>
                                        </div>
                                        <span className="hidden sm:block text-zinc-500 truncate">
                                            {item.vault_name}
                                        </span>
                                        <span className="hidden sm:block text-xs text-zinc-400">
                                            {item.category || "—"}
                                        </span>
                                        <span
                                            className={`text-right font-semibold tabular-nums ${isIncome
                                                ? "text-emerald-600"
                                                : isTransfer
                                                    ? "text-zinc-500"
                                                    : "text-zinc-900"
                                                }`}
                                        >
                                            {item.amount > 0 ? "+" : ""}
                                            {symbol}
                                            {Math.abs(
                                                convert(
                                                    item.amount,
                                                    (item.original_currency || "USD") as "EUR" | "USD"
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
                </div>
            </motion.div>

            {/* Modals */}
            <CreateVaultModal
                isOpen={showCreateVault}
                onClose={() => setShowCreateVault(false)}
                onCreated={loadData}
            />
            <NewTransactionModal
                isOpen={showNewTransaction}
                onClose={() => setShowNewTransaction(false)}
                onCreated={loadData}
                vaults={vaults.map((v) => ({
                    id: v.id,
                    name: v.name,
                    currency: v.currency,
                }))}
            />
            <TransactionDetailModal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                onDeleted={loadData}
                transaction={selectedTx}
            />
        </div>
    );
}
