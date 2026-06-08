"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    ArrowUp,
    ArrowDown,
    ArrowsLeftRight,
    Trash,
    CalendarBlank,
    Tag,
    Vault,
    CurrencyCircleDollar,
    Warning,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { useCurrencyStore } from "@/stores/currency-store";

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeleted: () => void;
    transaction: {
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
    } | null;
}

export function TransactionDetailModal({
    isOpen,
    onClose,
    onDeleted,
    transaction,
}: TransactionDetailModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const { getActiveRate } = useCurrencyStore();
    const offRate = getActiveRate();

    const customRateDetail = useMemo(() => {
        if (!transaction || !transaction.exchange_rate_at_time || transaction.exchange_rate_at_time <= 0) return null;
        
        const amountVal = Math.abs(
            transaction.type === "transfer" && transaction.fee && transaction.amount < 0
                ? Math.abs(transaction.amount) - transaction.fee
                : transaction.amount
        );
        const currency = transaction.original_currency;
        const oppositeCurrency = currency === "EUR" ? "USD" : "EUR";
        const appliedRate = transaction.exchange_rate_at_time;
        
        // Calculate equivalents
        let appliedEquivalent = 0;
        if (currency === "EUR") {
            appliedEquivalent = amountVal / appliedRate;
        } else {
            appliedEquivalent = amountVal * appliedRate;
        }

        const officialEquivalent = currency === "EUR" ? amountVal / offRate : amountVal * offRate;

        if (transaction.type === "transfer") {
            const isSource = transaction.amount < 0;
            const cSent = isSource ? currency : oppositeCurrency;
            const cReceived = isSource ? oppositeCurrency : currency;

            const sVal = isSource ? amountVal : appliedEquivalent;
            const rVal = isSource ? appliedEquivalent : amountVal;

            const officialReceived = cSent === "USD" ? sVal * offRate : sVal / offRate;
            const diffReceived = rVal - officialReceived;
            const isGain = diffReceived > 0;

            return {
                isTransfer: true,
                isGain,
                differenceDest: diffReceived,
                oppositeCurrency,
                appliedEquivalent,
            };
        } else {
            const diffOpposite = appliedEquivalent - officialEquivalent;
            const isGain = transaction.amount < 0 ? diffOpposite < 0 : diffOpposite > 0;

            return {
                isTransfer: false,
                isGain,
                differenceOpposite: diffOpposite,
                oppositeCurrency,
                appliedEquivalent,
            };
        }
    }, [transaction, offRate]);

    if (!transaction) return null;

    const isIncome = transaction.amount > 0;
    const isTransfer = transaction.type === "transfer";
    const symbol = CURRENCY_SYMBOLS[transaction.original_currency] || "$";
    const formattedDate = new Date(
        transaction.date || transaction.created_at
    ).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const formattedTime = new Date(transaction.created_at).toLocaleTimeString(
        "en-US",
        {
            hour: "2-digit",
            minute: "2-digit",
        }
    );

    const handleDelete = async () => {
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

        const revertLabel = isIncome
            ? `${symbol}${Math.abs(transaction.amount).toFixed(2)} removed from balance`
            : `${symbol}${Math.abs(transaction.amount).toFixed(2)} restored to balance`;

        addToast(`Transaction deleted — ${revertLabel}`);
        setIsDeleting(false);
        setConfirmDelete(false);
        onDeleted();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            onClose();
                            setConfirmDelete(false);
                        }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
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
                        {/* Header */}
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
                                        Transaction Details
                                    </h2>
                                    <p className="text-[11px] text-zinc-400 capitalize">
                                        {transaction.type}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    onClose();
                                    setConfirmDelete(false);
                                }}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Amount */}
                        <div className="px-6 py-5 text-center border-b border-zinc-100">
                            <p
                                className={`text-3xl font-bold tracking-tight ${isIncome
                                        ? "text-emerald-600"
                                        : isTransfer
                                            ? "text-zinc-600"
                                            : "text-zinc-900"
                                    }`}
                            >
                                {isIncome ? "+" : isTransfer ? "" : "-"}
                                {symbol}
                                {Math.abs(
                                    isTransfer && transaction.fee && transaction.amount < 0
                                        ? Math.abs(transaction.amount) - transaction.fee
                                        : transaction.amount
                                ).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                })}
                            </p>
                            {isTransfer && transaction.fee && transaction.amount < 0 ? (
                                <p className="mt-1 text-xs text-zinc-400">
                                    + {symbol}{transaction.fee.toFixed(2)} comisión ({symbol}{Math.abs(transaction.amount).toFixed(2)} total debitado)
                                </p>
                            ) : null}
                            <p className="mt-1 text-sm text-zinc-500">
                                {transaction.description || "No description"}
                            </p>
                        </div>

                        {/* Detail Rows */}
                        <div className="divide-y divide-zinc-50 px-6">
                            <div className="flex items-center gap-3 py-3.5">
                                <CalendarBlank
                                    size={16}
                                    className="text-zinc-400"
                                />
                                <div className="flex-1">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                        Date
                                    </p>
                                    <p className="text-sm font-medium text-zinc-700">
                                        {formattedDate}
                                    </p>
                                    <p className="text-[11px] text-zinc-400">
                                        {formattedTime}
                                    </p>
                                </div>
                            </div>

                            {transaction.vault_name && (
                                <div className="flex items-center gap-3 py-3.5">
                                    <Vault
                                        size={16}
                                        className="text-zinc-400"
                                    />
                                    <div className="flex-1">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                            Vault
                                        </p>
                                        <p className="text-sm font-medium text-zinc-700">
                                            {transaction.vault_name}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {isTransfer && transaction.fee && transaction.amount < 0 ? (
                                <>
                                    <div className="flex items-center gap-3 py-3.5">
                                        <CurrencyCircleDollar
                                            size={16}
                                            className="text-zinc-400"
                                        />
                                        <div className="flex-1">
                                            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                                Monto Transferido
                                            </p>
                                            <p className="text-sm font-medium text-zinc-700">
                                                {symbol}{(Math.abs(transaction.amount) - transaction.fee).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 py-3.5">
                                        <Warning
                                            size={16}
                                            className="text-zinc-400"
                                        />
                                        <div className="flex-1">
                                            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                                Comisión Bancaria
                                            </p>
                                            <p className="text-sm font-medium text-zinc-700">
                                                {symbol}{transaction.fee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 py-3.5">
                                        <CurrencyCircleDollar
                                            size={16}
                                            className="text-zinc-400"
                                        />
                                        <div className="flex-1">
                                            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                                Total Debitado
                                            </p>
                                            <p className="text-sm font-medium text-zinc-700">
                                                {symbol}{Math.abs(transaction.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center gap-3 py-3.5">
                                    <Tag size={16} className="text-zinc-400" />
                                    <div className="flex-1">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                            Category
                                        </p>
                                        <p className="text-sm font-medium text-zinc-700">
                                            {transaction.category || "—"}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 py-3.5">
                                <CurrencyCircleDollar
                                    size={16}
                                    className="text-zinc-400"
                                />
                                <div className="flex-1">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                        Currency
                                    </p>
                                    <p className="text-sm font-medium text-zinc-700">
                                        {transaction.original_currency}
                                    </p>
                                </div>
                            </div>

                            {transaction.exchange_rate_at_time && transaction.exchange_rate_at_time > 0 && customRateDetail ? (
                                <div className="py-3.5 space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                                        Exchange Rate
                                    </p>
                                    <div className="rounded-xl border border-zinc-150 bg-zinc-50 p-3.5 space-y-2 text-xs text-zinc-600">
                                        <div className="flex justify-between">
                                            <span>Moneda origen:</span>
                                            <span className="font-semibold text-zinc-800">{transaction.original_currency}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Tasa aplicada:</span>
                                            <span className="font-bold text-zinc-900">
                                                {transaction.original_currency === "EUR"
                                                    ? `1 EUR = ${(1 / transaction.exchange_rate_at_time).toFixed(4)} USD`
                                                    : `1 USD = ${transaction.exchange_rate_at_time.toFixed(4)} EUR`
                                                }
                                            </span>
                                        </div>
                                        {customRateDetail.isTransfer ? (
                                            customRateDetail.differenceDest !== 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span>Diferencia vs oficial:</span>
                                                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${customRateDetail.isGain ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                        {customRateDetail.isGain ? '+' : '-'}
                                                        {CURRENCY_SYMBOLS[transaction.amount < 0 ? customRateDetail.oppositeCurrency : transaction.original_currency]}
                                                        {Math.abs(customRateDetail.differenceDest).toFixed(2)}
                                                        {customRateDetail.isGain ? ' (Ganancia)' : ' (Pérdida)'}
                                                    </span>
                                                </div>
                                            )
                                        ) : (
                                            customRateDetail.differenceOpposite !== 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span>Diferencia vs oficial:</span>
                                                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${customRateDetail.isGain ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                        {customRateDetail.isGain ? '+' : '-'}
                                                        {CURRENCY_SYMBOLS[customRateDetail.oppositeCurrency]}
                                                        {Math.abs(customRateDetail.differenceOpposite).toFixed(2)}
                                                        {customRateDetail.isGain ? ' (Ganancia)' : ' (Pérdida)'}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                        <div className="flex justify-between border-t border-zinc-200 pt-2 font-medium text-zinc-500">
                                            <span>Tasa interna (USD → EUR):</span>
                                            <span>{transaction.exchange_rate_at_time.toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Delete Section */}
                        <div className="border-t border-zinc-100 px-6 py-4">
                            {!confirmDelete ? (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:border-red-300"
                                >
                                    <Trash size={15} />
                                    Delete Transaction
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
                                        <Warning
                                            size={16}
                                            weight="fill"
                                            className="mt-0.5 shrink-0 text-amber-500"
                                        />
                                        <div className="text-xs text-amber-700">
                                            <p className="font-semibold">
                                                This will revert the balance
                                            </p>
                                            <p className="mt-0.5">
                                                {isIncome
                                                    ? `${symbol}${Math.abs(transaction.amount).toFixed(2)} will be removed from the vault balance.`
                                                    : `${symbol}${Math.abs(transaction.amount).toFixed(2)} will be restored to the vault balance.`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() =>
                                                setConfirmDelete(false)
                                            }
                                            className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                        >
                                            {isDeleting
                                                ? "Deleting..."
                                                : "Yes, Delete"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
