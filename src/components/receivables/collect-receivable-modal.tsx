"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useLanguageStore } from "@/stores/language-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { outstandingAmount } from "@/lib/receivables";
import type { Receivable } from "@/types";

interface LiquidVaultOption {
    id: string;
    name: string;
    currency: "EUR" | "USD";
}

interface CollectReceivableModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCollected: () => void;
    receivable: Receivable | null;
    vaults: LiquidVaultOption[];
}

export function CollectReceivableModal({
    isOpen,
    onClose,
    onCollected,
    receivable,
    vaults,
}: CollectReceivableModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);
    const { getActiveRate } = useCurrencyStore();

    const [vaultId, setVaultId] = useState("");
    const [amount, setAmount] = useState("");
    const [rate, setRate] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const outstanding = receivable ? outstandingAmount(receivable) : 0;
    const destVault = vaults.find((v) => v.id === vaultId) || null;
    const needsRate = !!receivable && !!destVault && receivable.currency !== destVault.currency;

    useEffect(() => {
        if (!isOpen || !receivable) return;
        setVaultId(vaults[0]?.id || "");
        setAmount(String(outstandingAmount(receivable)));
        setRate(String(getActiveRate()));
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, receivable]);

    if (!receivable) return null;

    const symbol = CURRENCY_SYMBOLS[receivable.currency] || "$";

    const handleCollect = async () => {
        const parsed = parseFloat(amount);
        if (!vaultId) {
            setError(t("receivables.collect.selectVault"));
            return;
        }
        if (!amount || Number.isNaN(parsed) || parsed <= 0) {
            setError(t("receivables.collect.invalidAmount"));
            return;
        }
        if (parsed > outstanding + 0.001) {
            setError(t("receivables.collect.exceedsOutstanding"));
            return;
        }
        if (needsRate) {
            const parsedRate = parseFloat(rate);
            if (!rate || Number.isNaN(parsedRate) || parsedRate <= 0) {
                setError(t("receivables.collect.invalidRate"));
                return;
            }
        }

        setIsSaving(true);
        setError(null);

        const { error: rpcError } = await supabase.rpc("nomadix_collect_receivable", {
            p_receivable_id: receivable.id,
            p_vault_id: vaultId,
            p_amount: parsed,
            p_rate: needsRate ? parseFloat(rate) : null,
        });

        setIsSaving(false);

        if (rpcError) {
            setError(rpcError.message);
            addToast(rpcError.message, "error");
            return;
        }

        addToast(t("receivables.toast.collected"));
        onCollected();
        onClose();
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
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                                    <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {t("receivables.collect.title")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">{receivable.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="mt-6 space-y-5">
                            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-4 py-3 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
                                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                    {t("receivables.collect.outstanding")}
                                </p>
                                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                    {symbol}
                                    {outstanding.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </p>
                            </div>

                            {vaults.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                    {t("receivables.collect.noLiquidVaults")}
                                </p>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                            {t("receivables.collect.destinationVault")}
                                        </label>
                                        <select
                                            value={vaultId}
                                            onChange={(e) => setVaultId(e.target.value)}
                                            className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        >
                                            {vaults.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name} ({v.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                            {t("receivables.collect.amountToCollect")}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={outstanding}
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        />
                                        {parseFloat(amount) > 0 && parseFloat(amount) < outstanding && (
                                            <p className="text-[11px] text-amber-600">
                                                {t("receivables.collect.partialHint")}
                                            </p>
                                        )}
                                    </div>

                                    {needsRate && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                                {t("receivables.collect.exchangeRate")}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                value={rate}
                                                onChange={(e) => setRate(e.target.value)}
                                                className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                {t("receivables.collect.rateHint")}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handleCollect}
                                disabled={isSaving || vaults.length === 0}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isSaving ? t("common.saving") : t("receivables.collect.confirm")}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
