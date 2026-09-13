// ============================================
// Receivables (Pendiente por cobrar) — pure logic
// ============================================
//
// Everything arithmetic for receivables lives here, same discipline as
// src/lib/subscriptions.ts. Date/tone primitives are reused from there
// rather than reimplemented — a "vencido" here must always agree with a
// "overdue" subscription.
//
// isLiquidVault() is the single guard the whole app relies on: a vault of
// type "receivable" holds money that has not arrived yet, so it must never
// enter a liquid balance total, net worth figure, runway projection, or
// vault-of-origin picker (transfers, splits, subscriptions, new expense/
// income). Every call site is enumerated in the plan under "Guard de
// liquidez" — if you add a new vault aggregation anywhere, it goes through
// isLiquidVault() too.

import type { Currency, Receivable, ReceivableStatus } from "@/types";
import {
    compareReminders,
    daysUntil,
    parseISODate,
    todayISO,
    type DueTone,
    type ReminderItem,
} from "@/lib/subscriptions";

export const RECEIVABLE_VAULT_TYPE = "receivable" as const;

export const LIQUID_VAULT_TYPES = ["savings", "checking", "cash"] as const;

/** The money in a non-liquid vault (currently only "receivable") does not
 *  exist yet. Never sum it into a total, a net worth, a runway, or offer
 *  it as a source vault for a transaction/transfer/subscription/split. */
