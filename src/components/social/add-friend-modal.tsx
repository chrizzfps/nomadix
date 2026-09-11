"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MagnifyingGlass, UserPlus, UsersThree } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { friendInitials, friendshipStatusLabel } from "@/lib/social";
import type { UserSearchResult } from "@/types";

interface AddFriendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRequestSent: () => void;
}

export function AddFriendModal({ isOpen, onClose, onRequestSent }: AddFriendModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [searched, setSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setQuery("");
            setResults([]);
            setSearched(false);
        }
    }, [isOpen]);

    const runSearch = async (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length < 3) {
            setResults([]);
            setSearched(false);
            return;
        }
        setIsSearching(true);
        // nomadix_find_user is the ONLY search surface: it never matches on
        // email, and it treats "doesn't exist", "not discoverable" and
        // "blocked me" identically (an empty result), so this UI never
        // needs to (and must never try to) distinguish those cases.
        const { data, error } = await supabase.rpc("nomadix_find_user", { p_query: trimmed });
        setIsSearching(false);
        setSearched(true);
        if (error) {
            addToast(error.message, "error");
            return;
        }
        setResults((data as UserSearchResult[]) || []);
    };

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(value), 350);
    };

    const sendRequest = async (target: UserSearchResult) => {
        setSendingId(target.user_id);
        const { error } = await supabase.rpc("nomadix_send_friend_request", {
            p_target_user_id: target.user_id,
        });
        setSendingId(null);
        if (error) {
            addToast(error.message || t("friends.actionFailed"), "error");
            return;
        }
        addToast(t("friends.requestSent"));
        setResults((prev) =>
            prev.map((r) =>
                r.user_id === target.user_id ? { ...r, friendship_status: "pending" } : r
            )
        );
        onRequestSent();
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
                                        {t("friends.sendRequest")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">{t("friends.searchHint")}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="relative">
                                <MagnifyingGlass
                                    size={16}
                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder={t("friends.searchPlaceholder")}
                                    value={query}
                                    onChange={(e) => handleQueryChange(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-accent py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            <div className="max-h-72 space-y-2 overflow-y-auto">
                                {isSearching && (
                                    <div className="h-14 animate-pulse rounded-xl bg-accent" />
                                )}

                                {!isSearching && searched && results.length === 0 && (
                                    <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                                        {t("friends.searchNoResults")}
                                    </p>
                                )}

                                {!isSearching &&
                                    results.map((r) => {
                                        const label = friendshipStatusLabel(r.friendship_status);
                                        return (
                                            <div
                                                key={r.user_id}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-accent/60 p-3"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                                        {friendInitials(r.full_name || r.username || "?")}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-foreground">
                                                            {r.full_name || `@${r.username}`}
                                                        </p>
                                                        {r.username && (
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                @{r.username}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {label === "friends" ? (
                                                    <span className="shrink-0 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                        {t("friends.tabFriends")}
                                                    </span>
                                                ) : label === "pending_outgoing" ? (
                                                    <span className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                                        {t("friends.requestSent")}
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => sendRequest(r)}
                                                        disabled={sendingId === r.user_id}
                                                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98]"
                                                    >
                                                        <UserPlus size={14} weight="bold" />
                                                        {t("friends.sendRequest")}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
