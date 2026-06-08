"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowsLeftRight,
    ArrowDown,
    ArrowUp,
    CalendarBlank,
    CurrencyCircleDollar,
    MagnifyingGlass,
    Tag,
    Trash,
    Vault,
    Warning,
    X,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { useToastStore } from "@/stores/toast-store";
import { DEFAULT_TRANSACTION_CATEGORIES } from "@/lib/transaction-categories";
import { useCurrencyStore } from "@/stores/currency-store";

type Tx = {
    id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    original_currency: string;
    date: string | null;
    created_at: string;
    vault_name?: string;
    fee?: number | null;
    exchange_rate_at_time?: number | null;
};

type TxUpdate = Partial<
    Pick<Tx, "amount" | "type" | "category" | "description" | "original_currency" | "date" | "fee" | "exchange_rate_at_time">
> & { id: string };

interface TransactionEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: (tx: TxUpdate) => void;
    onDeleted?: (id: string) => void;
    transaction: Tx | null;
}

function normalizeCurrency(value: string): "EUR" | "USD" {
    return value === "EUR" || value === "USD" ? value : "USD";
}

function toDateInputValue(value: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function parseAmount(value: string) {
    const n = Number(String(value).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return n;
}

export function TransactionEditModal({
    isOpen,
    onClose,
    onUpdated,
    onDeleted,
    transaction,
}: TransactionEditModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const { getActiveRate } = useCurrencyStore();

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [date, setDate] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
    const [currency, setCurrency] = useState<"EUR" | "USD">("USD");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("");
    const [fee, setFee] = useState("");

    // Custom Rate state
    const [useCustomRate, setUseCustomRate] = useState(false);
    const [customRateMode, setCustomRateMode] = useState<"auto" | "manual">("auto");
    const [customRateVal, setCustomRateVal] = useState("");
    const [customRateDirection, setCustomRateDirection] = useState<"from_to" | "to_from">("from_to");
    const [equivalentAmount, setEquivalentAmount] = useState("");

    const [categoryOpen, setCategoryOpen] = useState(false);
    const [categoryQuery, setCategoryQuery] = useState("");
    const [categories, setCategories] = useState<string[]>([]);

    const symbol = CURRENCY_SYMBOLS[currency] || "$";

    const initialTransferSign = useMemo(() => {
        if (!transaction) return -1;
        return transaction.amount < 0 ? -1 : 1;
    }, [transaction]);

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

    const editBreakdown = useMemo(() => {
        if (!isOpen || !transaction) return null;
        const amountVal = parseAmount(amount) || 0;
        if (amountVal <= 0) return null;

        const offRate = getActiveRate(); // USD -> EUR
        const oppositeCurrency = currency === "EUR" ? "USD" : "EUR";

        let finalRate = offRate;
        let finalEquivalent = 0; // equivalent in opposite currency

        if (useCustomRate) {
            if (customRateMode === "auto") {
                const eqVal = parseAmount(equivalentAmount) || 0;
                if (eqVal > 0) {
                    finalEquivalent = eqVal;
                    if (currency === "EUR") {
                        finalRate = amountVal / eqVal;
                    } else {
                        finalRate = eqVal / amountVal;
                    }
                }
            } else {
                const manualVal = parseAmount(customRateVal) || 0;
                if (manualVal > 0) {
                    if (currency === "EUR") {
                        if (customRateDirection === "from_to") {
                            finalEquivalent = amountVal * manualVal;
                            finalRate = 1 / manualVal;
                        } else {
                            finalEquivalent = amountVal / manualVal;
                            finalRate = manualVal;
                        }
                    } else {
                        if (customRateDirection === "from_to") {
                            finalEquivalent = amountVal * manualVal;
                            finalRate = manualVal;
                        } else {
                            finalEquivalent = amountVal / manualVal;
                            finalRate = 1 / manualVal;
                        }
                    }
                }
            }
        } else {
            finalEquivalent = currency === "EUR" ? amountVal / offRate : amountVal * offRate;
        }

        if (type === "transfer") {
            const isSource = transaction.amount < 0;
            const cSent = isSource ? currency : oppositeCurrency;
            const cReceived = isSource ? oppositeCurrency : currency;

            const sVal = isSource ? amountVal : finalEquivalent;
            const rVal = isSource ? finalEquivalent : amountVal;

            const officialReceived = cSent === "USD" ? sVal * offRate : sVal / offRate;
            const diffReceived = rVal - officialReceived;
            const isGain = diffReceived > 0;

            const differenceDest = diffReceived;
            const differenceSource = cReceived === "USD" ? diffReceived * offRate : diffReceived / offRate;

            return {
                officialRate: offRate,
                appliedRate: finalRate,
                isTransfer: true,
                isGain,
                differenceDest,
                differenceSource,
                oppositeCurrency,
                appliedEquivalent: finalEquivalent,
            };
        } else {
            const officialEquivalent = currency === "EUR" ? amountVal / offRate : amountVal * offRate;
            const diffOpposite = finalEquivalent - officialEquivalent;
            const isGain = type === "expense" ? diffOpposite < 0 : diffOpposite > 0;

            return {
                officialRate: offRate,
                appliedRate: finalRate,
                isTransfer: false,
                isGain,
                differenceOpposite: diffOpposite,
                oppositeCurrency,
                appliedEquivalent: finalEquivalent,
            };
        }
    }, [
        isOpen,
        transaction,
        amount,
        currency,
        type,
        useCustomRate,
        customRateMode,
        equivalentAmount,
        customRateVal,
        customRateDirection,
        getActiveRate
    ]);

    useEffect(() => {
        if (!isOpen || !transaction) return;
        setSaveError(null);
        setConfirmDelete(false);
        setIsSaving(false);
        setIsDeleting(false);
        setDate(toDateInputValue(transaction.date || transaction.created_at));
        setDescription(transaction.description || "");
        setType(
            transaction.type === "income" || transaction.type === "transfer"
                ? (transaction.type as "income" | "transfer")
                : "expense"
        );
        setCurrency(normalizeCurrency(transaction.original_currency));
        
        const txFee = transaction.fee || 0;
        const txBaseAmount = transaction.type === "transfer" && transaction.amount < 0
            ? Math.abs(transaction.amount) - txFee
            : Math.abs(transaction.amount);

        setAmount(String(txBaseAmount));
        setFee(String(txFee));
        setCategory(transaction.category || "");
        setCategoryQuery("");
        setCategoryOpen(false);

        const txRate = transaction.exchange_rate_at_time;
        if (txRate && txRate > 0) {
            setUseCustomRate(true);
            setCustomRateMode("manual");
            setCustomRateDirection("from_to");
            if (transaction.original_currency === "EUR") {
                setCustomRateVal(String(Number((1 / txRate).toFixed(4))));
                setEquivalentAmount(String(Number((txBaseAmount / txRate).toFixed(2))));
            } else {
                setCustomRateVal(String(Number(txRate.toFixed(4))));
                setEquivalentAmount(String(Number((txBaseAmount * txRate).toFixed(2))));
            }
        } else {
            setUseCustomRate(false);
            setCustomRateMode("auto");
            setCustomRateDirection("from_to");
            setCustomRateVal("");
            setEquivalentAmount("");
        }
    }, [isOpen, transaction]);

    useEffect(() => {
        if (!isOpen) return;
        if (type === "transfer") {
            setCategory("");
            setCategoryOpen(false);
            setCategoryQuery("");
        }
    }, [isOpen, type]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                if (!cancelled) {
                    setCategories(
                        DEFAULT_TRANSACTION_CATEGORIES.filter((c) => c.isActive).map(
                            (c) => c.name
                        )
                    );
                }
                return;
            }
            const { data, error } = await supabase
                .from("transaction_categories")
                .select("name,is_active")
                .eq("user_id", user.id)
                .order("name", { ascending: true });
            if (cancelled) return;
            if (error || !data) {
                setCategories(
                    DEFAULT_TRANSACTION_CATEGORIES.filter((c) => c.isActive).map(
                        (c) => c.name
                    )
                );
                return;
            }
            setCategories(
                (data as { name: string; is_active: boolean }[])
                    .filter((r) => r.is_active)
                    .map((r) => r.name)
            );
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, supabase]);

    const validation = useMemo(() => {
        const errors: Record<string, string> = {};
        if (!date) errors.date = "Date is required.";
        const parsed = parseAmount(amount);
        if (parsed == null || parsed <= 0) errors.amount = "Enter a valid amount.";
        if (!currency) errors.currency = "Select a currency.";
        if (!type) errors.type = "Select a type.";

        if (type === "transfer" && transaction?.amount && transaction.amount < 0) {
            const parsedFee = parseAmount(fee);
            if (fee && (parsedFee == null || parsedFee < 0)) {
                errors.fee = "Enter a valid commission.";
            }
        }
        return errors;
    }, [amount, currency, date, type, fee, transaction]);

    const canSave = Object.keys(validation).length === 0 && !isSaving && !!transaction;

    const filteredCategories = useMemo(() => {
        const q = categoryQuery.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter((c) => c.toLowerCase().includes(q));
    }, [categories, categoryQuery]);

    const handleSave = async () => {
        if (!transaction) return;
        if (!canSave) {
            setSaveError(Object.values(validation)[0] || "Fix validation errors.");
            return;
        }

        setIsSaving(true);
        setSaveError(null);

        const parsedAmount = parseAmount(amount);
        if (parsedAmount == null) {
            setSaveError("Enter a valid amount.");
            setIsSaving(false);
            return;
        }

        const isSourceTransfer = type === "transfer" && transaction.amount < 0;
        const parsedFee = isSourceTransfer ? (parseAmount(fee) || 0) : 0;

        const signedAmount =
            type === "income"
                ? Math.abs(parsedAmount)
                : type === "expense"
                    ? -Math.abs(parsedAmount)
                    : initialTransferSign * (parsedAmount + parsedFee);

        const storedExchangeRate = useCustomRate && editBreakdown
            ? editBreakdown.appliedRate
            : null;

        const payload = {
            date: date || null,
            description: description.trim() || null,
            category: category.trim() || null,
            type,
            original_currency: currency,
            amount: signedAmount,
            fee: type === "transfer" ? parsedFee : 0,
            exchange_rate_at_time: storedExchangeRate,
        };

        const { data: updated, error } = await supabase
            .from("transactions")
            .update(payload)
            .eq("id", transaction.id)
            .select("id,amount,type,category,description,original_currency,date,created_at,fee,exchange_rate_at_time")
            .single();

        if (error) {
            setSaveError(error.message);
            addToast(error.message, "error");
            setIsSaving(false);
            return;
        }

        onUpdated({
            id: transaction.id,
            amount: Number((updated as Tx).amount),
            type: (updated as Tx).type,
            category: (updated as Tx).category,
            description: (updated as Tx).description,
            original_currency: (updated as Tx).original_currency,
            date: (updated as Tx).date,
            fee: (updated as Tx).fee,
            exchange_rate_at_time: (updated as Tx).exchange_rate_at_time,
        });

        addToast("Transaction updated");
        setIsSaving(false);
        onClose();
    };

    const handleDelete = async () => {
        if (!transaction) return;
        setIsDeleting(true);
        const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", transaction.id);
        if (error) {
            addToast(error.message, "error");
            setIsDeleting(false);
            return;
        }
        addToast("Transaction deleted");
        setIsDeleting(false);
        setConfirmDelete(false);
        onDeleted?.(transaction.id);
        onClose();
    };

    if (!transaction) return null;

    const isIncome = type === "income";
    const isTransfer = type === "transfer";

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            onClose();
                            setConfirmDelete(false);
                            setCategoryOpen(false);
                        }}
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
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${isIncome
                                            ? "bg-emerald-50"
                                            : isTransfer
                                                ? "bg-zinc-100"
                                                : "bg-red-50"
                                        }`}
                                >
                                    {isTransfer ? (
                                        <ArrowsLeftRight
                                            size={20}
                                            className="text-zinc-600"
                                        />
                                    ) : isIncome ? (
                                        <ArrowDown
                                            size={20}
                                            className="text-emerald-600"
                                        />
                                    ) : (
                                        <ArrowUp
                                            size={20}
                                            className="text-red-500"
                                        />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-zinc-900">
                                        Edit Movement
                                    </h2>
                                    <p className="text-[11px] text-zinc-400 capitalize">
                                        {transaction.vault_name || "—"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    setConfirmDelete(false);
                                    setCategoryOpen(false);
                                }}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-auto px-6 py-5 space-y-4">
                            {saveError && (
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                    {saveError}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                    Amount
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                                    <span className="text-sm font-semibold text-zinc-500">
                                        {isIncome ? "+" : isTransfer ? "" : "-"}
                                        {symbol}
                                    </span>
                                    <input
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none"
                                    />
                                </div>
                                {validation.amount && (
                                    <p className="text-xs text-zinc-400">
                                        {validation.amount}
                                    </p>
                                )}
                            </div>

                            {isTransfer && transaction.amount < 0 && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                        Comisión (Fee)
                                    </label>
                                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                                        <span className="text-sm font-semibold text-zinc-500">
                                            {symbol}
                                        </span>
                                        <input
                                            inputMode="decimal"
                                            value={fee}
                                            onChange={(e) => setFee(e.target.value)}
                                            className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none"
                                        />
                                    </div>
                                    {validation.fee ? (
                                        <p className="text-xs text-red-500">
                                            {validation.fee}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-zinc-400">
                                            Total a descontar del origen: {symbol}{((parseAmount(amount) || 0) + (parseAmount(fee) || 0)).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                        Type
                                    </label>
                                    <select
                                        value={type}
                                        onChange={(e) =>
                                            setType(
                                                e.target.value as
                                                    | "income"
                                                    | "expense"
                                                    | "transfer"
                                            )
                                        }
                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                    >
                                        <option value="expense">Expense</option>
                                        <option value="income">Income</option>
                                        <option value="transfer">Transfer</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                        Currency
                                    </label>
                                    <select
                                        value={currency}
                                        onChange={(e) =>
                                            setCurrency(
                                                normalizeCurrency(e.target.value)
                                            )
                                        }
                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                    >
                                        {SUPPORTED_CURRENCIES.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    {validation.currency && (
                                        <p className="text-xs text-zinc-400">
                                            {validation.currency}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Custom Rate Toggle */}
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
                                                    Monto equivalente en {currency === "EUR" ? "USD" : "EUR"}
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                                                        {CURRENCY_SYMBOLS[currency === "EUR" ? "USD" : "EUR"]}
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
                                                            ? `1 ${currency} =`
                                                            : `1 ${currency === "EUR" ? "USD" : "EUR"} =`
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
                                                                ? (currency === "EUR" ? "USD" : "EUR")
                                                                : currency
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Breakdown Box */}
                                        {editBreakdown && (
                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2.5 text-xs text-zinc-600 transition-all">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-400 font-medium">Tasa oficial:</span>
                                                    <span className="font-semibold text-zinc-800">
                                                        1 {currency} = {convertBetween(1, currency, editBreakdown.oppositeCurrency).toFixed(4)} {editBreakdown.oppositeCurrency}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-400 font-medium">Tasa aplicada:</span>
                                                    <span className="font-bold text-zinc-900">
                                                        1 {currency} = {(editBreakdown.appliedEquivalent / (parseAmount(amount) || 1)).toFixed(4)} {editBreakdown.oppositeCurrency}
                                                    </span>
                                                </div>
                                                {editBreakdown.isTransfer ? (
                                                    editBreakdown.differenceDest !== 0 && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-zinc-400 font-medium">Diferencia vs oficial:</span>
                                                            <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${editBreakdown.isGain ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                                {editBreakdown.isGain ? '+' : '-'}
                                                                {CURRENCY_SYMBOLS[transaction.amount < 0 ? editBreakdown.oppositeCurrency : currency]}
                                                                {Math.abs(editBreakdown.differenceDest).toFixed(2)}
                                                                {editBreakdown.isGain ? ' (Ganancia)' : ' (Pérdida)'}
                                                            </span>
                                                        </div>
                                                    )
                                                ) : (
                                                    editBreakdown.differenceOpposite !== 0 && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-zinc-400 font-medium">Diferencia vs oficial:</span>
                                                            <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${editBreakdown.isGain ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                                {editBreakdown.isGain ? '+' : '-'}
                                                                {CURRENCY_SYMBOLS[editBreakdown.oppositeCurrency]}{Math.abs(editBreakdown.differenceOpposite).toFixed(2)}
                                                                {editBreakdown.isGain ? ' (Ganancia)' : ' (Pérdida)'}
                                                            </span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                    Description
                                </label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                    Date
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                                    <CalendarBlank
                                        size={16}
                                        className="text-zinc-400"
                                    />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full bg-transparent text-sm text-zinc-900 outline-none"
                                    />
                                </div>
                                {validation.date && (
                                    <p className="text-xs text-zinc-400">
                                        {validation.date}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                    Category
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (type === "transfer") return;
                                        setCategoryOpen((v) => !v);
                                    }}
                                    disabled={type === "transfer"}
                                    className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-100"
                                >
                                    <Tag size={16} className="text-zinc-400" />
                                    <span className="flex-1 truncate">
                                        {type === "transfer"
                                            ? "Not applicable for transfers"
                                            : category || "Select category"}
                                    </span>
                                    <MagnifyingGlass
                                        size={16}
                                        className="text-zinc-400"
                                    />
                                </button>

                                <AnimatePresence>
                                    {categoryOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            className="mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
                                        >
                                            <div className="border-b border-zinc-100 p-3">
                                                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                                                    <MagnifyingGlass
                                                        size={16}
                                                        className="text-zinc-400"
                                                    />
                                                    <input
                                                        value={categoryQuery}
                                                        onChange={(e) =>
                                                            setCategoryQuery(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Search..."
                                                        className="w-full bg-transparent text-sm text-zinc-900 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-48 overflow-auto p-1">
                                                {filteredCategories.length ===
                                                0 ? (
                                                    <div className="px-3 py-4 text-center text-sm text-zinc-400">
                                                        No matches.
                                                    </div>
                                                ) : (
                                                    filteredCategories.map((c) => (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            onClick={() => {
                                                                setCategory(c);
                                                                setCategoryOpen(
                                                                    false
                                                                );
                                                                setCategoryQuery(
                                                                    ""
                                                                );
                                                            }}
                                                            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${c === category
                                                                    ? "bg-zinc-900 text-white"
                                                                    : "text-zinc-700 hover:bg-zinc-50"
                                                                }`}
                                                        >
                                                            {c}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="border-t border-zinc-100 px-6 py-4">
                            {confirmDelete ? (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                        <Warning
                                            size={18}
                                            className="mt-0.5 text-red-500"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-red-700">
                                                Delete this transaction?
                                            </p>
                                            <p className="text-xs text-red-600">
                                                This action cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setConfirmDelete(false)
                                            }
                                            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isDeleting ? "Deleting..." : "Delete"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(true)}
                                        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                                    >
                                        <Trash size={16} />
                                        Delete
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                setCategoryOpen(false);
                                            }}
                                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={!canSave}
                                            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isSaving ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="sr-only">
                            <Vault />
                            <CurrencyCircleDollar />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
