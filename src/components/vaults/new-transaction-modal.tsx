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
    const [includeFee, setIncludeFee] = useState(false);
    const [fee, setFee] = useState("");
    
    // Custom Rate state
    const [useCustomRate, setUseCustomRate] = useState(false);
    const [customRateMode, setCustomRateMode] = useState<"auto" | "manual">("auto");
    const [customRateVal, setCustomRateVal] = useState("");
    const [customRateDirection, setCustomRateDirection] = useState<"from_to" | "to_from">("from_to");
    const [equivalentAmount, setEquivalentAmount] = useState("");

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
            "Sport",
            "Entertainment",
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

    const officialRate = getActiveRate();

    const transferBreakdown = useMemo(() => {
        if (!selectedVault || !transferToVault || selectedVault.currency === transferToVault.currency || !amount) return null;
        const sVal = parseFloat(amount) || 0;
        if (sVal <= 0) return null;

        const offRate = officialRate; // USD -> EUR

        // Calculate received amount using official rate
        const officialReceived = convertBetween(sVal, selectedVault.currency, transferToVault.currency);

        let finalRate = offRate;
        let finalReceived = officialReceived;

        if (useCustomRate) {
            if (customRateMode === "auto") {
                const rVal = parseFloat(equivalentAmount) || 0;
                if (rVal > 0) {
                    finalReceived = rVal;
                    // rate USD -> EUR
                    if (selectedVault.currency === "EUR" && transferToVault.currency === "USD") {
                        // S (EUR) / R (USD)
                        finalRate = sVal / rVal;
                    } else {
                        // R (EUR) / S (USD)
                        finalRate = rVal / sVal;
                    }
                }
            } else {
                const manualVal = parseFloat(customRateVal) || 0;
                if (manualVal > 0) {
                    if (selectedVault.currency === "EUR" && transferToVault.currency === "USD") {
                        if (customRateDirection === "from_to") {
                            // 1 EUR = X USD => R = S * X
                            finalReceived = sVal * manualVal;
                            finalRate = 1 / manualVal;
                        } else {
                            // 1 USD = Y EUR => R = S / Y
                            finalReceived = sVal / manualVal;
                            finalRate = manualVal;
                        }
                    } else {
                        // From USD to EUR
                        if (customRateDirection === "from_to") {
                            // 1 USD = X EUR => R = S * X
                            finalReceived = sVal * manualVal;
                            finalRate = manualVal;
                        } else {
                            // 1 EUR = Y USD => R = S / Y
                            finalReceived = sVal / manualVal;
                            finalRate = 1 / manualVal;
                        }
                    }
                }
            }
        }

        // Compare received amounts
        const diffDest = finalReceived - officialReceived;
        // Convert difference to source currency at official rate
        let diffSource = 0;
        if (selectedVault.currency === "EUR" && transferToVault.currency === "USD") {
            // diffDest is in USD. USD -> EUR: multiply by offRate
            diffSource = diffDest * offRate;
        } else {
            // diffDest is in EUR. EUR -> USD: divide by offRate
            diffSource = diffDest / offRate;
        }

        const tFee = includeFee ? (parseFloat(fee) || 0) : 0;
        const lossInSource = diffSource < 0 ? -diffSource : 0;
        const totalCost = tFee + lossInSource;

        return {
            officialRate: offRate,
            appliedRate: finalRate,
            officialReceived,
            appliedReceived: finalReceived,
            differenceDest: diffDest,
            differenceSource: diffSource,
            fee: tFee,
            totalCost,
            lossInSource,
        };
    }, [
        selectedVault,
        transferToVault,
        amount,
        useCustomRate,
        customRateMode,
        equivalentAmount,
        customRateVal,
        customRateDirection,
        includeFee,
        fee,
        officialRate
    ]);

    const txBreakdown = useMemo(() => {
        if (txType === "transfer" || txType === "mixed" || !selectedVault || !amount) return null;
        const amountVal = parseFloat(amount) || 0;
        if (amountVal <= 0) return null;

        const offRate = officialRate; // USD -> EUR
        const oppositeCurrency = selectedVault.currency === "EUR" ? "USD" : "EUR";
        const officialEquivalent = convertBetween(amountVal, selectedVault.currency, oppositeCurrency);

        let finalRate = offRate;
        let finalEquivalent = officialEquivalent;

        if (useCustomRate) {
            if (customRateMode === "auto") {
                const eqVal = parseFloat(equivalentAmount) || 0;
                if (eqVal > 0) {
                    finalEquivalent = eqVal;
                    if (selectedVault.currency === "EUR") {
                        // EUR -> USD. amountVal / finalEquivalent
                        finalRate = amountVal / eqVal;
                    } else {
                        // USD -> EUR. finalEquivalent / amountVal
                        finalRate = eqVal / amountVal;
                    }
                }
            } else {
                const manualVal = parseFloat(customRateVal) || 0;
                if (manualVal > 0) {
                    if (selectedVault.currency === "EUR") {
                        if (customRateDirection === "from_to") {
                            // 1 EUR = X USD
                            finalEquivalent = amountVal * manualVal;
                            finalRate = 1 / manualVal;
                        } else {
                            // 1 USD = Y EUR
                            finalEquivalent = amountVal / manualVal;
                            finalRate = manualVal;
                        }
                    } else {
                        // Vault is USD
                        if (customRateDirection === "from_to") {
                            // 1 USD = X EUR
                            finalEquivalent = amountVal * manualVal;
                            finalRate = manualVal;
                        } else {
                            // 1 EUR = Y USD
                            finalEquivalent = amountVal / manualVal;
                            finalRate = 1 / manualVal;
                        }
                    }
                }
            }
        }

        // Compare equivalents
        const diffOpposite = finalEquivalent - officialEquivalent;
        // Convert difference to vault's currency using official rate
        let diffVault = 0;
        if (selectedVault.currency === "EUR") {
            // diffOpposite is in USD. USD -> EUR: multiply by offRate
            diffVault = diffOpposite * offRate;
        } else {
            // diffOpposite is in EUR. EUR -> USD: divide by offRate
            diffVault = diffOpposite / offRate;
        }

        return {
            officialRate: offRate,
            appliedRate: finalRate,
            officialEquivalent,
            appliedEquivalent: finalEquivalent,
            differenceOpposite: diffOpposite,
            differenceVault: diffVault,
            oppositeCurrency,
        };
    }, [
        txType,
        selectedVault,
        amount,
        useCustomRate,
        customRateMode,
        equivalentAmount,
        customRateVal,
        customRateDirection,
        officialRate
    ]);

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

        const storedExchangeRate = useCustomRate && txBreakdown
            ? txBreakdown.appliedRate
            : null;

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
                exchange_rate_at_time: storedExchangeRate,
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

        const transferFee = includeFee ? (parseFloat(fee) || 0) : 0;
        if (includeFee && transferFee < 0) {
            setError("Enter a valid commission amount.");
            setIsLoading(false);
            return;
        }

        const receivedAmount = useCustomRate && transferBreakdown
            ? transferBreakdown.appliedReceived
            : convertBetween(
                transferAmount,
                fromVault.currency,
                toVault.currency
            );

        const storedExchangeRate = useCustomRate && transferBreakdown
            ? transferBreakdown.appliedRate
            : null;

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
                    amount: -(transferAmount + transferFee),
                    type: "transfer",
                    original_currency: fromVault.currency,
                    category: null,
                    description: `[Transfer → ${toVault.name}] ${descText}`,
                    fee: transferFee,
                    exchange_rate_at_time: storedExchangeRate,
                },
                {
                    user_id: user.id,
                    vault_id: transferToVaultId,
                    amount: receivedAmount,
                    type: "transfer",
                    original_currency: toVault.currency,
                    category: null,
                    description: `[Transfer ← ${fromVault.name}] ${descText}`,
                    fee: 0,
                    exchange_rate_at_time: storedExchangeRate,
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

        const feeNote = transferFee > 0 ? ` (Commission: ${fromSymbol}${transferFee.toFixed(2)})` : "";

        resetForm();
        addToast(`Transfer completed${feeNote}${conversionNote}`);
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
        setIncludeFee(false);
        setFee("");
        setUseCustomRate(false);
        setCustomRateMode("auto");
        setCustomRateVal("");
        setCustomRateDirection("from_to");
        setEquivalentAmount("");
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

                                    {/* Commission/Fee Toggle & Input */}
                                    <div className="space-y-3 pt-1">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={includeFee}
                                                    onChange={(e) => setIncludeFee(e.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                                                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                                            </div>
                                            <span className="text-xs font-semibold text-zinc-600">
                                                Incluir comisión / tarifa bancaria
                                            </span>
                                        </label>

                                        {includeFee && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="space-y-2 overflow-hidden"
                                            >
                                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                    Monto de comisión
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
                                                        value={fee}
                                                        onChange={(e) => setFee(e.target.value)}
                                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Debit Summary Preview */}
                                    {((transferAmount > 0) || (includeFee && parseFloat(fee) > 0)) && (
                                        <div className="rounded-xl bg-zinc-50 border border-zinc-150 px-4 py-3.5 space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Monto a enviar:</span>
                                                <span className="font-semibold text-zinc-900">
                                                    {symbol}{transferAmount.toFixed(2)}
                                                </span>
                                            </div>
                                            {includeFee && parseFloat(fee) > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-400">Comisión:</span>
                                                    <span className="font-semibold text-zinc-900">
                                                        {symbol}{(parseFloat(fee) || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold text-sm">
                                                <span className="text-zinc-600">Total a descontar de {selectedVault?.name || 'origen'}:</span>
                                                <span className="text-zinc-900">
                                                    {symbol}{(transferAmount + (includeFee ? (parseFloat(fee) || 0) : 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Rate Toggle */}
                                    {selectedVault &&
                                        transferToVault &&
                                        selectedVault.currency !== transferToVault.currency && (
                                            <div className="space-y-3 pt-1 border-t border-zinc-100 mt-2">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={useCustomRate}
                                                            onChange={(e) => setUseCustomRate(e.target.checked)}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                                                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-zinc-600">
                                                        Usar tasa de cambio personalizada
                                                    </span>
                                                </label>

                                                {useCustomRate && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="space-y-3 overflow-hidden pl-1"
                                                    >
                                                        {/* Calculation Mode Tabs */}
                                                        <div className="flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 w-full">
                                                            <button
                                                                type="button"
                                                                onClick={() => setCustomRateMode("auto")}
                                                                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${customRateMode === "auto"
                                                                        ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                                                                        : "text-zinc-500 hover:text-zinc-700"
                                                                    }`}
                                                            >
                                                                Calcular automático
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setCustomRateMode("manual")}
                                                                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${customRateMode === "manual"
                                                                        ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                                                                        : "text-zinc-500 hover:text-zinc-700"
                                                                    }`}
                                                            >
                                                                Tasa manual
                                                            </button>
                                                        </div>

                                                        {customRateMode === "auto" ? (
                                                            <div className="space-y-1">
                                                                <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                                    Monto recibido en {transferToVault.name}
                                                                </label>
                                                                <div className="relative">
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                                                                        {CURRENCY_SYMBOLS[transferToVault.currency]}
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        placeholder="0.00"
                                                                        value={equivalentAmount}
                                                                        onChange={(e) => setEquivalentAmount(e.target.value)}
                                                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                                        Tasa de cambio aplicada
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCustomRateDirection(customRateDirection === "from_to" ? "to_from" : "from_to")}
                                                                        className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 underline underline-offset-2 decoration-dotted"
                                                                    >
                                                                        Cambiar dirección
                                                                    </button>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-bold text-zinc-500 whitespace-nowrap bg-zinc-100 px-2.5 py-2 rounded-lg border border-zinc-200">
                                                                        {customRateDirection === "from_to"
                                                                            ? `1 ${selectedVault.currency} =`
                                                                            : `1 ${transferToVault.currency} =`
                                                                        }
                                                                    </span>
                                                                    <div className="relative flex-1">
                                                                        <input
                                                                            type="number"
                                                                            step="0.0001"
                                                                            min="0"
                                                                            placeholder="0.0000"
                                                                            value={customRateVal}
                                                                            onChange={(e) => setCustomRateVal(e.target.value)}
                                                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                                                        />
                                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                                                                            {customRateDirection === "from_to" ? transferToVault.currency : selectedVault.currency}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Breakdown Box */}
                                                        {transferBreakdown && (
                                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2.5 text-xs text-zinc-600 transition-all">
                                                                <div className="flex justify-between">
                                                                    <span className="text-zinc-400 font-medium">Tasa oficial:</span>
                                                                    <span className="font-semibold text-zinc-800">
                                                                        1 {selectedVault.currency} = {convertBetween(1, selectedVault.currency, transferToVault.currency).toFixed(4)} {transferToVault.currency}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-zinc-400 font-medium">Tasa aplicada:</span>
                                                                    <span className="font-bold text-zinc-900">
                                                                        1 {selectedVault.currency} = {(transferBreakdown.appliedReceived / (parseFloat(amount) || 1)).toFixed(4)} {transferToVault.currency}
                                                                    </span>
                                                                </div>
                                                                {transferBreakdown.differenceDest !== 0 && (
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-zinc-400 font-medium">Diferencia vs oficial:</span>
                                                                        <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${transferBreakdown.differenceDest < 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                                                            {transferBreakdown.differenceDest < 0 ? '-' : '+'}
                                                                            {CURRENCY_SYMBOLS[transferToVault.currency]}{Math.abs(transferBreakdown.differenceDest).toFixed(2)}
                                                                            {transferBreakdown.differenceDest < 0 ? ' (Pérdida)' : ' (Ganancia)'}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {includeFee && (parseFloat(fee) || 0) > 0 && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-zinc-400 font-medium">Comisión:</span>
                                                                        <span className="font-semibold text-zinc-800">
                                                                            {CURRENCY_SYMBOLS[selectedVault.currency]}{(parseFloat(fee) || 0).toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {transferBreakdown.lossInSource > 0 && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-zinc-400 font-medium">Pérdida por tipo de cambio:</span>
                                                                        <span className="font-semibold text-amber-600">
                                                                            {CURRENCY_SYMBOLS[selectedVault.currency]}{transferBreakdown.lossInSource.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold text-sm">
                                                                    <span className="text-zinc-700">Costo total operación:</span>
                                                                    <span className="text-zinc-900">
                                                                        {CURRENCY_SYMBOLS[selectedVault.currency]}{transferBreakdown.totalCost.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </div>
                                        )}

                                    {/* Conversion preview */}
                                    {!useCustomRate &&
                                        transferAmount > 0 &&
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
                                    {/* Custom Rate Toggle for Income/Expense */}
                                    {selectedVault && (
                                        <div className="space-y-3 pt-1">
                                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={useCustomRate}
                                                        onChange={(e) => setUseCustomRate(e.target.checked)}
                                                        className="peer sr-only"
                                                    />
                                                    <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                                                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                                                </div>
                                                <span className="text-xs font-semibold text-zinc-600">
                                                    Usar tasa de cambio personalizada
                                                </span>
                                            </label>

                                            {useCustomRate && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="space-y-3 overflow-hidden pl-1"
                                                >
                                                    {/* Calculation Mode Tabs */}
                                                    <div className="flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 w-full">
                                                        <button
                                                            type="button"
                                                            onClick={() => setCustomRateMode("auto")}
                                                            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${customRateMode === "auto"
                                                                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                                                                    : "text-zinc-500 hover:text-zinc-700"
                                                                }`}
                                                        >
                                                            Monto equivalente
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCustomRateMode("manual")}
                                                            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${customRateMode === "manual"
                                                                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                                                                    : "text-zinc-500 hover:text-zinc-700"
                                                                }`}
                                                        >
                                                            Tasa manual
                                                        </button>
                                                    </div>

                                                    {customRateMode === "auto" ? (
                                                        <div className="space-y-1">
                                                            <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                                Monto equivalente en {selectedVault.currency === "EUR" ? "USD" : "EUR"}
                                                            </label>
                                                            <div className="relative">
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                                                                    {CURRENCY_SYMBOLS[selectedVault.currency === "EUR" ? "USD" : "EUR"]}
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    placeholder="0.00"
                                                                    value={equivalentAmount}
                                                                    onChange={(e) => setEquivalentAmount(e.target.value)}
                                                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                                                    Tasa de cambio aplicada
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCustomRateDirection(customRateDirection === "from_to" ? "to_from" : "from_to")}
                                                                    className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 underline underline-offset-2 decoration-dotted"
                                                                >
                                                                    Cambiar dirección
                                                                </button>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-zinc-500 whitespace-nowrap bg-zinc-100 px-2.5 py-2 rounded-lg border border-zinc-200">
                                                                    {customRateDirection === "from_to"
                                                                        ? `1 ${selectedVault.currency} =`
                                                                        : `1 ${selectedVault.currency === "EUR" ? "USD" : "EUR"} =`
                                                                    }
                                                                </span>
                                                                <div className="relative flex-1">
                                                                    <input
                                                                        type="number"
                                                                        step="0.0001"
                                                                        min="0"
                                                                        placeholder="0.0000"
                                                                        value={customRateVal}
                                                                        onChange={(e) => setCustomRateVal(e.target.value)}
                                                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                                                    />
                                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                                                                        {customRateDirection === "from_to"
                                                                            ? (selectedVault.currency === "EUR" ? "USD" : "EUR")
                                                                            : selectedVault.currency
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Comparison Breakdown Box */}
                                                    {txBreakdown && (
                                                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2.5 text-xs text-zinc-600 transition-all">
                                                            <div className="flex justify-between">
                                                                <span className="text-zinc-400 font-medium">Tasa oficial:</span>
                                                                <span className="font-semibold text-zinc-800">
                                                                    1 {selectedVault.currency} = {convertBetween(1, selectedVault.currency, txBreakdown.oppositeCurrency).toFixed(4)} {txBreakdown.oppositeCurrency}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-zinc-400 font-medium">Tasa aplicada:</span>
                                                                <span className="font-bold text-zinc-900">
                                                                    1 {selectedVault.currency} = {(txBreakdown.appliedEquivalent / (parseFloat(amount) || 1)).toFixed(4)} {txBreakdown.oppositeCurrency}
                                                                </span>
                                                            </div>
                                                            {txBreakdown.differenceOpposite !== 0 && (
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-zinc-400 font-medium">Diferencia vs oficial:</span>
                                                                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${txBreakdown.differenceOpposite < 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                                                        {txBreakdown.differenceOpposite < 0 ? '-' : '+'}
                                                                        {CURRENCY_SYMBOLS[txBreakdown.oppositeCurrency]}{Math.abs(txBreakdown.differenceOpposite).toFixed(2)}
                                                                        {txBreakdown.differenceOpposite < 0 ? ' (Pérdida)' : ' (Ganancia)'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
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
