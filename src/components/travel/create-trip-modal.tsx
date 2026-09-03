"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Airplane, CalendarBlank } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";

interface CreateTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export function CreateTripModal({
    isOpen,
    onClose,
    onCreated,
}: CreateTripModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [destination, setDestination] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [budget, setBudget] = useState("");
    const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setDestination("");
        setStartDate("");
        setEndDate("");
        setBudget("");
        setCurrency("EUR");
        setError(null);
    };

    const handleSubmit = async () => {
        if (!destination.trim()) {
            setError(t("travel.modal.destinationRequired"));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error: insertError } = await supabase.from("trips").insert({
            user_id: user.id,
            destination_name: destination.trim(),
            start_date: startDate || null,
            end_date: endDate || null,
            total_budget: budget ? parseFloat(budget) : null,
            currency,
        });

        if (insertError) {
            setError(insertError.message);
            addToast(insertError.message, "error");
        } else {
            resetForm();
            addToast(t("travel.toast.created"));
            onCreated();
            onClose();
        }
        setIsSubmitting(false);
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
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
                    >
                        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                        <Airplane
                                            size={20}
                                            className="text-foreground/70"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-foreground">
                                            {t("travel.modal.title")}
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            {t("travel.modal.subtitle")}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Form */}
                            <div className="mt-6 space-y-4">
                                {/* Destination */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("travel.modal.destination")}
                                    </label>
                                    <input
                                        type="text"
                                        value={destination}
                                        onChange={(e) =>
                                            setDestination(e.target.value)
                                        }
                                        placeholder={t("travel.modal.destinationPlaceholder")}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                            {t("travel.modal.startDate")}
                                        </label>
                                        <div className="relative">
                                            <CalendarBlank
                                                size={14}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            />
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) =>
                                                    setStartDate(e.target.value)
                                                }
                                                className="w-full rounded-xl border border-border bg-accent py-3 pl-9 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                            {t("travel.modal.endDate")}
                                        </label>
                                        <div className="relative">
                                            <CalendarBlank
                                                size={14}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            />
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) =>
                                                    setEndDate(e.target.value)
                                                }
                                                className="w-full rounded-xl border border-border bg-accent py-3 pl-9 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Budget + Currency */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("travel.modal.budgetOptional")}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={budget}
                                            onChange={(e) =>
                                                setBudget(e.target.value)
                                            }
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                            className="flex-1 rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        />
                                        <div className="flex rounded-xl border border-border p-0.5">
                                            {(["EUR", "USD"] as const).map(
                                                (c) => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() =>
                                                            setCurrency(c)
                                                        }
                                                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${currency === c
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-muted-foreground hover:text-foreground/70"
                                                            }`}
                                                    >
                                                        {c === "EUR"
                                                            ? "€"
                                                            : "$"}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <p className="text-sm text-red-500">
                                        {error}
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground/70 transition-all hover:bg-accent"
                                >
                                    {t("travel.modal.cancel")}
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={
                                        isSubmitting || !destination.trim()
                                    }
                                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting
                                        ? t("travel.modal.creating")
                                        : t("travel.modal.createTrip")}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
