"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, HandCoins, Vault as VaultIcon } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { formatFriendHandle } from "@/lib/social";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import type { TransferableVault, Vault } from "@/types";

interface SettleUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    friend: { friend_id: string; username: string | null; full_name: string };
    amountOwedEur: number;
    onSettled: () => void;
}

export function SettleUpModal({ isOpen, onClose, friend, amountOwedEur, onSettled }: SettleUpModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [ownVaults, setOwnVaults] = useState<Vault[]>([]);
    const [targetVaults, setTargetVaults] = useState<TransferableVault[]>([]);
    const [fromVaultId, setFromVaultId] = useState("");
    const [toVaultId, setToVaultId] = useState("");
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientToken] = useState(() =>
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`
    );

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setAmount(amountOwedEur.toFixed(2));
        setIsLoading(true);
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: mine }, { data: theirs, error: theirsError }] = await Promise.all([
                supabase.from("vaults").select("*").eq("user_id", user.id).order("name"),
                supabase.rpc("nomadix_list_transferable_vaults", { p_target_user_id: friend.friend_id }),
            ]);
            if (theirsError) addToast(theirsError.message, "error");
            const myVaults = (mine as Vault[]) || [];
            const openVaults = (theirs as TransferableVault[]) || [];
            setOwnVaults(myVaults);
            setTargetVaults(openVaults);
            setFromVaultId(myVaults[0]?.id ?? "");
            setToVaultId(openVaults[0]?.vault_id ?? "");
            setIsLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, friend.friend_id]);

    const parsedAmount = useMemo(() => {
        const n = parseFloat(amount.replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    }, [amount]);

    const canSave =
        !!fromVaultId && !!toVaultId && parsedAmount > 0 && parsedAmount <= amountOwedEur + 0.005 && !isSaving && !isLoading;

    const handleSettle = async () => {
        setIsSaving(true);
        setError(null);
        const { error: err } = await supabase.rpc("nomadix_settle_up", {
            p_friend_id: friend.friend_id,
            p_from_vault_id: fromVaultId,
            p_to_vault_id: toVaultId,
            p_amount_eur: parsedAmount,
            p_client_token: clientToken,
        });
        setIsSaving(false);
        if (err) {
            const message = /nothing to settle/i.test(err.message)
                ? t("balances.nothingToSettle")
                : err.message;
            setError(message);
            addToast(message, "error");
            return;
        }
        addToast(t("balances.settled"));
        onSettled();
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                    <HandCoins size={20} className="text-foreground/70" />
                                </div>
                                <h2 className="text-lg font-semibold text-foreground">
                                    {t("balances.settleUpTitle", { name: formatFriendHandle(friend) })}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="mt-6 space-y-3">
                                <div className="h-12 animate-pulse rounded-xl bg-accent" />
                                <div className="h-12 animate-pulse rounded-xl bg-accent" />
                            </div>
                        ) : targetVaults.length === 0 ? (
                            <p className="mt-6 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                {t("transfer.noOpenVaults", { name: formatFriendHandle(friend) })}
                            </p>
                        ) : (
                            <div className="mt-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("balances.settleFromVault")}
                                    </label>
                                    <div className="relative">
                                        <VaultIcon
                                            size={16}
                                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <select
                                            value={fromVaultId}
                                            onChange={(e) => setFromVaultId(e.target.value)}
                                            className="w-full appearance-none rounded-xl border border-border bg-accent py-3 pl-10 pr-4 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        >
                                            {ownVaults.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name} ({CURRENCY_SYMBOLS[v.currency]})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("balances.settleToVault", { name: formatFriendHandle(friend) })}
                                    </label>
                                    <div className="relative">
                                        <VaultIcon
                                            size={16}
                                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <select
                                            value={toVaultId}
                                            onChange={(e) => setToVaultId(e.target.value)}
                                            className="w-full appearance-none rounded-xl border border-border bg-accent py-3 pl-10 pr-4 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        >
                                            {targetVaults.map((v) => (
                                                <option key={v.vault_id} value={v.vault_id}>
                                                    {v.name} ({CURRENCY_SYMBOLS[v.currency]})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("balances.settleAmount")} (EUR)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={amountOwedEur}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>

                                {error && <p className="text-sm text-destructive">{error}</p>}
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSettle}
                                disabled={!canSave}
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isSaving ? "..." : t("balances.settleUp")}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
