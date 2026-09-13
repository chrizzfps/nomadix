"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, HandCoins, FloppyDisk, Bell } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import {
    validateReceivableForm,
    formValuesToInsert,
    receivableToFormValues,
    type ReceivableFormValues,
} from "@/lib/receivables";
import { ClientPicker } from "./client-picker";
import type { Client, Currency, Receivable } from "@/types";

interface ReceivableVaultOption {
    id: string;
    name: string;
}

interface ReceivableFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    vaults: ReceivableVaultOption[];
    clients: Client[];
    onClientsChanged: () => void;
    editing?: Receivable | null;
    defaultVaultId?: string;
}

const EMPTY_VALUES: ReceivableFormValues = {
    vaultId: "",
    clientId: null,
    clientName: "",
    description: "",
    amount: "",
    currency: "EUR",
    issueDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    reminderEnabled: true,
    reminderDaysBefore: "3",
    notes: "",
};

export function ReceivableFormModal({
    isOpen,
    onClose,
    onSaved,
    vaults,
    clients,
    onClientsChanged,
    editing,
    defaultVaultId,
}: ReceivableFormModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);

    const [values, setValues] = useState<ReceivableFormValues>(EMPTY_VALUES);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (editing) {
            setValues(receivableToFormValues(editing));
        } else {
            setValues({
                ...EMPTY_VALUES,
                vaultId: defaultVaultId || vaults[0]?.id || "",
            });
        }
        setError(null);
        // `vaults` is deliberately NOT a dependency: creating a client
        // inline reloads the whole receivables page (new vaults/clients
        // array references) while this modal is still open, which used to
        // re-run this effect and wipe the entire form -- including the
        // client just picked -- right after it was created.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editing, defaultVaultId]);

    const handleCreateClient = async (name: string): Promise<Client | null> => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error: insertError } = await supabase
            .from("clients")
            .insert({ user_id: user.id, name })
            .select("*")
            .single();

        if (insertError || !data) {
            // A duplicate name (case-insensitive, per client) is not a
            // failure -- just look the existing client up and use it.
            const { data: existing } = await supabase
                .from("clients")
                .select("*")
                .eq("user_id", user.id)
                .ilike("name", name)
                .maybeSingle();
            if (existing) {
                onClientsChanged();
                return existing as Client;
            }
            addToast(insertError?.message || "Failed to add client", "error");
            return null;
        }

        onClientsChanged();
        return data as Client;
    };

    const handleSave = async () => {
        const validationError = validateReceivableForm(values);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSaving(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setIsSaving(false);
            return;
        }

        if (editing) {
            const { error: updateError } = await supabase
                .from("receivables")
                .update({
                    client_id: values.clientId,
                    client_name: values.clientName.trim(),
                    description: values.description.trim(),
                    amount: parseFloat(values.amount) || 0,
                    currency: values.currency,
                    issue_date: values.issueDate,
                    expected_date: values.expectedDate,
                    reminder_days_before: values.reminderEnabled
                        ? parseInt(values.reminderDaysBefore, 10) || 3
                        : 0,
                    notify_in_app: values.reminderEnabled,
                    notes: values.notes.trim() || null,
                })
                .eq("id", editing.id);

            if (updateError) {
                setError(updateError.message);
                addToast(updateError.message, "error");
                setIsSaving(false);
                return;
            }
            addToast(t("receivables.toast.updated"));
        } else {
            const { error: insertError } = await supabase
                .from("receivables")
                .insert(formValuesToInsert(values, user.id));

            if (insertError) {
                setError(insertError.message);
                addToast(insertError.message, "error");
                setIsSaving(false);
                return;
            }
            addToast(t("receivables.toast.created"));
        }

        setIsSaving(false);
        onSaved();
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
                        className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
                                    <HandCoins size={20} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {editing ? t("receivables.editTitle") : t("receivables.newTitle")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {t("receivables.newSubtitle")}
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

                        <div className="mt-6 space-y-5">
                            {vaults.length > 1 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("receivables.field.vault")}
                                    </label>
                                    <select
                                        value={values.vaultId}
                                        onChange={(e) => setValues((v) => ({ ...v, vaultId: e.target.value }))}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    >
                                        {vaults.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    {t("receivables.field.client")}
                                </label>
                                <ClientPicker
                                    clients={clients}
                                    clientId={values.clientId}
                                    clientName={values.clientName}
                                    onChange={(clientId, clientName) =>
                                        setValues((v) => ({ ...v, clientId, clientName }))
                                    }
                                    onCreateClient={handleCreateClient}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    {t("receivables.field.description")}
                                </label>
                                <input
                                    type="text"
                                    placeholder='e.g. "Invoice #204", "Web project — final payment"'
                                    value={values.description}
                                    onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                                    className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("receivables.field.amount")}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={values.amount}
                                        onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("receivables.field.currency")}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(["EUR", "USD"] as Currency[]).map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setValues((v) => ({ ...v, currency: c }))}
                                                className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                                                    values.currency === c
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border bg-card text-muted-foreground hover:border-ring"
                                                }`}
                                            >
                                                {c === "EUR" ? "€" : "$"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("receivables.field.issueDate")}
                                    </label>
                                    <input
                                        type="date"
                                        value={values.issueDate}
                                        onChange={(e) => setValues((v) => ({ ...v, issueDate: e.target.value }))}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        {t("receivables.field.expectedDate")}
                                    </label>
                                    <input
                                        type="date"
                                        value={values.expectedDate}
                                        onChange={(e) => setValues((v) => ({ ...v, expectedDate: e.target.value }))}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 rounded-xl border border-border bg-accent/40 p-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={values.reminderEnabled}
                                            onChange={(e) =>
                                                setValues((v) => ({ ...v, reminderEnabled: e.target.checked }))
                                            }
                                            className="peer sr-only"
                                        />
                                        <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Bell size={16} className="text-foreground/60" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground/80">
                                                {t("receivables.field.reminder")}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {t("receivables.field.reminderHint")}
                                            </p>
                                        </div>
                                    </div>
                                </label>

                                {values.reminderEnabled && (
                                    <div className="flex items-center gap-2 pl-12">
                                        <input
                                            type="number"
                                            min={0}
                                            max={60}
                                            value={values.reminderDaysBefore}
                                            onChange={(e) =>
                                                setValues((v) => ({ ...v, reminderDaysBefore: e.target.value }))
                                            }
                                            className="w-16 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {t("receivables.field.reminderDaysSuffix")}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    {t("receivables.field.notes")}{" "}
                                    <span className="normal-case tracking-normal text-muted-foreground">
                                        ({t("common.optional")})
                                    </span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={values.notes}
                                    onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                                    className="w-full resize-none rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                <FloppyDisk size={16} />
                                {isSaving ? t("common.saving") : t("common.save")}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