export function isLiquidVault(type: string | null | undefined): boolean {
    return type !== RECEIVABLE_VAULT_TYPE;
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ============================================
// Amounts
// ============================================

export function outstandingAmount(r: Pick<Receivable, "amount" | "amount_collected">): number {
    return round2(r.amount - r.amount_collected);
}

// ============================================
// Status
// ============================================

export type EffectiveReceivableStatus =
    | "paid"
    | "canceled"
    | "overdue"
    | "due_soon"
    | "pending"
    | "partial";

/** Mirrors dueStatus() from subscriptions.ts but folds in the stored
 *  ReceivableStatus first: paid/canceled never get overdue on top. */
export function effectiveStatus(
    r: Pick<Receivable, "status" | "expected_date" | "reminder_days_before">,
    todayIso: string = todayISO()
): { status: EffectiveReceivableStatus; tone: DueTone; days: number } {
    if (r.status === "paid") return { status: "paid", tone: "normal", days: 0 };
    if (r.status === "canceled") return { status: "canceled", tone: "normal", days: 0 };

    const days = daysUntil(r.expected_date, todayIso);

    if (days < 0) return { status: "overdue", tone: "overdue", days };
    if (days <= r.reminder_days_before) {
        const tone: DueTone = days === 0 ? "today" : days <= 1 ? "urgent" : "soon";
        return { status: "due_soon", tone, days };
    }
    return { status: r.status === "partial" ? "partial" : "pending", tone: "normal", days };
}

// ============================================
// Totals
// ============================================

export interface VaultReceivableTotals {
    outstanding: number;
    count: number;
    overdueCount: number;
}

/** Per-vault outstanding total — what a receivable VaultCard shows as its
 *  "balance". Only open receivables (pending/partial) count. */
export function totalsByVault(
    receivables: Receivable[],
    todayIso: string = todayISO()
): Map<string, VaultReceivableTotals> {
    const map = new Map<string, VaultReceivableTotals>();
    for (const r of receivables) {
        if (r.status === "paid" || r.status === "canceled") continue;
        const entry = map.get(r.vault_id) ?? { outstanding: 0, count: 0, overdueCount: 0 };
        entry.outstanding = round2(entry.outstanding + outstandingAmount(r));
        entry.count += 1;
        if (effectiveStatus(r, todayIso).status === "overdue") entry.overdueCount += 1;
        map.set(r.vault_id, entry);
    }
    return map;
}

export interface ReceivableTotals {
    outstanding: number;
    overdue: number;
    dueThisMonth: number;
    collectedThisMonth: number;
}

/** Dashboard-level totals in a single display currency. `convert` mirrors
 *  useCurrencyStore().convert — (amount, fromCurrency) -> number. */
export function receivableTotals(
    receivables: Receivable[],
    convert: (amount: number, from: Currency) => number,
    todayIso: string = todayISO()
): ReceivableTotals {
    const totals: ReceivableTotals = {
        outstanding: 0,
        overdue: 0,
        dueThisMonth: 0,
        collectedThisMonth: 0,
    };

    const today = parseISODate(todayIso);
    const monthStart = `${todayIso.slice(0, 7)}-01`;

    for (const r of receivables) {
        if (r.status !== "paid" && r.status !== "canceled") {
            const outstanding = convert(outstandingAmount(r), r.currency);
            totals.outstanding = round2(totals.outstanding + outstanding);

            if (effectiveStatus(r, todayIso).status === "overdue") {
                totals.overdue = round2(totals.overdue + outstanding);
            }
            if (r.expected_date >= monthStart && parseISODate(r.expected_date) <= addMonthEnd(today)) {
                totals.dueThisMonth = round2(totals.dueThisMonth + outstanding);
            }
        }

        if (r.paid_at && r.paid_at.slice(0, 7) === todayIso.slice(0, 7)) {
            totals.collectedThisMonth = round2(
                totals.collectedThisMonth + convert(r.amount_collected, r.currency)
            );
        }
    }

    return totals;
}

function addMonthEnd(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

// ============================================
// Reminders — feeds the same bell as subscriptions
// ============================================

export function buildReceivableReminders(
    receivables: Receivable[],
    todayIso: string = todayISO()
): ReminderItem[] {
    const items: ReminderItem[] = [];

    for (const r of receivables) {
        if (r.status === "paid" || r.status === "canceled") continue;
        if (!r.notify_in_app) continue;

        const { status, tone, days } = effectiveStatus(r, todayIso);
        if (status !== "overdue" && status !== "due_soon") continue;

        items.push({
            id: r.id,
            kind: status === "overdue" ? "overdue" : "pending",
            subscriptionId: r.id,
            title: r.client_name ? `${r.client_name} — ${r.description}` : r.description,
            dueDate: r.expected_date,
            amount: outstandingAmount(r),
            currency: r.currency,
            tone,
            source: "receivable",
            href: `/dashboard/receivables?vault=${r.vault_id}`,
        });
        void days;
    }

    return items.sort(compareReminders);
}

// ============================================
// Form plumbing — same contract as subscriptions.ts
// ============================================

export interface ReceivableFormValues {
    vaultId: string;
    clientId: string | null;
    clientName: string;
    description: string;
    amount: string;
    currency: Currency;
    issueDate: string;
    expectedDate: string;
    reminderEnabled: boolean;
    reminderDaysBefore: string;
    notes: string;
}

export function validateReceivableForm(v: ReceivableFormValues): string | null {
    if (!v.vaultId) return "Select a vault.";
    if (!v.clientName.trim()) return "Enter a client name.";
    if (!v.description.trim()) return "Enter a description.";

    const amount = parseFloat(v.amount);
    if (!v.amount || Number.isNaN(amount) || amount <= 0) return "Enter a valid amount.";

    if (!v.expectedDate) return "Select an expected payment date.";
    if (v.issueDate && v.expectedDate < v.issueDate) {
        return "Expected date must be on or after the issue date.";
    }

    if (v.reminderEnabled) {
        const days = parseInt(v.reminderDaysBefore, 10);
        if (Number.isNaN(days) || days < 0 || days > 60) {
            return "Reminder days must be between 0 and 60.";
        }
    }

    return null;
}

export function formValuesToInsert(
    v: ReceivableFormValues,
    userId: string
): Record<string, unknown> {
    return {
        user_id: userId,
        vault_id: v.vaultId,
        client_id: v.clientId,
        client_name: v.clientName.trim(),
        direction: "receivable",
        description: v.description.trim(),
        amount: parseFloat(v.amount) || 0,
        currency: v.currency,
        issue_date: v.issueDate || todayISO(),
        expected_date: v.expectedDate,
        reminder_days_before: v.reminderEnabled ? parseInt(v.reminderDaysBefore, 10) || 3 : 0,
        notify_in_app: v.reminderEnabled,
        notes: v.notes.trim() || null,
    };
}

export function receivableToFormValues(r: Receivable): ReceivableFormValues {
    return {
        vaultId: r.vault_id,
        clientId: r.client_id,
        clientName: r.client_name ?? "",
        description: r.description,
        amount: String(r.amount),
        currency: r.currency,
        issueDate: r.issue_date,
        expectedDate: r.expected_date,
        reminderEnabled: r.notify_in_app,
        reminderDaysBefore: String(r.reminder_days_before),
        notes: r.notes ?? "",
    };
}

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
    pending: "Pending",
    partial: "Partially collected",
    paid: "Collected",
    canceled: "Canceled",
};
