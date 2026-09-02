import {
    monthlyEquivalent,
    annualEquivalent,
    feeFor,
    effectiveAmount,
    chargeBreakdown,
    totalsByDisplayCurrency,
    dueStatus,
    projectCashflow,
    firstShortfall,
    cycleLabel,
} from "@/lib/subscriptions";
import type { Subscription } from "@/types";

function makeSub(overrides: Partial<Subscription>): Subscription {
    return {
        id: "sub-1",
        user_id: "user-1",
        vault_id: "vault-1",
        name: "Test",
        merchant: null,
        description: null,
        category: null,
        icon_key: null,
        color: "#18181b",
        cancel_url: null,
        notes: null,
        direction: "expense",
        amount: 10,
        currency: "EUR",
        is_variable_amount: false,
        fee_mode: "none",
        fee_value: 0,
        billing_cycle: "monthly",
        interval_count: 1,
        custom_interval_days: null,
        anchor_day: null,
        start_date: "2026-01-01",
        end_date: null,
        next_due_date: "2026-01-01",
        last_charged_date: null,
        trial_end_date: null,
        trial_amount: 0,
        status: "active",
        auto_charge: true,
        canceled_at: null,
        reminder_days_before: 3,
        notify_in_app: true,
        notify_email: false,
        last_reminder_seen_at: null,
        last_email_sent_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

describe("cycleLabel", () => {
    it("labels the common cycles", () => {
        expect(cycleLabel("monthly", 1, null)).toBe("Monthly");
        expect(cycleLabel("quarterly", 1, null)).toBe("Every 3 months");
        expect(cycleLabel("custom_days", 1, 45)).toBe("Every 45 days");
        expect(cycleLabel("yearly", 1, null)).toBe("Yearly");
        expect(cycleLabel("weekly", 2, null)).toBe("Every 2 weeks");
    });
});

describe("monthlyEquivalent / annualEquivalent", () => {
    it("yearly divides evenly into 12", () => {
        const sub = makeSub({ billing_cycle: "yearly", amount: 120 });
        expect(monthlyEquivalent(sub)).toBeCloseTo(10, 2);
        expect(annualEquivalent(sub)).toBeCloseTo(120, 2);
    });

    it("quarterly divides evenly into monthly", () => {
        const sub = makeSub({ billing_cycle: "quarterly", amount: 30 });
        expect(monthlyEquivalent(sub)).toBeCloseTo(10, 2);
    });

    it("monthly is a no-op normalization", () => {
        const sub = makeSub({ billing_cycle: "monthly", amount: 9.99 });
        expect(monthlyEquivalent(sub)).toBeCloseTo(9.99, 2);
    });

    it("annual is always ~12x the monthly equivalent, within a cent", () => {
        const sub = makeSub({ billing_cycle: "weekly", amount: 10 });
        expect(annualEquivalent(sub)).toBeCloseTo(monthlyEquivalent(sub) * 12, 1);
    });
});

describe("feeFor", () => {
    it("fixed fee ignores base", () => {
        expect(feeFor(9.99, "fixed", 0.35)).toBe(0.35);
    });

    it("percent fee rounds to 2 decimals", () => {
        expect(feeFor(9.99, "percent", 2.9)).toBeCloseTo(0.29, 2);
    });

    it("none fee is always 0", () => {
        expect(feeFor(100, "none", 5)).toBe(0);
    });
});

describe("effectiveAmount / chargeBreakdown — trial awareness", () => {
    it("uses trial_amount on or before trial_end_date", () => {
        const sub = makeSub({ amount: 15, trial_amount: 0, trial_end_date: "2026-02-01" });
        expect(effectiveAmount(sub, "2026-02-01")).toBe(0);
        expect(effectiveAmount(sub, "2026-02-02")).toBe(15);
    });

    it("folds the fee into total: expense adds, income subtracts", () => {
        const expense = makeSub({
            direction: "expense",
            amount: 100,
            fee_mode: "percent",
            fee_value: 2.9,
        });
        expect(chargeBreakdown(expense, "2026-05-01")).toEqual({
            base: 100,
            fee: 2.9,
            total: 102.9,
            isTrial: false,
        });

        const income = makeSub({
            direction: "income",
            amount: 100,
            fee_mode: "percent",
            fee_value: 2.9,
        });
        expect(chargeBreakdown(income, "2026-05-01")).toEqual({
            base: 100,
            fee: 2.9,
            total: 97.1,
            isTrial: false,
        });
    });
});

describe("totalsByDisplayCurrency", () => {
    it("separates income and expense, ignores non-active rules", () => {
        const identity = (amount: number) => amount;
        const subs = [
            makeSub({ id: "a", direction: "expense", billing_cycle: "monthly", amount: 10 }),
            makeSub({ id: "b", direction: "income", billing_cycle: "monthly", amount: 1000 }),
            makeSub({ id: "c", status: "paused", amount: 999 }),
        ];
        const totals = totalsByDisplayCurrency(subs, identity);
        expect(totals.activeCount).toBe(2);
        expect(totals.expenseMonthly).toBeCloseTo(10, 2);
        expect(totals.incomeMonthly).toBeCloseTo(1000, 2);
        expect(totals.monthly).toBeCloseTo(10, 2);
    });
});

describe("dueStatus", () => {
    const today = "2026-06-15";
    it("overdue for negative days", () => {
        expect(dueStatus("2026-06-12", today)).toEqual({
            label: "Overdue 3d",
            tone: "overdue",
            days: -3,
        });
    });
    it("due today", () => {
        expect(dueStatus("2026-06-15", today).tone).toBe("today");
    });
    it("tomorrow is urgent", () => {
        expect(dueStatus("2026-06-16", today)).toEqual({
            label: "Tomorrow",
            tone: "urgent",
            days: 1,
        });
    });
    it("2-7 days is urgent", () => {
        expect(dueStatus("2026-06-22", today).tone).toBe("urgent");
    });
    it("8-30 days is soon", () => {
        expect(dueStatus("2026-07-01", today).tone).toBe("soon");
    });
    it("beyond 30 days is normal", () => {
        expect(dueStatus("2026-09-01", today).tone).toBe("normal");
    });
});

describe("projectCashflow / firstShortfall", () => {
    it("flags a shortfall when charges exceed the starting balance", () => {
        const identity = (amount: number) => amount;
        const subs = [
            makeSub({
                id: "a",
                direction: "expense",
                billing_cycle: "monthly",
                amount: 60,
                next_due_date: "2026-01-01",
            }),
        ];
        const points = projectCashflow(subs, 100, "2026-01-01", 60, identity);
        const shortfall = firstShortfall(points);
        expect(shortfall).not.toBeNull();
        expect(shortfall?.dateISO).toBe("2026-02-01");
        expect(shortfall?.running).toBeCloseTo(-20, 2);
    });

    it("returns null when balances stay non-negative", () => {
        const identity = (amount: number) => amount;
        const subs = [
            makeSub({
                id: "a",
                direction: "expense",
                billing_cycle: "monthly",
                amount: 10,
                next_due_date: "2026-01-01",
            }),
        ];
        const points = projectCashflow(subs, 1000, "2026-01-01", 60, identity);
        expect(firstShortfall(points)).toBeNull();
    });
});
