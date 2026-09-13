"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Vault, UsersThree, HandCoins } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { friendInitials, formatFriendHandle } from "@/lib/social";
import type { Currency, FriendSummary, VaultType } from "@/types";

interface CreateVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const VAULT_TYPE_OPTIONS: { value: VaultType; label: string; description?: string }[] = [
    { value: "checking", label: "Checking" },
    { value: "savings", label: "Savings" },
    { value: "cash", label: "Cash" },
    {
        value: "receivable",
        label: "Pending Collection",
        description: "Invoiced money you haven't received yet",
    },
];

export function CreateVaultModal({
    isOpen,
    onClose,
    onCreated,
}: CreateVaultModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [name, setName] = useState("");
    const [currency, setCurrency] = useState<Currency>("EUR");
    const [type, setType] = useState<VaultType>("checking");
    const [isProtected, setIsProtected] = useState(false);
    const [initialAmount, setInitialAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // A receivable vault holds no liquid balance and can't be shared or
    // protected in v1 -- none of that UI applies to it.
    const isReceivable = type === "receivable";

    const [shareEnabled, setShareEnabled] = useState(false);
    const [friends, setFriends] = useState<FriendSummary[]>([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setFriendsLoading(true);
        (async () => {
            const { data } = await supabase.rpc("nomadix_list_friends");
            setFriends(((data as FriendSummary[]) || []).filter((f) => f.status === "accepted"));
            setFriendsLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError("Vault name is required.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: insertedVault, error: insertError } = await supabase
            .from("vaults")
            .insert({
                user_id: user.id,
                name: name.trim(),
                currency,
                type,
                is_protected: isReceivable ? false : isProtected,
            })
            .select("id")
            .single();

        if (insertError || !insertedVault) {
            setError(insertError?.message || "Failed to create vault.");
            addToast(insertError?.message || "Failed to create vault.", "error");
            setIsLoading(false);
            return;
        }

        // Create initial deposit transaction if amount is set -- not
        // applicable to a receivable vault, whose balance is never a
        // transaction sum.
        const amount = parseFloat(initialAmount);
        if (!isReceivable && amount > 0) {
            await supabase.from("transactions").insert({
                user_id: user.id,
                vault_id: insertedVault.id,
                amount,
                type: "income",
                original_currency: currency,
                category: "Initial Deposit",
                description: "Initial balance",
            });
        }

        if (!isReceivable && shareEnabled && selectedFriendId) {
            const { error: shareError } = await supabase.rpc("nomadix_share_vault", {
                p_vault_id: insertedVault.id,
                p_friend_id: selectedFriendId,
            });
            if (shareError) {
                addToast(shareError.message || "Vault created, but the invite failed.", "error");
            } else {
                addToast("Vault created and invite sent.");
            }
        }

        setName("");
        setCurrency("EUR");
        setType("checking");
        setShareEnabled(false);
        setSelectedFriendId(null);
        setIsProtected(false);
        setInitialAmount("");
        setIsLoading(false);
        if (!shareEnabled || !selectedFriendId) {
            addToast("Vault created successfully");
        }
        onCreated();
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
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                    <Vault size={20} className="text-foreground/70" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        New Vault
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Create a new financial vault
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="mt-6 space-y-5">
                            {/* Name */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    placeholder='e.g. "Travel Fund", "Spain Savings"'
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                    className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            {/* Initial Amount — meaningless for a receivable vault */}
                            {!isReceivable && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        Initial Amount{" "}
                                        <span className="normal-case tracking-normal text-muted-foreground">(optional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={initialAmount}
                                        onChange={(e) => setInitialAmount(e.target.value)}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>
                            )}

                            {/* Currency */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Currency
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["EUR", "USD"] as Currency[]).map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCurrency(c)}
                                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${currency === c
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-card text-muted-foreground hover:border-ring"
                                                }`}
                                        >
                                            {c === "EUR" ? "€ EUR" : "$ USD"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {VAULT_TYPE_OPTIONS.map((opt) => {
                                        const isReceivableOption = opt.value === "receivable";
                                        const selected = type === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setType(opt.value)}
                                                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${selected
                                                    ? isReceivableOption
                                                        ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                        : "border-primary bg-primary text-primary-foreground"
                                                    : "border-border bg-card text-muted-foreground hover:border-ring"
                                                    }`}
                                            >
                                                {isReceivableOption && (
                                                    <HandCoins size={14} weight="bold" />
                                                )}
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {isReceivable && (
                                    <p className="text-[11px] text-muted-foreground">
                                        {VAULT_TYPE_OPTIONS.find((o) => o.value === "receivable")?.description}
                                    </p>
                                )}
                            </div>

                            {/* Protected Toggle — meaningless on a receivable vault */}
                            {!isReceivable && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={isProtected}
                                            onChange={(e) => setIsProtected(e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground/80">
                                            Protected Vault
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Requires extra confirmation for withdrawals
                                        </p>
                                    </div>
                                </label>
                            )}

                            {/* Share Toggle — not offered for a receivable vault in v1 */}
                            {!isReceivable && (
                                <div className="space-y-3 rounded-xl border border-border bg-accent/40 p-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={shareEnabled}
                                                onChange={(e) => {
                                                    setShareEnabled(e.target.checked);
                                                    if (!e.target.checked) setSelectedFriendId(null);
                                                }}
                                                className="peer sr-only"
                                            />
                                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <UsersThree size={16} className="text-foreground/60" />
                                            <div>
                                                <p className="text-sm font-medium text-foreground/80">
                                                    Share with a friend
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Invite a friend to co-own this vault
                                                </p>
                                            </div>
                                        </div>
                                    </label>

                                    {shareEnabled && (
                                        <div className="space-y-1.5">
                                            {friendsLoading ? (
                                                <div className="h-11 animate-pulse rounded-lg bg-accent" />
                                            ) : friends.length === 0 ? (
                                                <p className="py-2 text-center text-xs text-muted-foreground">
                                                    You have no friends yet — add one first from the Friends page.
                                                </p>
                                            ) : (
                                                friends.map((f) => (
                                                    <button
                                                        key={f.friend_id}
                                                        type="button"
                                                        onClick={() => setSelectedFriendId(f.friend_id)}
                                                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${selectedFriendId === f.friend_id
                                                            ? "border-primary bg-primary/10"
                                                            : "border-border bg-card hover:border-ring"
                                                            }`}
                                                    >
                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                                            {friendInitials(f.full_name || f.username || "?")}
                                                        </div>
                                                        <span className="text-sm font-medium text-foreground">
                                                            {formatFriendHandle(f)}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
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
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={isLoading || !name.trim()}
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isLoading ? "Creating..." : "Create Vault"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
