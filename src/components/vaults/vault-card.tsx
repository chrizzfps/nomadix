"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    DotsThree,
    ShieldCheck,
    CurrencyEur,
    CurrencyDollar,
    ArrowRight,
    PencilSimple,
    Trash,
} from "@phosphor-icons/react";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { EditVaultModal } from "./edit-vault-modal";

interface VaultCardProps {
    id: string;
    name: string;
    balance: number;
    currency: string;
    type: "savings" | "checking" | "cash";
    isProtected?: boolean;
    onClick?: () => void;
    onUpdated?: () => void;
}

const typeGradients: Record<string, string> = {
    checking: "from-zinc-900 to-zinc-800",
    savings: "from-zinc-800 to-zinc-700",
    cash: "from-zinc-700 to-zinc-600",
};

const typeLabels: Record<string, string> = {
    checking: "Checking",
    savings: "Savings",
    cash: "Cash",
};

function EquivalentBalance({ balance, currency }: { balance: number; currency: string }) {
    const { getActiveRate } = useCurrencyStore();
    const otherCurrency = currency === "USD" ? "EUR" : "USD";
    const otherSymbol = CURRENCY_SYMBOLS[otherCurrency] || "$";
    const rate = getActiveRate();
    // USD→EUR: multiply by rate, EUR→USD: divide by rate
    const converted = currency === "USD"
        ? Math.abs(balance) * rate
        : Math.abs(balance) / rate;
    return (
        <p className="mt-0.5 text-xs font-medium text-zinc-400/70">
            ≈ {otherSymbol}
            {converted.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}
        </p>
    );
}

export function VaultCard({
    id,
    name,
    balance,
    currency,
    type,
    isProtected = false,
    onClick,
    onUpdated,
}: VaultCardProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const symbol = CURRENCY_SYMBOLS[currency] || "$";
    const gradient = typeGradients[type] || typeGradients.checking;

    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
                setConfirmDelete(false);
            }
        }
        if (menuOpen)
            document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    const handleDelete = async () => {
        if (isProtected) {
            addToast("Protected vaults cannot be deleted", "error");
            setMenuOpen(false);
            setConfirmDelete(false);
            return;
        }

        const { error } = await supabase.from("vaults").delete().eq("id", id);

        if (error) {
            addToast(error.message, "error");
        } else {
            addToast("Vault deleted");
            onUpdated?.();
        }
        setMenuOpen(false);
        setConfirmDelete(false);
    };

    return (
        <>
            <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClick}
                className={`relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg transition-shadow hover:shadow-xl`}
            >
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white" />
                    <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-white" />
                </div>

                {/* Header */}
                <div className="relative flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        {currency === "EUR" ? (
                            <CurrencyEur
                                size={18}
                                weight="bold"
                                className="text-zinc-400"
                            />
                        ) : (
                            <CurrencyDollar
                                size={18}
                                weight="bold"
                                className="text-zinc-400"
                            />
                        )}
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {typeLabels[type]}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isProtected && (
                            <ShieldCheck
                                size={16}
                                weight="fill"
                                className="text-zinc-400"
                            />
                        )}
                        {/* 3-dot menu */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(!menuOpen);
                                    setConfirmDelete(false);
                                }}
                                className="rounded-lg p-1 transition-colors hover:bg-white/10"
                            >
                                <DotsThree
                                    size={18}
                                    weight="bold"
                                    className="text-zinc-400"
                                />
                            </button>

                            {/* Dropdown */}
                            <AnimatePresence>
                                {menuOpen && (
                                    <motion.div
                                        initial={{
                                            opacity: 0,
                                            scale: 0.9,
                                            y: -4,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            scale: 1,
                                            y: 0,
                                        }}
                                        exit={{
                                            opacity: 0,
                                            scale: 0.9,
                                            y: -4,
                                        }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-8 z-50 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {!confirmDelete ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        setShowEdit(true);
                                                    }}
                                                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                                                >
                                                    <PencilSimple size={15} />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setConfirmDelete(true)
                                                    }
                                                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                                                >
                                                    <Trash size={15} />
                                                    Delete
                                                </button>
                                            </>
                                        ) : (
                                            <div className="p-3">
                                                <p className="text-xs font-medium text-zinc-700">
                                                    Delete this vault?
                                                </p>
                                                <p className="mt-1 text-[11px] text-zinc-400">
                                                    All transactions will be
                                                    lost.
                                                </p>
                                                <div className="mt-3 flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setConfirmDelete(
                                                                false
                                                            );
                                                            setMenuOpen(false);
                                                        }}
                                                        className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleDelete}
                                                        className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Balance */}
                <div className="relative mt-8">
                    <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                        Balance
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">
                        {symbol}
                        {Math.abs(balance).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </p>
                    <EquivalentBalance balance={balance} currency={currency} />
                </div>

                {/* Footer */}
                <div className="relative mt-6 flex items-center justify-between">
                    <p className="text-sm font-medium">{name}</p>
                    <ArrowRight
                        size={16}
                        weight="bold"
                        className="text-zinc-400"
                    />
                </div>

                {/* Card shine effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none" />
            </motion.div>

            {/* Edit Modal */}
            <EditVaultModal
                isOpen={showEdit}
                onClose={() => setShowEdit(false)}
                onUpdated={() => onUpdated?.()}
                vault={{
                    id,
                    name,
                    currency,
                    type,
                    is_protected: isProtected,
                    balance,
                }}
            />
        </>
    );
}
