"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UsersThree } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import {
    friendInitials,
    formatFriendHandle,
    previewSplitAmount,
    validateSplitValue,
} from "@/lib/social";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import type { FriendSummary, SplitMode } from "@/types";

interface SplitExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: { id: string; amount: number; original_currency: string; description: string | null };
    onSplit: () => void;
}

export function SplitExpenseModal({ isOpen, onClose, transaction, onSplit }: SplitExpenseModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [friends, setFriends] = useState<FriendSummary[]>([]);
    const [friendId, setFriendId] = useState("");
    const [mode, setMode] = useState<SplitMode>("equal");
    const [value, setValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const symbol = CURRENCY_SYMBOLS[transaction.original_currency] || "$";
    const isExpense = transaction.amount < 0;

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setMode("equal");
        setValue("");
        setIsLoading(true);
        (async () => {
            const { data, error: err } = await supabase.rpc("nomadix_list_friends");
            if (err) {
                addToast(err.message, "error");
            } else {
                const accepted = ((data as FriendSummary[]) || []).filter((f) => f.status === "accepted");
                setFriends(accepted);
                setFriendId(accepted[0]?.friend_id ?? "");
            }
            setIsLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const numericValue = value.trim() ? parseFloat(value.replace(",", ".")) : null;
    const validationError = validateSplitValue(transaction.amount, mode, numericValue);
    const preview = previewSplitAmount(transaction.amount, mode, numericValue);
    const selectedFriend = friends.find((f) => f.friend_id === friendId);

    const previewLabel = useMemo(() => {
        if (!selectedFriend || validationError) return null;
        const name = formatFriendHandle(selectedFriend);
        const amountLabel = `${symbol}${preview.toFixed(2)}`;
        return t(isExpense ? "split.theyOwe" : "split.youOwe", { name, amount: amountLabel });
    }, [selectedFriend, validationError, preview, symbol, isExpense, t]);

    const canSave = !!friendId && !validationError && !isSaving && !isLoading;

    const handleSave = async () => {
        if (!canSave) return;
        setIsSaving(true);
        const { error: err } = await supabase.rpc("nomadix_create_share", {
            p_transaction_id: transaction.id,
            p_friend_id: friendId,
            p_split_mode: mode,
            p_split_value: mode === "equal" ? null : numericValue,
        });
        setIsSaving(false);
        if (err) {
            const message = /already shared with a co-owner/i.test(err.message)
                ? t("split.notSharable")
                : /already settled/i.test(err.message)
                  ? t("split.alreadySettled")
                  : err.message;
            setError(message);
            addToast(message, "error");
            return;
        }
        addToast(t("split.created"));
        onSplit();
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
                                    <UsersThree size={20} className="text-foreground/70" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {t("split.modalTitle")}
                                    </h2>
                                    {transaction.description && (
                                        <p className="text-xs text-muted-foreground">{transaction.description}</p>
                                    )}
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
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    {t("split.selectFriend")}
                                </label>
                                {isLoading ? (
                                    <div className="h-12 animate-pulse rounded-xl bg-accent" />
                                ) : friends.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                                        {t("friends.noFriendsYet")}
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {friends.map((f) => (
                                            <button
                                                key={f.friend_id}
                                                type="button"
                                                onClick={() => setFriendId(f.friend_id)}
                                                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                                                    friendId === f.friend_id
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border bg-card text-muted-foreground hover:border-ring"
                                                }`}
                                            >
                                                <span
                                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                                                        friendId === f.friend_id
                                                            ? "bg-primary-foreground/20"
                                                            : "bg-accent text-foreground/70"
                                                    }`}
                                                >
                                                    {friendInitials(f.full_name || f.username || "?")}
                                                </span>
                                                {formatFriendHandle(f)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Split
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(
                                        [
                                            { value: "equal" as const, label: t("split.modeEqual") },
                                            { value: "amount" as const, label: t("split.modeAmount") },
                                            { value: "percent" as const, label: t("split.modePercent") },
                                        ]
                                    ).map((m) => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            onClick={() => {
                                                setMode(m.value);
                                                setValue("");
                                            }}
                                            className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                                                mode === m.value
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-card text-muted-foreground hover:border-ring"
                                            }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                                {mode !== "equal" && (
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={mode === "percent" ? "50" : "0.00"}
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        autoFocus
                                        className="mt-2 w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                )}
                                {validationError && (
                                    <p className="text-xs text-destructive">{validationError}</p>
                                )}
                            </div>

                            {previewLabel && (
                                <p className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-foreground">
                                    {previewLabel}
                                </p>
                            )}

                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!canSave}
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {t("split.confirm")}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
