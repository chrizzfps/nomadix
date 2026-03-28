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
};

type TxUpdate = Partial<
    Pick<Tx, "amount" | "type" | "category" | "description" | "original_currency" | "date">
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

    const [categoryOpen, setCategoryOpen] = useState(false);
    const [categoryQuery, setCategoryQuery] = useState("");
    const [categories, setCategories] = useState<string[]>([]);

    const symbol = CURRENCY_SYMBOLS[currency] || "$";

    const initialTransferSign = useMemo(() => {
        if (!transaction) return -1;
        return transaction.amount < 0 ? -1 : 1;
    }, [transaction]);

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
        setAmount(String(Math.abs(transaction.amount)));
        setCategory(transaction.category || "");
        setCategoryQuery("");
        setCategoryOpen(false);
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
        return errors;
    }, [amount, currency, date, type]);

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

        const signedAmount =
            type === "income"
                ? Math.abs(parsedAmount)
                : type === "expense"
                    ? -Math.abs(parsedAmount)
                    : initialTransferSign * Math.abs(parsedAmount);

        const payload = {
            date: date || null,
            description: description.trim() || null,
            category: category.trim() || null,
            type,
            original_currency: currency,
            amount: signedAmount,
        };

        const { data: updated, error } = await supabase
            .from("transactions")
            .update(payload)
            .eq("id", transaction.id)
            .select("id,amount,type,category,description,original_currency,date,created_at")
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

                        <div className="space-y-4 px-6 py-5">
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

                            <div className="relative space-y-1.5">
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
                                            className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
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
