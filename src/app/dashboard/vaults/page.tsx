"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    ArrowUp,
    ArrowDown,
    ArrowsLeftRight,
    Armchair,
    Bag,
    Book,
    GameController,
    MagnifyingGlass,
    Tag,
    Ticket,
    TShirt,
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
import { TransactionEditModal } from "@/components/vaults/transaction-edit-modal";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { useCurrencyStore } from "@/stores/currency-store";
import { CURRENCY_SYMBOLS, TRANSACTION_CATEGORIES } from "@/lib/constants";
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
    Home: Armchair,
    Travel: Airplane,
    Tech: Desktop,
    Technology: Desktop,
    Shopping: ShoppingBag,
    Food: Coffee,
    Snacks: Coffee,
    Entertainment: Ticket,
    Sport: Heart,
    Tickets: Ticket,
    Clothing: TShirt,
    "Video Games": GameController,
    Accessories: Bag,
    Books: Book,
    Health: Heart,
    Wellness: Heart,
    Transport: Car,
};

export default function VaultsPage() {
    const supabase = createClient();
    const { displayCurrency, convert, loadRate } = useCurrencyStore();
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    const ACTIVITY_PAGE_SIZE = 10;

    const [vaults, setVaults] = useState<VaultData[]>([]);
    const [transactions, setTransactions] = useState<TransactionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activityError, setActivityError] = useState<string | null>(null);
    const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false);
    const [activityVisibleCount, setActivityVisibleCount] =
        useState(ACTIVITY_PAGE_SIZE);
    const [showCreateVault, setShowCreateVault] = useState(false);
    const [showNewTransaction, setShowNewTransaction] = useState(false);
    const [selectedTx, setSelectedTx] = useState<TransactionData | null>(null);
    const [activityFilter, setActivityFilter] = useState<
        "all" | "income" | "expense" | "transfer"
    >("all");
    const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
    const [categoryQuery, setCategoryQuery] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        setActivityError(null);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError) {
            setActivityError("Unable to load activity. Please try again.");
            setIsLoading(false);
            return;
        }
        if (!user) {
            setIsLoading(false);
            return;
        }

        // Fetch vaults
        const { data: vaultRows, error: vaultError } = await supabase
            .from("vaults")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        // Fetch all transactions
        const { data: txRows, error: txError } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (vaultError || txError) {
            setActivityError("Unable to load activity. Please try again.");
        }

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

    useEffect(() => {
        setActivityVisibleCount(ACTIVITY_PAGE_SIZE);
    }, [activityFilter, selectedCategories]);

    const totalBalance = vaults.reduce(
        (sum, v) => sum + convert(v.balance, v.currency as "EUR" | "USD"),
        0
    );

    const filteredByType =
        activityFilter === "all"
            ? transactions
            : transactions.filter((a) => a.type === activityFilter);

    const availableCategories = useMemo(() => {
        const fromData = Array.from(
            new Set(
                transactions
                    .map((t) => t.category)
                    .filter((c): c is string => !!c && c.trim().length > 0)
            )
        );
        const base = fromData.length > 0 ? fromData : [...TRANSACTION_CATEGORIES];
        return base.sort((a, b) => a.localeCompare(b));
    }, [transactions]);

    const filteredCategories = useMemo(() => {
        const q = categoryQuery.trim().toLowerCase();
        if (!q) return availableCategories;
        return availableCategories.filter((c) => c.toLowerCase().includes(q));
    }, [availableCategories, categoryQuery]);

    const filteredActivity = useMemo(() => {
        if (selectedCategories.length === 0) return filteredByType;
        const set = new Set(selectedCategories.map((c) => c.toLowerCase()));
        return filteredByType.filter((t) =>
            set.has((t.category || "").toLowerCase())
        );
    }, [filteredByType, selectedCategories]);

    const applyTransactionUpdate = (update: {
        id: string;
        amount?: number;
        type?: string;
        category?: string | null;
        description?: string | null;
        original_currency?: string;
        date?: string | null;
    }) => {
        setTransactions((prev) => {
            const existing = prev.find((t) => t.id === update.id);
            if (!existing) return prev;
            const next = prev.map((t) =>
                t.id === update.id
                    ? {
                        ...t,
                        ...update,
                        amount:
                            typeof update.amount === "number"
                                ? update.amount
                                : t.amount,
                    }
                    : t
            );
            const nextAmount =
                typeof update.amount === "number" ? update.amount : existing.amount;
            const delta = nextAmount - existing.amount;
            if (delta !== 0) {
                setVaults((vaultPrev) =>
                    vaultPrev.map((v) =>
                        v.id === existing.vault_id
                            ? { ...v, balance: v.balance + delta }
                            : v
                    )
                );
            }
            return next;
        });
    };

    const applyTransactionDelete = (id: string) => {
        setTransactions((prev) => {
            const existing = prev.find((t) => t.id === id);
            if (!existing) return prev;
            setVaults((vaultPrev) =>
                vaultPrev.map((v) =>
                    v.id === existing.vault_id
                        ? { ...v, balance: v.balance - existing.amount }
                        : v
                )
            );
            return prev.filter((t) => t.id !== id);
        });
    };

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const hasMoreActivity = activityVisibleCount < filteredActivity.length;

    const onLoadMoreActivity = () => {
        if (!hasMoreActivity || isLoadingMoreActivity) return;
        setIsLoadingMoreActivity(true);
        const next = Math.min(
            activityVisibleCount + ACTIVITY_PAGE_SIZE,
            filteredActivity.length
        );
        requestAnimationFrame(() => {
            setActivityVisibleCount(next);
            setIsLoadingMoreActivity(false);
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
                        <div className="relative">
                            <button
                                type="button"
                                aria-label="Filtrar por categoría"
                                onClick={() =>
                                    setCategoryFilterOpen((v) => !v)
                                }
                                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                            >
                                <Tag size={14} className="text-zinc-500" />
                                {selectedCategories.length > 0
                                    ? `Categorías (${selectedCategories.length})`
                                    : "Categorías"}
                            </button>

                            {categoryFilterOpen && (
                                <div className="absolute right-0 z-20 mt-2 w-[260px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
                                    <div className="border-b border-zinc-100 p-3 space-y-2">
                                        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                                            <MagnifyingGlass
                                                size={14}
                                                className="text-zinc-400"
                                            />
                                            <input
                                                value={categoryQuery}
                                                onChange={(e) =>
                                                    setCategoryQuery(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Buscar…"
                                                className="w-full bg-transparent text-sm text-zinc-900 outline-none"
                                            />
                                        </div>
                                        {selectedCategories.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCategories([]);
                                                    setCategoryQuery("");
                                                }}
                                                className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                                            >
                                                Limpiar filtro
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-60 overflow-auto p-1">
                                        {filteredCategories.length === 0 ? (
                                            <div className="px-3 py-4 text-center text-sm text-zinc-400">
                                                Sin resultados.
                                            </div>
                                        ) : (
                                            filteredCategories.map((c) => {
                                                const active =
                                                    selectedCategories
                                                        .map((x) =>
                                                            x.toLowerCase()
                                                        )
                                                        .includes(
                                                            c.toLowerCase()
                                                        );
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedCategories(
                                                                (prev) => {
                                                                    const exists =
                                                                        prev
                                                                            .map(
                                                                                (
                                                                                    x
                                                                                ) =>
                                                                                    x.toLowerCase()
                                                                            )
                                                                            .includes(
                                                                                c.toLowerCase()
                                                                            );
                                                                    if (exists)
                                                                        return prev.filter(
                                                                            (x) =>
                                                                                x.toLowerCase() !==
                                                                                c.toLowerCase()
                                                                        );
                                                                    return [
                                                                        ...prev,
                                                                        c,
                                                                    ];
                                                                }
                                                            );
                                                        }}
                                                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${active
                                                            ? "bg-zinc-900 text-white"
                                                            : "text-zinc-700 hover:bg-zinc-50"
                                                            }`}
                                                    >
                                                        {c}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
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
                        {activityError ? (
                            <div className="px-5 py-8 text-center text-sm text-zinc-400">
                                {activityError}
                            </div>
                        ) : filteredActivity.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm text-zinc-400">
                                No transactions found.
                            </div>
                        ) : (
                            filteredActivity
                                .slice(0, activityVisibleCount)
                                .map((item) => {
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

                {!activityError && filteredActivity.length > 0 && (
                    <div className="mt-4 flex justify-center">
                        {hasMoreActivity ? (
                            <button
                                type="button"
                                onClick={onLoadMoreActivity}
                                disabled={isLoadingMoreActivity}
                                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isLoadingMoreActivity
                                    ? "Cargando..."
                                    : "Ver más movimientos"}
                            </button>
                        ) : (
                            <span className="text-sm text-zinc-400">
                                No hay más movimientos.
                            </span>
                        )}
                    </div>
                )}
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
            <TransactionEditModal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                onUpdated={(tx) => {
                    applyTransactionUpdate(tx);
                    setSelectedTx((prev) => (prev && prev.id === tx.id ? { ...prev, ...tx } : prev));
                }}
                onDeleted={(id) => {
                    applyTransactionDelete(id);
                    setSelectedTx(null);
                }}
                transaction={selectedTx}
            />
        </div>
    );
}
