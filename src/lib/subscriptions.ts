// ============================================
// Subscriptions & Recurring Payments — pure logic
// ============================================
//
// Every number the subscriptions module shows comes from this file. Nothing
// arithmetic may live inline in a component — that is what let
// transfer-math.test.ts drift out of sync with transaction-edit-modal.tsx.
//
// nextDueDate() is an EXACT mirror of public.nomadix_next_due_date() in
// supabase/schema.sql. If you change one, change the other and re-run the
// parity check documented at the bottom of that file.

import type {
    BillingCycle,
    Currency,
    Subscription,
    SubscriptionDirection,
    SubscriptionFeeMode,
    SubscriptionOccurrence,
} from "@/types";
import { normalizeHexColor } from "@/lib/transaction-categories";

// ============================================
// Date primitives (no date library, no TZ drift)
// ============================================
// All ISO dates are pure calendar dates ("YYYY-MM-DD") with no time-of-day
// meaning. Arithmetic is done via Date.UTC exclusively so it never shifts
// with the browser's local timezone or DST.

export function parseISODate(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function toISODate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** "Today" in the viewer's local calendar day (not UTC) — what a human means by "today". */
export function todayISO(now: Date = new Date()): string {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function addDaysISO(iso: string, days: number): string {
    const d = parseISODate(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
    const a = parseISODate(fromISO).getTime();
    const b = parseISODate(toISO).getTime();
    return Math.round((b - a) / 86400000);
}

export function daysUntil(iso: string, todayIso: string = todayISO()): number {
    return daysBetween(todayIso, iso);
}

export function formatDueDate(iso: string): string {
    return parseISODate(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

export function formatDueDateShort(iso: string): string {
    return parseISODate(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

// ============================================
// Recurrence — exact mirror of nomadix_next_due_date()
// ============================================

export function nextDueDate(
    fromISO: string,
    cycle: BillingCycle,
    intervalCount: number = 1,
    customDays: number | null = null,
    anchorDay: number | null = null
): string {
    const n = Math.max(intervalCount || 1, 1);

    if (cycle === "weekly") return addDaysISO(fromISO, 7 * n);
    if (cycle === "biweekly") return addDaysISO(fromISO, 14 * n);
    if (cycle === "custom_days") {
        const days = Math.max(customDays ?? 30, 1);
        return addDaysISO(fromISO, days * n);
    }

    const months =
        cycle === "monthly"
            ? 1 * n
            : cycle === "quarterly"
                ? 3 * n
                : cycle === "semiannual"
                    ? 6 * n
                    : cycle === "yearly"
                        ? 12 * n
                        : 1 * n;

    // Move to the target month FIRST, then clamp the day to that month's
    // last day. This ordering is why Jan 31 -> Feb 28 -> Mar 31 (not Mar
    // 28): the anchor is re-applied against the new month, never carried
    // forward from an already-clamped date.
    const from = parseISODate(fromISO);
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth();
    const targetIndex = m + months;
    const targetYear = y + Math.floor(targetIndex / 12);
    const targetMonth = ((targetIndex % 12) + 12) % 12;

    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(anchorDay ?? from.getUTCDate(), lastDay);

    return toISODate(new Date(Date.UTC(targetYear, targetMonth, day)));
}

export function upcomingDueDates(
    sub: Pick<
        Subscription,
        | "next_due_date"
        | "billing_cycle"
        | "interval_count"
        | "custom_interval_days"
        | "anchor_day"
        | "end_date"
        | "status"
    >,
    count: number
): string[] {
    if (sub.status !== "active") return [];
    const out: string[] = [];
    let due = sub.next_due_date;
    for (let i = 0; i < count; i++) {
        if (sub.end_date && due > sub.end_date) break;
        out.push(due);
        due = nextDueDate(
            due,
            sub.billing_cycle,
            sub.interval_count,
            sub.custom_interval_days,
            sub.anchor_day
        );
    }
    return out;
}

export function dueDatesWithin(
    sub: Subscription,
    fromISO: string,
    toISO: string,
    maxIterations: number = 500
): string[] {
    if (sub.status !== "active") return [];
    const out: string[] = [];
    let due = sub.next_due_date;
    let i = 0;
    while (due <= toISO && i < maxIterations) {
        i++;
        if (sub.end_date && due > sub.end_date) break;
        if (due >= fromISO) out.push(due);
        due = nextDueDate(
            due,
            sub.billing_cycle,
            sub.interval_count,
            sub.custom_interval_days,
            sub.anchor_day
        );
    }
    return out;
}

/** For a new rule: the first due date on or after today. */
export function initialNextDueDate(
    startISO: string,
    cycle: BillingCycle,
    intervalCount: number,
    customDays: number | null,
    anchorDay: number | null,
    todayIso: string = todayISO()
): string {
    if (startISO >= todayIso) return startISO;
    let due = startISO;
    let i = 0;
    while (due < todayIso && i < 1000) {
        due = nextDueDate(due, cycle, intervalCount, customDays, anchorDay);
        i++;
    }
    return due;
}

// ============================================
// Cost math
// ============================================

const AVG_YEAR_DAYS = 365.25;
const AVG_MONTH_DAYS = AVG_YEAR_DAYS / 12; // 30.4375 — keeps monthly*12 === annual exactly

function round2(x: number): number {
    return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Average length of one billing cycle, in days. */
export function cycleDays(
    cycle: BillingCycle,
    intervalCount: number = 1,
    customDays: number | null = null
): number {
    const n = Math.max(intervalCount || 1, 1);
    switch (cycle) {
        case "weekly":
            return 7 * n;
        case "biweekly":
            return 14 * n;
        case "monthly":
            return AVG_MONTH_DAYS * n;
        case "quarterly":
            return AVG_MONTH_DAYS * 3 * n;
        case "semiannual":
            return AVG_MONTH_DAYS * 6 * n;
        case "yearly":
            return AVG_YEAR_DAYS * n;
        case "custom_days":
            return Math.max(customDays ?? 30, 1) * n;
        default:
            return AVG_MONTH_DAYS * n;
    }
}

export function cycleLabel(
    cycle: BillingCycle,
    intervalCount: number = 1,
    customDays: number | null = null
): string {
    const n = Math.max(intervalCount || 1, 1);
    if (cycle === "custom_days") {
        const days = Math.max(customDays ?? 30, 1) * n;
        return `Every ${days} day${days === 1 ? "" : "s"}`;
    }
    if (cycle === "weekly") return n === 1 ? "Weekly" : `Every ${n} weeks`;
    if (cycle === "biweekly") return n === 1 ? "Every 2 weeks" : `Every ${n * 2} weeks`;
    if (cycle === "monthly") return n === 1 ? "Monthly" : `Every ${n} months`;
    if (cycle === "quarterly") return n === 1 ? "Every 3 months" : `Every ${n * 3} months`;
    if (cycle === "semiannual") return n === 1 ? "Every 6 months" : `Every ${n * 6} months`;
    if (cycle === "yearly") return n === 1 ? "Yearly" : `Every ${n} years`;
    return "Custom";
}

export function feeFor(base: number, mode: SubscriptionFeeMode, value: number): number {
    if (mode === "fixed") return round2(value);
    if (mode === "percent") return round2((base * value) / 100);
    return 0;
}

/** Trial-aware unsigned base amount for a given due date (no fee). */
export function effectiveAmount(sub: Subscription, dueISO: string): number {
    const isTrial = !!sub.trial_end_date && dueISO <= sub.trial_end_date;
    return isTrial ? sub.trial_amount : sub.amount;
}

export function chargeBreakdown(
    sub: Subscription,
    dueISO: string
): { base: number; fee: number; total: number; isTrial: boolean } {
    const isTrial = !!sub.trial_end_date && dueISO <= sub.trial_end_date;
    const base = isTrial ? sub.trial_amount : sub.amount;
    const fee = feeFor(base, sub.fee_mode, sub.fee_value);
    const total = sub.direction === "expense" ? base + fee : base - fee;
    return { base, fee, total, isTrial };
}

/** In sub.currency. */
export function monthlyEquivalent(sub: Subscription): number {
    const days = cycleDays(sub.billing_cycle, sub.interval_count, sub.custom_interval_days);
    if (days <= 0) return 0;
    return round2((sub.amount / days) * AVG_MONTH_DAYS);
}

/** In sub.currency. */
export function annualEquivalent(sub: Subscription): number {
    const days = cycleDays(sub.billing_cycle, sub.interval_count, sub.custom_interval_days);
    if (days <= 0) return 0;
    return round2((sub.amount / days) * AVG_YEAR_DAYS);
}

export function totalsByDisplayCurrency(
    subs: Subscription[],
    convert: (amount: number, from: Currency) => number
): {
    monthly: number;
    annual: number;
    activeCount: number;
    incomeMonthly: number;
    expenseMonthly: number;
} {
    let monthly = 0;
    let annual = 0;
    let activeCount = 0;
    let incomeMonthly = 0;
    let expenseMonthly = 0;

    for (const sub of subs) {
        if (sub.status !== "active") continue;
        activeCount++;
        const m = convert(monthlyEquivalent(sub), sub.currency);
        const a = convert(annualEquivalent(sub), sub.currency);
        if (sub.direction === "income") {
            incomeMonthly += m;
        } else {
            monthly += m;
            annual += a;
            expenseMonthly += m;
        }
    }

    return {
        monthly: round2(monthly),
        annual: round2(annual),
        activeCount,
        incomeMonthly: round2(incomeMonthly),
        expenseMonthly: round2(expenseMonthly),
    };
}

// ============================================
// Urgency — mirrors getExpiryStatus() in document-card.tsx
// ============================================

export type DueTone = "overdue" | "today" | "urgent" | "soon" | "normal";

export function dueStatus(
    nextDueISO: string,
    todayIso: string = todayISO()
): { label: string; tone: DueTone; days: number } {
    const days = daysUntil(nextDueISO, todayIso);

    if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, tone: "overdue", days };
    if (days === 0) return { label: "Due today", tone: "today", days };
    if (days === 1) return { label: "Tomorrow", tone: "urgent", days };
    if (days <= 7) return { label: `In ${days} days`, tone: "urgent", days };
    if (days <= 30) return { label: formatDueDateShort(nextDueISO), tone: "soon", days };
    return { label: formatDueDate(nextDueISO), tone: "normal", days };
}

// ============================================
// Cashflow projection
// ============================================

export interface ProjectionPoint {
    dateISO: string;
    delta: number; // display currency, signed (income positive, expense negative)
    running: number;
    items: { subscriptionId: string; name: string; amount: number }[];
}

export function projectCashflow(
    subs: Subscription[],
    startingBalance: number,
    fromISO: string,
    days: number,
    convert: (amount: number, from: Currency) => number
): ProjectionPoint[] {
    const toISO = addDaysISO(fromISO, days);
    const byDate = new Map<string, { subscriptionId: string; name: string; amount: number }[]>();

    for (const sub of subs) {
        if (sub.status !== "active") continue;
        for (const due of dueDatesWithin(sub, fromISO, toISO)) {
            const { total } = chargeBreakdown(sub, due);
            const converted = convert(total, sub.currency);
            const signed = sub.direction === "expense" ? -converted : converted;
            const list = byDate.get(due) ?? [];
            list.push({ subscriptionId: sub.id, name: sub.name, amount: signed });
            byDate.set(due, list);
        }
    }

    const points: ProjectionPoint[] = [];
    let running = startingBalance;
    let cursor = fromISO;
    for (let i = 0; i <= days; i++) {
        const items = byDate.get(cursor) ?? [];
        const delta = items.reduce((sum, it) => sum + it.amount, 0);
        running = round2(running + delta);
        points.push({ dateISO: cursor, delta: round2(delta), running, items });
        cursor = addDaysISO(cursor, 1);
    }
    return points;
}

export function firstShortfall(points: ProjectionPoint[]): ProjectionPoint | null {
    return points.find((p) => p.running < 0) ?? null;
}

// ============================================
// Reminders feed
// ============================================

export interface ReminderItem {
    id: string; // subscription id or occurrence id
    kind: "upcoming" | "pending" | "trial_ending" | "overdue" | "failed";
    subscriptionId: string;
    title: string;
    dueDate: string;
    amount: number;
    currency: Currency;
    tone: DueTone;
}

export function buildReminders(
    subs: Subscription[],
    occurrences: SubscriptionOccurrence[],
    todayIso: string = todayISO()
): ReminderItem[] {
    const items: ReminderItem[] = [];
    const subsById = new Map(subs.map((s) => [s.id, s]));

    for (const occ of occurrences) {
        if (occ.status !== "pending" && occ.status !== "failed") continue;
        const sub = subsById.get(occ.subscription_id);
        if (!sub) continue;
        const { tone, days } = dueStatus(occ.due_date, todayIso);
        items.push({
            id: occ.id,
            kind: occ.status === "failed" ? "failed" : days < 0 ? "overdue" : "pending",
            subscriptionId: sub.id,
            title: sub.name,
            dueDate: occ.due_date,
            amount: occ.expected_amount,
            currency: occ.currency,
            tone,
        });
    }

    for (const sub of subs) {
        if (sub.status !== "active") continue;

        if (sub.trial_end_date) {
            const daysToTrialEnd = daysUntil(sub.trial_end_date, todayIso);
            if (daysToTrialEnd >= 0 && daysToTrialEnd <= sub.reminder_days_before) {
                items.push({
                    id: `trial-${sub.id}`,
                    kind: "trial_ending",
                    subscriptionId: sub.id,
                    title: sub.name,
                    dueDate: sub.trial_end_date,
                    amount: sub.amount,
                    currency: sub.currency,
                    tone: dueStatus(sub.trial_end_date, todayIso).tone,
                });
            }
        }

        const days = daysUntil(sub.next_due_date, todayIso);
        if (days >= 0 && days <= sub.reminder_days_before) {
            const alreadyListed = items.some(
                (it) => it.subscriptionId === sub.id && it.dueDate === sub.next_due_date
            );
            if (!alreadyListed) {
                items.push({
                    id: `upcoming-${sub.id}-${sub.next_due_date}`,
                    kind: "upcoming",
                    subscriptionId: sub.id,
                    title: sub.name,
                    dueDate: sub.next_due_date,
                    amount: sub.amount,
                    currency: sub.currency,
                    tone: dueStatus(sub.next_due_date, todayIso).tone,
                });
            }
        }
    }

    const rank: Record<ReminderItem["kind"], number> = {
        overdue: 0,
        failed: 1,
        pending: 2,
        trial_ending: 3,
        upcoming: 4,
    };
    return items.sort(
        (a, b) => rank[a.kind] - rank[b.kind] || a.dueDate.localeCompare(b.dueDate)
    );
}

// ============================================
// Form validation (controlled useState style, matches the rest of the app)
// ============================================

export interface SubscriptionFormValues {
    name: string;
    merchant: string;
    description: string;
    category: string;
    vaultId: string;
    direction: SubscriptionDirection;
    amount: string;
    currency: Currency;
    isVariableAmount: boolean;
    feeMode: SubscriptionFeeMode;
    feeValue: string;
    billingCycle: BillingCycle;
    intervalCount: string;
    customIntervalDays: string;
    anchorDay: string;
    startDate: string;
    endDate: string;
    trialEndDate: string;
    trialAmount: string;
    autoCharge: boolean;
    reminderDaysBefore: string;
    cancelUrl: string;
    notes: string;
    iconKey: string;
    color: string;
}

export function validateSubscriptionForm(v: SubscriptionFormValues): string | null {
    if (!v.name.trim()) return "Enter a name.";
    if (!v.vaultId) return "Select a vault.";

    const amount = parseFloat(v.amount);
    if (!v.amount || Number.isNaN(amount) || amount < 0) return "Enter a valid amount.";

    if (!v.startDate) return "Select a start date.";
    if (v.endDate && v.endDate < v.startDate) return "End date must be after the start date.";

    if (v.billingCycle === "custom_days") {
        const days = parseInt(v.customIntervalDays, 10);
        if (!v.customIntervalDays || Number.isNaN(days) || days < 1) {
            return "Enter a valid number of days.";
        }
    }

    if (v.anchorDay) {
        const day = parseInt(v.anchorDay, 10);
        if (Number.isNaN(day) || day < 1 || day > 31) {
            return "Anchor day must be between 1 and 31.";
        }
    }

    if (v.trialEndDate && v.trialEndDate < v.startDate) {
        return "Trial end date must be after the start date.";
    }

    if (v.feeMode !== "none") {
        const fee = parseFloat(v.feeValue);
        if (!v.feeValue || Number.isNaN(fee) || fee < 0) return "Enter a valid fee.";
    }

    const interval = parseInt(v.intervalCount, 10);
    if (!v.intervalCount || Number.isNaN(interval) || interval < 1) {
        return "Enter a valid interval.";
    }

    return null;
}

export function formValuesToInsert(
    v: SubscriptionFormValues,
    userId: string
): Record<string, unknown> {
    const intervalCount = parseInt(v.intervalCount, 10) || 1;
    const customDays =
        v.billingCycle === "custom_days" ? parseInt(v.customIntervalDays, 10) || 30 : null;
    const anchorDay = v.anchorDay
        ? parseInt(v.anchorDay, 10)
        : parseISODate(v.startDate).getUTCDate();
    const nextDue = initialNextDueDate(
        v.startDate,
        v.billingCycle,
        intervalCount,
        customDays,
        anchorDay
    );

    return {
        user_id: userId,
        vault_id: v.vaultId,
        name: v.name.trim(),
        merchant: v.merchant.trim() || null,
        description: v.description.trim() || null,
        category: v.category.trim() || null,
        icon_key: v.iconKey || null,
        color: normalizeHexColor(v.color),
        cancel_url: v.cancelUrl.trim() || null,
        notes: v.notes.trim() || null,
        direction: v.direction,
        amount: parseFloat(v.amount) || 0,
        currency: v.currency,
        is_variable_amount: v.isVariableAmount,
        fee_mode: v.feeMode,
        fee_value: v.feeMode === "none" ? 0 : parseFloat(v.feeValue) || 0,
        billing_cycle: v.billingCycle,
        interval_count: intervalCount,
        custom_interval_days: customDays,
        anchor_day: anchorDay,
        start_date: v.startDate,
        end_date: v.endDate || null,
        next_due_date: nextDue,
        trial_end_date: v.trialEndDate || null,
        trial_amount: v.trialEndDate ? parseFloat(v.trialAmount) || 0 : 0,
        auto_charge: v.isVariableAmount ? false : v.autoCharge,
        reminder_days_before: parseInt(v.reminderDaysBefore, 10) || 3,
    };
}

export function subscriptionToFormValues(s: Subscription): SubscriptionFormValues {
    return {
        name: s.name,
        merchant: s.merchant ?? "",
        description: s.description ?? "",
        category: s.category ?? "",
        vaultId: s.vault_id,
        direction: s.direction,
        amount: String(s.amount),
        currency: s.currency,
        isVariableAmount: s.is_variable_amount,
        feeMode: s.fee_mode,
        feeValue: s.fee_value ? String(s.fee_value) : "",
        billingCycle: s.billing_cycle,
        intervalCount: String(s.interval_count),
        customIntervalDays: s.custom_interval_days ? String(s.custom_interval_days) : "",
        anchorDay: s.anchor_day ? String(s.anchor_day) : "",
        startDate: s.start_date,
        endDate: s.end_date ?? "",
        trialEndDate: s.trial_end_date ?? "",
        trialAmount: s.trial_amount ? String(s.trial_amount) : "",
        autoCharge: s.auto_charge,
        reminderDaysBefore: String(s.reminder_days_before),
        cancelUrl: s.cancel_url ?? "",
        notes: s.notes ?? "",
        iconKey: s.icon_key ?? "",
        color: s.color,
    };
}
