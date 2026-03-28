"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    ArrowsLeftRight,
    ArrowRight,
    Plus,
    Trash,
    GitMerge,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import type { Currency } from "@/types";

interface Vault {
    id: string;
    name: string;
    currency: string;
    balance?: number;
}

interface MixedEntry {
    vaultId: string;
    amount: string;
}

interface NewTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    vaults: Vault[];
}

export function NewTransactionModal({
    isOpen,
    onClose,
    onCreated,
    vaults,
}: NewTransactionModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const { getActiveRate } = useCurrencyStore();

    const [txType, setTxType] = useState<
        "income" | "expense" | "transfer" | "mixed"
    >("expense");
    const [vaultId, setVaultId] = useState(vaults[0]?.id || "");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dbCategories, setDbCategories] = useState<string[]>([]);

    // Transfer state
    const [transferToVaultId, setTransferToVaultId] = useState(
        vaults[1]?.id || vaults[0]?.id || ""
    );

    // Mixed transaction state
    const [mixedCurrency, setMixedCurrency] = useState<Currency>("EUR");
    const [mixedEntries, setMixedEntries] = useState<MixedEntry[]>([
        { vaultId: vaults[0]?.id || "", amount: "" },
        { vaultId: vaults[1]?.id || vaults[0]?.id || "", amount: "" },
    ]);

    const selectedVault = vaults.find((v) => v.id === vaultId);
    const transferToVault = vaults.find((v) => v.id === transferToVaultId);
    const symbol = selectedVault
        ? CURRENCY_SYMBOLS[selectedVault.currency] || "$"
        : "$";

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const { data, error } = await supabase
                .from("transaction_categories")
                .select("name,is_active")
                .eq("user_id", user.id)
                .order("name", { ascending: true });
            if (cancelled) return;
            if (error || !data) return;
            const next = (data as { name: string; is_active: boolean }[])
                .filter((r) => r.is_active)
                .map((r) => r.name);
            setDbCategories(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, supabase]);

    const categories = useMemo(() => {
        if (txType === "income")
            return ["Freelance", "Salary", "Investment", "Other"];
        if (dbCategories.length > 0) return dbCategories;
        return [
            "Housing",
            "Food",
            "Transport",
            "Tech",
            "Technology",
            "Travel",
            "Health",
            "Wellness",
            "Books",
            "Tickets",
            "Shopping",
            "Clothing",
            "Video Games",
            "Snacks",
            "Accessories",
            "Home",
            "Other",
        ];
    }, [dbCategories, txType]);

    // --- Currency conversion helper ---
    function convertBetween(
        amount: number,
        from: string,
        to: string
    ): number {
        if (from === to) return amount;
        const rate = getActiveRate(); // USD → EUR
        if (from === "USD" && to === "EUR") return amount * rate;
        if (from === "EUR" && to === "USD") return amount / rate;
        return amount;
    }

    // --- Mixed total with conversion ---
    const mixedSymbol = CURRENCY_SYMBOLS[mixedCurrency] || "€";
    const mixedTotal = mixedEntries.reduce((sum, entry) => {
        const entryVault = vaults.find((v) => v.id === entry.vaultId);
        const entryAmount = parseFloat(entry.amount) || 0;
        if (!entryVault || entryAmount <= 0) return sum;
        return sum + convertBetween(entryAmount, entryVault.currency, mixedCurrency);
    }, 0);

    // --- Transfer preview ---
    const transferAmount = parseFloat(amount) || 0;
    const transferReceiveAmount =
        selectedVault && transferToVault && transferAmount > 0
            ? convertBetween(
                transferAmount,
                selectedVault.currency,
                transferToVault.currency
            )
            : 0;

    const addMixedEntry = () => {
        const usedIds = mixedEntries.map((e) => e.vaultId);
        const available = vaults.find((v) => !usedIds.includes(v.id));
        setMixedEntries([
            ...mixedEntries,
            {
                vaultId: available?.id || vaults[0]?.id || "",
                amount: "",
            },
        ]);
    };

    const removeMixedEntry = (index: number) => {
        if (mixedEntries.length <= 2) return;
        setMixedEntries(mixedEntries.filter((_, i) => i !== index));
    };

    const updateMixedEntry = (
        index: number,
        field: "vaultId" | "amount",
        value: string
    ) => {
        const updated = [...mixedEntries];
        updated[index] = { ...updated[index], [field]: value };
        setMixedEntries(updated);
    };

    // --- Submit handlers ---
    const handleSubmit = async () => {
        if (txType === "mixed") return handleMixedSubmit();
        if (txType === "transfer") return handleTransferSubmit();

        if (!amount || parseFloat(amount) <= 0) {
            setError("Enter a valid amount.");
            return;
        }
        if (!vaultId) {
            setError("Select a vault.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error: insertError } = await supabase
            .from("transactions")
            .insert({
                user_id: user.id,
                vault_id: vaultId,
                amount:
                    txType === "expense"
                        ? -parseFloat(amount)
                        : parseFloat(amount),
                type: txType,
                original_currency: selectedVault?.currency || "EUR",
                category: category || null,
                description: description || null,
            });

        if (insertError) {
            setError(insertError.message);
            addToast(insertError.message, "error");
            setIsLoading(false);
            return;
        }

        resetForm();
        addToast("Transaction added");
        onCreated();
        onClose();
    };

    const handleTransferSubmit = async () => {
        if (!amount || transferAmount <= 0) {
            setError("Enter a valid amount.");
            return;
        }
        if (!vaultId || !transferToVaultId) {
            setError("Select both source and destination vaults.");
            return;
        }
        if (vaultId === transferToVaultId) {
            setError("Source and destination must be different.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const fromVault = vaults.find((v) => v.id === vaultId);
        const toVault = vaults.find((v) => v.id === transferToVaultId);
        if (!fromVault || !toVault) return;

        const receivedAmount = convertBetween(
            transferAmount,
            fromVault.currency,
            toVault.currency
        );

        const fromSymbol = CURRENCY_SYMBOLS[fromVault.currency] || "$";
        const toSymbol = CURRENCY_SYMBOLS[toVault.currency] || "$";
        const descText =
            description?.trim() ||
            `Transfer ${fromVault.name} → ${toVault.name}`;

        // Insert 2 transactions: expense from source, income to destination
        const { error: insertError } = await supabase
            .from("transactions")
            .insert([
                {
                    user_id: user.id,
                    vault_id: vaultId,
                    amount: -transferAmount,
                    type: "transfer",
                    original_currency: fromVault.currency,
                    category: category || "Transfer",
                    description: `[Transfer → ${toVault.name}] ${descText}`,
                },
                {
                    user_id: user.id,
                    vault_id: transferToVaultId,
                    amount: receivedAmount,
                    type: "transfer",
                    original_currency: toVault.currency,
                    category: category || "Transfer",
                    description: `[Transfer ← ${fromVault.name}] ${descText}`,
                },
            ]);

        if (insertError) {
            setError(insertError.message);
            addToast(insertError.message, "error");
            setIsLoading(false);
            return;
        }

        const conversionNote =
            fromVault.currency !== toVault.currency
                ? ` (${fromSymbol}${transferAmount.toFixed(2)} → ${toSymbol}${receivedAmount.toFixed(2)})`
                : "";

        resetForm();
        addToast(`Transfer completed${conversionNote}`);
        onCreated();
        onClose();
    };

    const handleMixedSubmit = async () => {
        const validEntries = mixedEntries.filter(
            (e) => e.vaultId && parseFloat(e.amount) > 0
        );
        if (validEntries.length < 2) {
            setError("Add amounts for at least 2 vaults.");
            return;
        }
        if (!description.trim()) {
            setError("Add a description for the mixed payment.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const rows = validEntries.map((entry) => {
            const vault = vaults.find((v) => v.id === entry.vaultId);
            return {
                user_id: user.id,
                vault_id: entry.vaultId,
                amount: -parseFloat(entry.amount),
                type: "expense" as const,
                original_currency: vault?.currency || "EUR",
                category: category || null,
                description: `[Mixed] ${description.trim()}`,
            };
        });

        const { error: insertError } = await supabase
            .from("transactions")
            .insert(rows);

        if (insertError) {
            setError(insertError.message);
            addToast(insertError.message, "error");
            setIsLoading(false);
            return;
        }

        resetForm();
        addToast(
            `Mixed payment: ${mixedSymbol}${mixedTotal.toFixed(2)} from ${validEntries.length} vaults`
        );
        onCreated();
        onClose();
    };

    const resetForm = () => {
        setAmount("");
        setDescription("");
        setCategory("");
        setIsLoading(false);
        setMixedEntries([
            { vaultId: vaults[0]?.id || "", amount: "" },
            { vaultId: vaults[1]?.id || vaults[0]?.id || "", amount: "" },
        ]);
    };

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
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                        }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-zinc-900">
                                New Transaction
                            </h2>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Type Tabs */}
                        <div className="mt-5 flex rounded-xl border border-zinc-200 p-0.5">
                            {(
                                [
                                    {
                                        value: "expense" as const,
                                        label: "Expense",
                                    },
                                    {
                                        value: "income" as const,
                                        label: "Income",
                                    },
                                    {
                                        value: "transfer" as const,
                                        label: "Transfer",
                                        icon: ArrowsLeftRight,
                                    },
                                    {
                                        value: "mixed" as const,
                                        label: "Mixed",
                                        icon: GitMerge,
                                    },
                                ] as const
                            ).map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTxType(t.value)}
                                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold transition-all ${txType === t.value
                                            ? "bg-zinc-900 text-white"
                                            : "text-zinc-500 hover:text-zinc-700"
                                        }`}
                                >
                                    {"icon" in t && t.icon && (
                                        <t.icon size={13} />
                                    )}
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Form */}
                        <div className="mt-5 space-y-4">
                            {/* ===== TRANSFER MODE ===== */}
                            {txType === "transfer" ? (
                                <>
                                    {/* From vault */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            From
                                        </label>
                                        <select
                                            value={vaultId}
                                            onChange={(e) =>
                                                setVaultId(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors appearance-none"
                                        >
                                            {vaults.map((v) => (
                                                <option
                                                    key={v.id}
                                                    value={v.id}
                                                >
                                                    {v.name} (
                                                    {
                                                        CURRENCY_SYMBOLS[
                                                        v.currency
                                                        ]
                                                    }
                                                    {v.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Arrow */}
                                    <div className="flex justify-center">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100">
                                            <ArrowRight
                                                size={14}
                                                weight="bold"
                                                className="text-zinc-400 rotate-90"
                                            />
                                        </div>
                                    </div>

                                    {/* To vault */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            To
                                        </label>
                                        <select
                                            value={transferToVaultId}
                                            onChange={(e) =>
                                                setTransferToVaultId(
                                                    e.target.value
                                                )
                                            }
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors appearance-none"
                                        >
                                            {vaults
                                                .filter(
                                                    (v) => v.id !== vaultId
                                                )
                                                .map((v) => (
                                                    <option
                                                        key={v.id}
                                                        value={v.id}
                                                    >
                                                        {v.name} (
                                                        {
                                                            CURRENCY_SYMBOLS[
                                                            v.currency
                                                            ]
                                                        }
                                                        {v.currency})
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    {/* Amount */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Amount to send
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                                                {symbol}
                                            </span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={(e) =>
                                                    setAmount(e.target.value)
                                                }
                                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Conversion preview */}
                                    {transferAmount > 0 &&
                                        selectedVault &&
                                        transferToVault &&
                                        selectedVault.currency !==
                                        transferToVault.currency && (
                                            <div className="rounded-xl bg-zinc-50 px-4 py-3 space-y-1">
                                                <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-400">
                                                    Conversion Preview
                                                </p>
                                                <p className="text-sm font-semibold text-zinc-900">
                                                    {
                                                        CURRENCY_SYMBOLS[
                                                        selectedVault
                                                            .currency
                                                        ]
                                                    }
                                                    {transferAmount.toFixed(2)}{" "}
                                                    →{" "}
                                                    {
                                                        CURRENCY_SYMBOLS[
                                                        transferToVault
                                                            .currency
                                                        ]
                                                    }
                                                    {transferReceiveAmount.toFixed(
                                                        2
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-zinc-400">
                                                    Rate: 1{" "}
                                                    {selectedVault.currency} ={" "}
                                                    {convertBetween(
                                                        1,
                                                        selectedVault.currency,
                                                        transferToVault.currency
                                                    ).toFixed(4)}{" "}
                                                    {transferToVault.currency}
                                                </p>
                                            </div>
                                        )}
                                </>
                            ) : txType === "mixed" ? (
                                /* ===== MIXED MODE ===== */
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Vaults & Amounts
                                        </label>
                                        {/* Mixed currency selector */}
                                        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-0.5">
                                            {(["EUR", "USD"] as Currency[]).map(
                                                (cur) => (
                                                    <button
                                                        key={cur}
                                                        type="button"
                                                        onClick={() =>
                                                            setMixedCurrency(
                                                                cur
                                                            )
                                                        }
                                                        className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${mixedCurrency ===
                                                                cur
                                                                ? "bg-zinc-900 text-white"
                                                                : "text-zinc-400 hover:text-zinc-600"
                                                            }`}
                                                    >
                                                        {CURRENCY_SYMBOLS[cur]}{" "}
                                                        {cur}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {mixedEntries.map((entry, idx) => {
                                        const entryVault = vaults.find(
                                            (v) => v.id === entry.vaultId
                                        );
                                        const entrySymbol = entryVault
                                            ? CURRENCY_SYMBOLS[
                                            entryVault.currency
                                            ] || "$"
                                            : "$";
                                        const entryAmount =
                                            parseFloat(entry.amount) || 0;
                                        const entryConverted =
                                            entryVault && entryAmount > 0
                                                ? convertBetween(
                                                    entryAmount,
                                                    entryVault.currency,
                                                    mixedCurrency
                                                )
                                                : 0;
                                        const needsConversion =
                                            entryVault &&
                                            entryVault.currency !==
                                            mixedCurrency &&
                                            entryAmount > 0;

                                        return (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={entry.vaultId}
                                                        onChange={(e) =>
                                                            updateMixedEntry(
                                                                idx,
                                                                "vaultId",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors appearance-none"
                                                    >
                                                        {vaults.map((v) => (
                                                            <option
                                                                key={v.id}
                                                                value={v.id}
                                                            >
                                                                {v.name} (
                                                                {
                                                                    CURRENCY_SYMBOLS[
                                                                    v
                                                                        .currency
                                                                    ]
                                                                }
                                                                )
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="relative w-28">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                                                            {entrySymbol}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            placeholder="0.00"
                                                            value={
                                                                entry.amount
                                                            }
                                                            onChange={(e) =>
                                                                updateMixedEntry(
                                                                    idx,
                                                                    "amount",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-7 pr-2 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                                        />
                                                    </div>
                                                    {mixedEntries.length >
                                                        2 && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    removeMixedEntry(
                                                                        idx
                                                                    )
                                                                }
                                                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500"
                                                            >
                                                                <Trash
                                                                    size={14}
                                                                />
                                                            </button>
                                                        )}
                                                </div>
                                                {/* Show conversion hint */}
                                                {needsConversion && (
                                                    <p className="pl-1 text-[10px] text-zinc-400">
                                                        ≈{" "}
                                                        {
                                                            CURRENCY_SYMBOLS[
                                                            mixedCurrency
                                                            ]
                                                        }
                                                        {entryConverted.toFixed(
                                                            2
                                                        )}{" "}
                                                        at current rate
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add vault button */}
                                    {mixedEntries.length < vaults.length && (
                                        <button
                                            type="button"
                                            onClick={addMixedEntry}
                                            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-200 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600"
                                        >
                                            <Plus size={12} weight="bold" />
                                            Add Vault
                                        </button>
                                    )}

                                    {/* Total */}
                                    <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-2.5">
                                        <span className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                                            Total ({mixedCurrency})
                                        </span>
                                        <span className="text-sm font-bold text-zinc-900">
                                            {mixedSymbol}
                                            {mixedTotal.toLocaleString(
                                                "en-US",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                }
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* ===== INCOME / EXPENSE MODE ===== */
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Vault
                                        </label>
                                        <select
                                            value={vaultId}
                                            onChange={(e) =>
                                                setVaultId(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors appearance-none"
                                        >
                                            {vaults.map((v) => (
                                                <option
                                                    key={v.id}
                                                    value={v.id}
                                                >
                                                    {v.name} (
                                                    {
                                                        CURRENCY_SYMBOLS[
                                                        v.currency
                                                        ]
                                                    }
                                                    {v.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Amount
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                                                {symbol}
                                            </span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={(e) =>
                                                    setAmount(e.target.value)
                                                }
                                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Description
                                    {txType === "mixed" && (
                                        <span className="ml-1 normal-case tracking-normal text-red-400">
                                            *
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    placeholder={
                                        txType === "mixed"
                                            ? 'e.g. "Rent February"'
                                            : txType === "transfer"
                                                ? "e.g. Moving savings"
                                                : "e.g. Airbnb Lisbon"
                                    }
                                    value={description}
                                    onChange={(e) =>
                                        setDescription(e.target.value)
                                    }
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                            </div>

                            {/* Category Quick Select (hide for transfer) */}
                            {txType !== "transfer" && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                        Category
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() =>
                                                    setCategory(
                                                        category === cat
                                                            ? ""
                                                            : cat
                                                    )
                                                }
                                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${category === cat
                                                        ? "border-zinc-900 bg-zinc-900 text-white"
                                                        : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={
                                    isLoading ||
                                    (txType === "mixed"
                                        ? mixedEntries.filter(
                                            (e) =>
                                                parseFloat(e.amount) > 0
                                        ).length < 2
                                        : !amount ||
                                        parseFloat(amount) <= 0)
                                }
                                className="flex-1 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isLoading
                                    ? "Saving..."
                                    : txType === "mixed"
                                        ? "Add Mixed Payment"
                                        : txType === "transfer"
                                            ? "Transfer"
                                            : "Add Transaction"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
