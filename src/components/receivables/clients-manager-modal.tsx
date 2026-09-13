"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Archive, ArrowCounterClockwise, UsersThree } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { friendInitials } from "@/lib/social";
import type { Client } from "@/types";

interface ClientsManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onChanged: () => void;
}

export function ClientsManagerModal({ isOpen, onClose, clients, onChanged }: ClientsManagerModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);
    const [newName, setNewName] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async () => {
        const name = newName.trim();
        if (!name || isAdding) return;
        setIsAdding(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setIsAdding(false);
            return;
        }

        const { error } = await supabase.from("clients").insert({ user_id: user.id, name });
        setIsAdding(false);

        if (error) {
            addToast(error.message, "error");
            return;
        }
        setNewName("");
        onChanged();
    };

    const toggleArchived = async (client: Client) => {
        const { error } = await supabase
            .from("clients")
            .update({ is_archived: !client.is_archived })
            .eq("id", client.id);
        if (error) {
            addToast(error.message, "error");
            return;
        }
        onChanged();
    };

    const active = clients.filter((c) => !c.is_archived);
    const archived = clients.filter((c) => c.is_archived);

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
                        className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                    <UsersThree size={20} className="text-foreground/70" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {t("receivables.clients.title")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {t("receivables.clients.subtitle")}
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

                        <div className="mt-5 flex gap-2">
                            <input
                                type="text"
                                placeholder={t("receivables.clients.addPlaceholder")}
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                className="flex-1 rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                            />
                            <button
                                onClick={handleAdd}
                                disabled={!newName.trim() || isAdding}
                                className="flex items-center justify-center rounded-xl bg-primary px-4 text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                            >
                                <Plus size={16} weight="bold" />
                            </button>
                        </div>

                        <div className="mt-4 space-y-1">
                            {active.length === 0 && archived.length === 0 && (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    {t("receivables.clients.empty")}
                                </p>
                            )}
                            {active.map((c) => (
                                <div
                                    key={c.id}
                                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent"
                                >
                                    <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                        style={{ backgroundColor: c.color }}
                                    >
                                        {friendInitials(c.name)}
                                    </div>
                                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                                        {c.name}
                                    </span>
                                    <button
                                        onClick={() => toggleArchived(c)}
                                        title={t("receivables.clients.archive")}
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground/70"
                                    >
                                        <Archive size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {archived.length > 0 && (
                            <div className="mt-4 space-y-1 border-t border-border pt-4">
                                <p className="px-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                    {t("receivables.clients.archived")}
                                </p>
                                {archived.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 rounded-xl px-2 py-2 opacity-60 transition-colors hover:bg-accent hover:opacity-100"
                                    >
                                        <div
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                            style={{ backgroundColor: c.color }}
                                        >
                                            {friendInitials(c.name)}
                                        </div>
                                        <span className="flex-1 truncate text-sm font-medium text-foreground">
                                            {c.name}
                                        </span>
                                        <button
                                            onClick={() => toggleArchived(c)}
                                            title={t("receivables.clients.unarchive")}
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground/70"
                                        >
                                            <ArrowCounterClockwise size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
