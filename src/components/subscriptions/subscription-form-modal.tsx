"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Repeat, CalendarBlank, CaretDown } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { BILLING_CYCLES, SUBSCRIPTION_FEE_MODES } from "@/lib/constants";
import { CATEGORY_ICON_MAP, normalizeHexColor } from "@/lib/transaction-categories";
import {
    validateSubscriptionForm,
    formValuesToInsert,
    subscriptionToFormValues,
    nextDueDate,
    initialNextDueDate,
    monthlyEquivalent,
    annualEquivalent,
    costPerCycle,
    todayISO,
    formatDueDateShort,
    type SubscriptionFormValues,
} from "@/lib/subscriptions";
import type { Subscription, SubscriptionDirection } from "@/types";

interface VaultOption {
    id: string;
    name: string;
    currency: "EUR" | "USD";
}

interface SubscriptionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    vaults: VaultOption[];
    editing: Subscription | null;
}

const EMPTY_FORM: SubscriptionFormValues = {
    name: "",
    merchant: "",
    description: "",
    category: "",
    vaultId: "",
    direction: "expense",
    amount: "",
    currency: "EUR",
    isVariableAmount: false,
    feeMode: "none",
    feeValue: "",
    billingCycle: "monthly",
    intervalCount: "1",
    customIntervalDays: "",
    anchorDay: "",
    startDate: todayISO(),
    endDate: "",
    trialEndDate: "",
    trialAmount: "",
    autoCharge: true,
    reminderDaysBefore: "3",
    cancelUrl: "",
    notes: "",
    iconKey: "",
    color: "#18181b",
};

const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors";
const labelClass = "text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400";

function ToggleField({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div>
                <p className="text-sm font-semibold text-zinc-900">{label}</p>
                <p className="text-xs text-zinc-400">{hint}</p>
            </div>
            <label className="relative shrink-0 cursor-pointer">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-zinc-200 transition-colors peer-checked:bg-zinc-900" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </label>
        </div>
    );
}

