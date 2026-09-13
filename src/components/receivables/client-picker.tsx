"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MagnifyingGlass, Plus, User } from "@phosphor-icons/react";
import { friendInitials } from "@/lib/social";
import type { Client } from "@/types";

interface ClientPickerProps {
    clients: Client[];
    clientId: string | null;
    clientName: string;
    onChange: (clientId: string | null, clientName: string) => void;
    onCreateClient: (name: string) => Promise<Client | null>;
}

// Hand-rolled combobox, matching the rest of the app -- no Radix Combobox,
// no react-hook-form. Typing filters the client list; picking one locks
// clientId to that row; typing a name that doesn't match any client offers
// "Add <name> as a new client", which inserts the row and locks onto it.
export function ClientPicker({
    clients,
    clientId,
    clientName,
    onChange,
    onCreateClient,
}: ClientPickerProps) {
    const [query, setQuery] = useState(clientName);
    const [open, setOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const activeClients = useMemo(() => clients.filter((c) => !c.is_archived), [clients]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return activeClients;
        return activeClients.filter((c) => c.name.toLowerCase().includes(q));
    }, [activeClients, query]);

    const exactMatch = activeClients.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

    const selectClient = (client: Client) => {
        setQuery(client.name);
        onChange(client.id, client.name);
        setOpen(false);
    };

    const handleCreate = async () => {
        const name = query.trim();
        if (!name || isCreating) return;
        setIsCreating(true);
        const created = await onCreateClient(name);
        setIsCreating(false);
        if (created) {
            setQuery(created.name);
            onChange(created.id, created.name);
        }
        setOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                    type="text"
                    placeholder="Search or add a client…"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(null, e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 120)}
                    className="w-full rounded-xl border border-border bg-accent py-3 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
            </div>

            <AnimatePresence>
                {open && (query.trim().length > 0 || activeClients.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl"
                    >
                        {filtered.length === 0 && (
                            <p className="px-2.5 py-2 text-xs text-muted-foreground">
                                No matching clients.
                            </p>
                        )}
                        {filtered.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectClient(c)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent ${
                                    clientId === c.id ? "bg-accent" : ""
                                }`}
                            >
                                <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                    style={{ backgroundColor: c.color }}
                                >
                                    {friendInitials(c.name)}
                                </div>
                                <span className="text-sm font-medium text-foreground">{c.name}</span>
                            </button>
                        ))}
                        {query.trim().length > 0 && !exactMatch && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={handleCreate}
                                disabled={isCreating}
                                className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg border border-dashed border-border px-2.5 py-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-accent disabled:opacity-50"
                            >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground">
                                    {isCreating ? <User size={13} /> : <Plus size={13} weight="bold" />}
                                </div>
                                {isCreating ? "Adding…" : `Add "${query.trim()}" as a new client`}
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
