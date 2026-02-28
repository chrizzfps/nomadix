"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Vault, FloppyDisk } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import type { Currency } from "@/types";

interface EditVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => void;
    vault: {
        id: string;
        name: string;
        currency: string;
        type: "savings" | "checking" | "cash";
        is_protected: boolean;
        balance: number;
    };
}

export function EditVaultModal({
    isOpen,
    onClose,
    onUpdated,
    vault,
}: EditVaultModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [name, setName] = useState(vault.name);
    const [currency, setCurrency] = useState<Currency>(vault.currency as Currency);
    const [type, setType] = useState<"savings" | "checking" | "cash">(vault.type);
    const [isProtected, setIsProtected] = useState(vault.is_protected);
    const [newBalance, setNewBalance] = useState(String(vault.balance));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync form when vault changes
    useEffect(() => {
        setName(vault.name);
        setCurrency(vault.currency as Currency);
        setType(vault.type);
        setIsProtected(vault.is_protected);
        setNewBalance(String(vault.balance));
        setError(null);
    }, [vault]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Vault name is required.");
            return;
        }

        setIsSaving(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Update vault metadata
        const { error: updateError } = await supabase
            .from("vaults")
            .update({
                name: name.trim(),
                currency,
                type,
                is_protected: isProtected,
                updated_at: new Date().toISOString(),
            })
            .eq("id", vault.id);

        if (updateError) {
            setError(updateError.message);
            addToast(updateError.message, "error");
            setIsSaving(false);
            return;
        }

        // If balance changed, insert an adjustment transaction
        const targetBalance = parseFloat(newBalance) || 0;
        const diff = targetBalance - vault.balance;

        if (Math.abs(diff) > 0.01) {
            const { error: txError } = await supabase
                .from("transactions")
                .insert({
                    user_id: user.id,
                    vault_id: vault.id,
                    amount: diff,
                    type: diff > 0 ? "income" : "expense",
                    original_currency: currency,
                    category: "Adjustment",
                    description: "Balance adjustment",
                });

            if (txError) {
                setError(txError.message);
                addToast("Vault updated but balance adjustment failed", "error");
                setIsSaving(false);
                onUpdated();
                onClose();
                return;
            }
        }

        setIsSaving(false);
        addToast("Vault updated");
        onUpdated();
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
                        onClick={onClose}
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
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                                    <Vault
                                        size={20}
                                        className="text-zinc-600"
                                    />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900">
                                        Edit Vault
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Update vault details
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="mt-6 space-y-5">
                            {/* Name */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                            </div>

                            {/* Balance */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Current Balance
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newBalance}
                                    onChange={(e) =>
                                        setNewBalance(e.target.value)
                                    }
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                                {Math.abs(
                                    (parseFloat(newBalance) || 0) -
                                    vault.balance
                                ) > 0.01 && (
                                        <p className="text-[11px] text-amber-600">
                                            An adjustment transaction of{" "}
                                            {(
                                                (parseFloat(newBalance) || 0) -
                                                vault.balance
                                            ).toFixed(2)}{" "}
                                            will be created.
                                        </p>
                                    )}
                            </div>

                            {/* Currency */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Currency
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["EUR", "USD"] as Currency[]).map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCurrency(c)}
                                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${currency === c
                                                    ? "border-zinc-900 bg-zinc-900 text-white"
                                                    : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                                                }`}
                                        >
                                            {c === "EUR" ? "€ EUR" : "$ USD"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(
                                        [
                                            {
                                                value: "checking",
                                                label: "Checking",
                                            },
                                            {
                                                value: "savings",
                                                label: "Savings",
                                            },
                                            { value: "cash", label: "Cash" },
                                        ] as const
                                    ).map((t) => (
                                        <button
                                            key={t.value}
                                            type="button"
                                            onClick={() => setType(t.value)}
                                            className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${type === t.value
                                                    ? "border-zinc-900 bg-zinc-900 text-white"
                                                    : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                                                }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Protected Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={isProtected}
                                        onChange={(e) =>
                                            setIsProtected(e.target.checked)
                                        }
                                        className="peer sr-only"
                                    />
                                    <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-700">
                                        Protected Vault
                                    </p>
                                    <p className="text-[11px] text-zinc-400">
                                        Requires extra confirmation for
                                        withdrawals
                                    </p>
                                </div>
                            </label>

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
                                onClick={handleSave}
                                disabled={isSaving || !name.trim()}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                <FloppyDisk size={16} />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
