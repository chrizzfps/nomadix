"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UsersThree } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { friendInitials, formatFriendHandle } from "@/lib/social";
import type { FriendSummary } from "@/types";

interface ShareVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    vaultId: string;
    vaultName: string;
    onShared: () => void;
}

export function ShareVaultModal({ isOpen, onClose, vaultId, vaultName, onShared }: ShareVaultModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [friends, setFriends] = useState<FriendSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);
        (async () => {
            const { data, error } = await supabase.rpc("nomadix_list_friends");
            if (error) {
                addToast(error.message, "error");
            } else {
                setFriends(((data as FriendSummary[]) || []).filter((f) => f.status === "accepted"));
            }
            setIsLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, vaultId]);

    const shareWith = async (friend: FriendSummary) => {
        setSendingId(friend.friend_id);
        const { error } = await supabase.rpc("nomadix_share_vault", {
            p_vault_id: vaultId,
            p_friend_id: friend.friend_id,
        });
        setSendingId(null);
        if (error) {
            addToast(error.message || t("sharedVault.inviteFailed"), "error");
            return;
        }
        addToast(t("sharedVault.invited"));
        onShared();
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
                                        {t("sharedVault.shareAction")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">{vaultName}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="mt-6 space-y-2">
                            <p className="mb-2 text-xs text-muted-foreground">
                                {t("sharedVault.selectFriend")}
                            </p>
                            {isLoading ? (
                                <div className="h-14 animate-pulse rounded-xl bg-accent" />
                            ) : friends.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    {t("friends.noFriendsYet")}
                                </p>
                            ) : (
                                friends.map((f) => (
                                    <button
                                        key={f.friend_id}
                                        onClick={() => shareWith(f)}
                                        disabled={sendingId === f.friend_id}
                                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-accent/60 p-3 text-left transition-colors hover:border-ring disabled:opacity-50"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                            {friendInitials(f.full_name || f.username || "?")}
                                        </div>
                                        <span className="text-sm font-medium text-foreground">
                                            {formatFriendHandle(f)}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