export function SubscriptionFormModal({
    isOpen,
    onClose,
    onSaved,
    vaults,
    editing,
}: SubscriptionFormModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [values, setValues] = useState<SubscriptionFormValues>(EMPTY_FORM);
    const [categories, setCategories] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        if (editing) {
            setValues(subscriptionToFormValues(editing));
        } else {
            setValues({
                ...EMPTY_FORM,
                vaultId: vaults[0]?.id || "",
                currency: vaults[0]?.currency || "EUR",
            });
        }
    }, [isOpen, editing, vaults]);

    useEffect(() => {
        if (!isOpen) return;
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("transaction_categories")
                .select("name,is_active")
                .eq("user_id", user.id)
                .order("name", { ascending: true });
            const active = (data || [])
                .filter((r: { is_active: boolean }) => r.is_active)
                .map((r: { name: string }) => r.name);
            setCategories(active);
        })();
    }, [isOpen, supabase]);

    const set = <K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) =>
        setValues((prev) => ({ ...prev, [key]: value }));

    const preview = useMemo(() => {
        if (!values.startDate || !values.amount) return null;
        const amount = parseFloat(values.amount);
        if (Number.isNaN(amount)) return null;

        const intervalCount = parseInt(values.intervalCount, 10) || 1;
        const customDays =
            values.billingCycle === "custom_days"
                ? parseInt(values.customIntervalDays, 10) || null
                : null;
        const anchorDay = values.anchorDay ? parseInt(values.anchorDay, 10) : null;

        const first = initialNextDueDate(
            values.startDate,
            values.billingCycle,
            intervalCount,
            customDays,
            anchorDay
        );
        const dates = [first];
        for (let i = 0; i < 2; i++) {
            dates.push(
                nextDueDate(dates[dates.length - 1], values.billingCycle, intervalCount, customDays, anchorDay)
            );
        }

        const partial: Subscription = {
            ...subscriptionToFormValuesReverse(values),
        };
        const monthly = monthlyEquivalent(partial);
        const annual = annualEquivalent(partial);
        const perCharge = costPerCycle(partial);
        const symbol = values.currency === "EUR" ? "€" : "$";

        return {
            dates: dates.map(formatDueDateShort).join(" · "),
            monthly: `${symbol}${monthly.toFixed(2)}/mo`,
            annual: `${symbol}${annual.toFixed(2)}/yr`,
            each: `${symbol}${perCharge.toFixed(2)} each`,
        };
    }, [values]);

    const handleSubmit = async () => {
        const msg = validateSubscriptionForm(values);
        if (msg) {
            setError(msg);
            return;
        }
        setIsSubmitting(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setError("You must be logged in.");
            setIsSubmitting(false);
            return;
        }

        const payload = formValuesToInsert(values, user.id);

        if (editing) {
            const { error: updateError } = await supabase
                .from("subscriptions")
                .update(payload)
                .eq("id", editing.id);
            if (updateError) {
                setError(updateError.message);
                setIsSubmitting(false);
                return;
            }
            addToast("Subscription updated");
        } else {
            const { error: insertError } = await supabase.from("subscriptions").insert(payload);
            if (insertError) {
                setError(insertError.message);
                setIsSubmitting(false);
                return;
            }
            addToast("Subscription created");
        }

        setIsSubmitting(false);
        onSaved();
        onClose();
    };

    const iconKeys = Object.keys(CATEGORY_ICON_MAP);

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
                        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                                    <Repeat size={20} className="text-zinc-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900">
                                        {editing ? "Edit Subscription" : "New Subscription"}
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Recurring payment or income
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                            {error && (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            {/* Essentials */}
                            <div className="space-y-4">
                                <div className="flex rounded-xl border border-zinc-200 p-0.5">
                                    {(["expense", "income"] as SubscriptionDirection[]).map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => set("direction", d)}
                                            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all ${
                                                values.direction === d
                                                    ? "bg-zinc-900 text-white"
                                                    : "text-zinc-500 hover:text-zinc-700"
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>Name</label>
                                    <input
                                        value={values.name}
                                        onChange={(e) => set("name", e.target.value)}
                                        placeholder="e.g. Netflix"
                                        className={inputClass}
                                    />
                                </div>

                                <div className="grid grid-cols-[1fr_90px] gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Amount</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={values.amount}
                                            onChange={(e) => set("amount", e.target.value)}
                                            placeholder="0.00"
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Currency</label>
                                        <div className="flex rounded-xl border border-zinc-200 p-0.5">
                                            {(["EUR", "USD"] as const).map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => set("currency", c)}
                                                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                                                        values.currency === c
                                                            ? "bg-zinc-900 text-white"
                                                            : "text-zinc-400 hover:text-zinc-600"
                                                    }`}
                                                >
                                                    {c === "EUR" ? "€" : "$"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Vault</label>
                                        <select
                                            value={values.vaultId}
                                            onChange={(e) => set("vaultId", e.target.value)}
                                            className={inputClass}
                                        >
                                            {vaults.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name} ({v.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Category</label>
                                        <select
                                            value={values.category}
                                            onChange={(e) => set("category", e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="">None</option>
                                            {categories.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[1fr_80px] gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Billing cycle</label>
                                        <select
                                            value={values.billingCycle}
                                            onChange={(e) =>
                                                set("billingCycle", e.target.value as SubscriptionFormValues["billingCycle"])
                                            }
                                            className={inputClass}
                                        >
                                            {BILLING_CYCLES.map((c) => (
                                                <option key={c.value} value={c.value}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Every</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={values.intervalCount}
                                            onChange={(e) => set("intervalCount", e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                {values.billingCycle === "custom_days" && (
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Custom interval (days)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={values.customIntervalDays}
                                            onChange={(e) => set("customIntervalDays", e.target.value)}
                                            placeholder="45"
                                            className={inputClass}
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Start date</label>
                                        <div className="relative">
                                            <CalendarBlank
                                                size={14}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                                            />
                                            <input
                                                type="date"
                                                value={values.startDate}
                                                onChange={(e) => set("startDate", e.target.value)}
                                                className={`${inputClass} pl-9`}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Anchor day (optional)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={values.anchorDay}
                                            onChange={(e) => set("anchorDay", e.target.value)}
                                            placeholder="auto"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <p className="-mt-2 text-[11px] text-zinc-400">
                                    Charged on day 31; short months use the last day.
                                </p>
                            </div>

                            {/* Schedule & lifecycle */}
                            <details className="group rounded-xl border border-zinc-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700">
                                    Schedule & lifecycle
                                    <CaretDown
                                        size={14}
                                        className="text-zinc-400 transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <div className="space-y-4 border-t border-zinc-100 p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>End date (optional)</label>
                                            <input
                                                type="date"
                                                value={values.endDate}
                                                onChange={(e) => set("endDate", e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Reminder (days before)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="60"
                                                value={values.reminderDaysBefore}
                                                onChange={(e) => set("reminderDaysBefore", e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Trial ends (optional)</label>
                                            <input
                                                type="date"
                                                value={values.trialEndDate}
                                                onChange={(e) => set("trialEndDate", e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Trial amount</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={values.trialAmount}
                                                onChange={(e) => set("trialAmount", e.target.value)}
                                                placeholder="0.00"
                                                disabled={!values.trialEndDate}
                                                className={`${inputClass} disabled:opacity-50`}
                                            />
                                        </div>
                                    </div>

                                    <ToggleField
                                        label="Variable amount"
                                        hint="You'll be asked to confirm the amount each cycle"
                                        checked={values.isVariableAmount}
                                        onChange={(v) =>
                                            setValues((prev) => ({
                                                ...prev,
                                                isVariableAmount: v,
                                                autoCharge: v ? false : prev.autoCharge,
                                            }))
                                        }
                                    />

                                    <ToggleField
                                        label="Auto-charge"
                                        hint="Charge automatically on the due date"
                                        checked={values.autoCharge && !values.isVariableAmount}
                                        onChange={(v) => set("autoCharge", v)}
                                    />
                                </div>
                            </details>

                            {/* Extras */}
                            <details className="group rounded-xl border border-zinc-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700">
                                    Extras
                                    <CaretDown
                                        size={14}
                                        className="text-zinc-400 transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <div className="space-y-4 border-t border-zinc-100 p-4">
                                    <div className="grid grid-cols-[1fr_100px] gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Fee</label>
                                            <div className="flex rounded-xl border border-zinc-200 p-0.5">
                                                {SUBSCRIPTION_FEE_MODES.map((m) => (
                                                    <button
                                                        key={m.value}
                                                        type="button"
                                                        onClick={() => set("feeMode", m.value)}
                                                        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                                                            values.feeMode === m.value
                                                                ? "bg-zinc-900 text-white"
                                                                : "text-zinc-500 hover:text-zinc-700"
                                                        }`}
                                                    >
                                                        {m.value === "none"
                                                            ? "None"
                                                            : m.value === "fixed"
                                                                ? "Fixed"
                                                                : "%"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>
                                                Value
                                                {values.feeMode === "fixed" && (
                                                    <span className="ml-1 normal-case text-zinc-300">
                                                        ({values.currency === "EUR" ? "€" : "$"})
                                                    </span>
                                                )}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={values.feeValue}
                                                    onChange={(e) => set("feeValue", e.target.value)}
                                                    disabled={values.feeMode === "none"}
                                                    className={`${inputClass} disabled:opacity-50 ${values.feeMode !== "none" ? "pr-7" : ""}`}
                                                />
                                                {values.feeMode !== "none" && (
                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
                                                        {values.feeMode === "percent"
                                                            ? "%"
                                                            : values.currency === "EUR"
                                                                ? "€"
                                                                : "$"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {values.feeMode !== "none" && (
                                        <p className="-mt-2 text-[11px] text-zinc-400">
                                            Fee is charged in the subscription&apos;s currency ({values.currency}), same as the amount.
                                        </p>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Cancellation URL</label>
                                        <input
                                            value={values.cancelUrl}
                                            onChange={(e) => set("cancelUrl", e.target.value)}
                                            placeholder="https://…"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Notes</label>
                                        <input
                                            value={values.notes}
                                            onChange={(e) => set("notes", e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>

                                    <div className="grid grid-cols-[1fr_90px] gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Icon</label>
                                            <select
                                                value={values.iconKey}
                                                onChange={(e) => set("iconKey", e.target.value)}
                                                className={inputClass}
                                            >
                                                <option value="">Default</option>
                                                {iconKeys.map((k) => (
                                                    <option key={k} value={k}>
                                                        {k}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Color</label>
                                            <input
                                                value={values.color}
                                                onChange={(e) => set("color", normalizeHexColor(e.target.value))}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>

                        {preview && (
                            <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 text-xs text-zinc-500">
                                <span className="font-semibold text-zinc-700">Next 3 charges</span> —{" "}
                                {preview.dates} · {preview.each} · {preview.monthly} · {preview.annual}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? "Saving..." : editing ? "Save changes" : "Create subscription"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Builds just enough of a Subscription shape for the pure cost-math helpers
// (monthlyEquivalent/annualEquivalent only read amount/billing_cycle/interval_count/custom_interval_days).
function subscriptionToFormValuesReverse(v: SubscriptionFormValues): Subscription {
    const amount = parseFloat(v.amount) || 0;
    return {
        id: "preview",
        user_id: "preview",
        vault_id: v.vaultId,
        name: v.name,
        merchant: null,
        description: null,
        category: null,
        icon_key: null,
        color: v.color,
        cancel_url: null,
        notes: null,
        direction: v.direction,
        amount,
        currency: v.currency,
        is_variable_amount: v.isVariableAmount,
        fee_mode: v.feeMode,
        fee_value: parseFloat(v.feeValue) || 0,
        billing_cycle: v.billingCycle,
        interval_count: parseInt(v.intervalCount, 10) || 1,
        custom_interval_days: v.customIntervalDays ? parseInt(v.customIntervalDays, 10) : null,
        anchor_day: v.anchorDay ? parseInt(v.anchorDay, 10) : null,
        start_date: v.startDate,
        end_date: v.endDate || null,
        next_due_date: v.startDate,
        last_charged_date: null,
        trial_end_date: v.trialEndDate || null,
        trial_amount: parseFloat(v.trialAmount) || 0,
        status: "active",
        auto_charge: v.autoCharge,
        canceled_at: null,
        reminder_days_before: parseInt(v.reminderDaysBefore, 10) || 3,
        notify_in_app: true,
        notify_email: false,
        last_reminder_seen_at: null,
        last_email_sent_at: null,
        created_at: "",
        updated_at: "",
    };
}
