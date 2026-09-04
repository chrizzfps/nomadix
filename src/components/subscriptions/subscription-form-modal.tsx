"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Repeat, CalendarBlank, CaretDown } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
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
    "w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors";
const labelClass = "text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground";

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
        <div className="flex items-center justify-between rounded-xl border border-border bg-accent px-4 py-3">
            <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <label className="relative shrink-0 cursor-pointer">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
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
    const t = useLanguageStore((s) => s.t);

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
            setError(t("subs.form.mustBeLoggedIn"));
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
            addToast(t("subs.toast.updated"));
        } else {
            const { error: insertError } = await supabase.from("subscriptions").insert(payload);
            if (insertError) {
                setError(insertError.message);
                setIsSubmitting(false);
                return;
            }
            addToast(t("subs.toast.created"));
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
                        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-border px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                    <Repeat size={20} className="text-foreground/70" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {editing ? t("subs.form.editTitle") : t("subs.form.newTitle")}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {t("subs.form.subtitle")}
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

                        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                            {error && (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            {/* Essentials */}
                            <div className="space-y-4">
                                <div className="flex rounded-xl border border-border p-0.5">
                                    {(["expense", "income"] as SubscriptionDirection[]).map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => set("direction", d)}
                                            className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all ${
                                                values.direction === d
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:text-foreground/80"
                                            }`}
                                        >
                                            {d === "expense" ? t("subs.form.expense") : t("subs.form.income")}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-1.5">
                                    <label className={labelClass}>{t("subs.form.name")}</label>
                                    <input
                                        value={values.name}
                                        onChange={(e) => set("name", e.target.value)}
                                        placeholder={t("subs.form.namePlaceholder")}
                                        className={inputClass}
                                    />
                                </div>

                                <div className="grid grid-cols-[1fr_90px] gap-3">
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>{t("subs.form.amount")}</label>
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
                                        <label className={labelClass}>{t("subs.form.currency")}</label>
                                        <div className="flex rounded-xl border border-border p-0.5">
                                            {(["EUR", "USD"] as const).map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => set("currency", c)}
                                                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                                                        values.currency === c
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-muted-foreground hover:text-foreground/70"
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
                                        <label className={labelClass}>{t("subs.form.vault")}</label>
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
                                        <label className={labelClass}>{t("subs.form.category")}</label>
                                        <select
                                            value={values.category}
                                            onChange={(e) => set("category", e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="">{t("subs.form.none")}</option>
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
                                        <label className={labelClass}>{t("subs.form.billingCycle")}</label>
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
                                        <label className={labelClass}>{t("subs.form.every")}</label>
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
                                        <label className={labelClass}>{t("subs.form.customIntervalDays")}</label>
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
                                        <label className={labelClass}>{t("subs.form.startDate")}</label>
                                        <div className="relative">
                                            <CalendarBlank
                                                size={14}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                                        <label className={labelClass}>{t("subs.form.anchorDay")}</label>
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
                                <p className="-mt-2 text-[11px] text-muted-foreground">
                                    {t("subs.form.anchorHint")}
                                </p>
                            </div>

                            {/* Schedule & lifecycle */}
                            <details className="group rounded-xl border border-border">
                                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground/80">
                                    {t("subs.form.scheduleLifecycle")}
                                    <CaretDown
                                        size={14}
                                        className="text-muted-foreground transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <div className="space-y-4 border-t border-border p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>{t("subs.form.endDate")}</label>
                                            <input
                                                type="date"
                                                value={values.endDate}
                                                onChange={(e) => set("endDate", e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>{t("subs.form.reminderDaysBefore")}</label>
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
                                            <label className={labelClass}>{t("subs.form.trialEnds")}</label>
                                            <input
                                                type="date"
                                                value={values.trialEndDate}
                                                onChange={(e) => set("trialEndDate", e.target.value)}
                                                className={inputClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>{t("subs.form.trialAmount")}</label>
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
                                        label={t("subs.form.variableAmount")}
                                        hint={t("subs.form.variableAmountHint")}
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
                                        label={t("subs.form.autoCharge")}
                                        hint={t("subs.form.autoChargeHint")}
                                        checked={values.autoCharge && !values.isVariableAmount}
                                        onChange={(v) => set("autoCharge", v)}
                                    />
                                </div>
                            </details>

                            {/* Extras */}
                            <details className="group rounded-xl border border-border">
                                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground/80">
                                    {t("subs.form.extras")}
                                    <CaretDown
                                        size={14}
                                        className="text-muted-foreground transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <div className="space-y-4 border-t border-border p-4">
                                    <div className="grid grid-cols-[1fr_100px] gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>{t("subs.form.fee")}</label>
                                            <div className="flex rounded-xl border border-border p-0.5">
                                                {SUBSCRIPTION_FEE_MODES.map((m) => (
                                                    <button
                                                        key={m.value}
                                                        type="button"
                                                        onClick={() => set("feeMode", m.value)}
                                                        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                                                            values.feeMode === m.value
                                                                ? "bg-primary text-primary-foreground"
                                                                : "text-muted-foreground hover:text-foreground/80"
                                                        }`}
                                                    >
                                                        {m.value === "none"
                                                            ? t("subs.form.feeNone")
                                                            : m.value === "fixed"
                                                                ? t("subs.form.feeFixed")
                                                                : "%"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>
                                                {t("subs.form.value")}
                                                {values.feeMode === "fixed" && (
                                                    <span className="ml-1 normal-case text-muted-foreground">
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
                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
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
                                        <p className="-mt-2 text-[11px] text-muted-foreground">
                                            {t("subs.form.feeCurrencyHint", { currency: values.currency })}
                                        </p>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className={labelClass}>{t("subs.form.cancelUrl")}</label>
                                        <input
                                            value={values.cancelUrl}
                                            onChange={(e) => set("cancelUrl", e.target.value)}
                                            placeholder="https://…"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className={labelClass}>{t("subs.form.notes")}</label>
                                        <input
                                            value={values.notes}
                                            onChange={(e) => set("notes", e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>

                                    <div className="grid grid-cols-[1fr_90px] gap-3">
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>{t("subs.form.icon")}</label>
                                            <select
                                                value={values.iconKey}
                                                onChange={(e) => set("iconKey", e.target.value)}
                                                className={inputClass}
                                            >
                                                <option value="">{t("subs.form.default")}</option>
                                                {iconKeys.map((k) => (
                                                    <option key={k} value={k}>
                                                        {k}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>{t("subs.form.color")}</label>
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
                            <div className="border-t border-border bg-accent px-6 py-3 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground/80">{t("subs.form.next3Charges")}</span> —{" "}
                                {preview.dates} · {preview.each} · {preview.monthly} · {preview.annual}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-accent"
                            >
                                {t("subs.form.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting
                                    ? t("subs.form.saving")
                                    : editing
                                        ? t("subs.form.saveChanges")
                                        : t("subs.form.createSubscription")}
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
