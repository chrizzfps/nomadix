import { buildMonthlyReportContext, monthLabel, previousMonthISO } from "@/lib/ai-report";
import type { Subscription, Transaction, Vault } from "@/types";

function makeVault(overrides: Partial<Vault>): Vault {
    return {
        id: "vault-1",
        user_id: "user-1",
        name: "Main",
        currency: "EUR",
        type: "checking",
        icon: "vault",
        color: "default",
        is_protected: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

function makeTx(overrides: Partial<Transaction>): Transaction {
    return {
        id: "tx-1",
        user_id: "user-1",
        vault_id: "vault-1",
        amount: -10,
        type: "expense",
        original_currency: "EUR",
        exchange_rate_at_time: null,
        category: "Food",
        description: "Groceries",
        date: "2026-09-15",
        status: "completed",
        created_at: "2026-09-15T00:00:00Z",
        fee: null,
        ...overrides,
    };
}

function makeSub(overrides: Partial<Subscription>): Subscription {
    return {
        id: "sub-1",
        user_id: "user-1",
        vault_id: "vault-1",
        name: "Netflix",
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
        next_due_date: "2026-09-25",
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

describe("monthLabel / previousMonthISO", () => {
    it("formats a month label", () => {
        expect(monthLabel("2026-09")).toBe("September 2026");
    });

    it("steps back a month, including year rollover", () => {
        expect(previousMonthISO("2026-09")).toBe("2026-08");
        expect(previousMonthISO("2026-01")).toBe("2025-12");
    });
});

describe("buildMonthlyReportContext", () => {
    const vaults = [makeVault({ id: "vault-1", currency: "EUR" })];

    it("sums income and expense for the target month only, ignoring other months", () => {
        const transactions = [
            makeTx({ id: "t1", type: "expense", amount: -50, date: "2026-09-05" }),
            makeTx({ id: "t2", type: "income", amount: 200, date: "2026-09-10" }),
            makeTx({ id: "t3", type: "expense", amount: -999, date: "2026-08-01" }),
        ];

        const ctx = buildMonthlyReportContext({
            transactions,
            subscriptions: [],
            vaults,
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.92,
        });

        expect(ctx.current.expense).toBeCloseTo(50, 2);
        expect(ctx.current.income).toBeCloseTo(200, 2);
        expect(ctx.current.net).toBeCloseTo(150, 2);
    });

    it("returns null previous-month totals when there is no data for it", () => {
        const ctx = buildMonthlyReportContext({
            transactions: [makeTx({ date: "2026-09-05" })],
            subscriptions: [],
            vaults,
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.92,
        });
        expect(ctx.previous).toBeNull();
    });

    it("computes previous-month totals when data exists", () => {
        const ctx = buildMonthlyReportContext({
            transactions: [
                makeTx({ id: "t1", amount: -50, date: "2026-09-05" }),
                makeTx({ id: "t2", amount: -30, date: "2026-08-05" }),
            ],
            subscriptions: [],
            vaults,
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.92,
        });
        expect(ctx.previous?.expense).toBeCloseTo(30, 2);
    });

    it("groups top expense categories, sorted descending", () => {
        const ctx = buildMonthlyReportContext({
            transactions: [
                makeTx({ id: "t1", category: "Food", amount: -20, date: "2026-09-01" }),
                makeTx({ id: "t2", category: "Food", amount: -30, date: "2026-09-02" }),
                makeTx({ id: "t3", category: "Rent", amount: -800, date: "2026-09-03" }),
                makeTx({ id: "t4", category: null, amount: -5, date: "2026-09-04" }),
            ],
            subscriptions: [],
            vaults,
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.92,
        });
        expect(ctx.topExpenseCategories[0]).toEqual({ category: "Rent", amount: 800 });
        expect(ctx.topExpenseCategories[1]).toEqual({ category: "Food", amount: 50 });
        expect(ctx.topExpenseCategories.find((c) => c.category === "Other")?.amount).toBe(5);
    });

    it("converts across vault currencies using the exchange rate", () => {
        const usdVault = makeVault({ id: "vault-usd", currency: "USD" });
        const ctx = buildMonthlyReportContext({
            transactions: [
                makeTx({
                    id: "t1",
                    vault_id: "vault-usd",
                    amount: -100,
                    original_currency: "USD",
                    date: "2026-09-05",
                }),
            ],
            subscriptions: [],
            vaults: [usdVault],
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.9,
        });
        expect(ctx.current.expense).toBeCloseTo(90, 2);
    });

    it("includes active subscriptions' monthly cost, and excludes paused/canceled ones", () => {
        const ctx = buildMonthlyReportContext({
            transactions: [],
            subscriptions: [
                makeSub({ id: "s1", status: "active", amount: 10 }),
                makeSub({ id: "s2", status: "canceled", amount: 999 }),
            ],
            vaults,
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.92,
        });
        expect(ctx.activeSubscriptionCount).toBe(1);
        expect(ctx.activeSubscriptionsMonthlyCost).toBeCloseTo(10, 2);
    });

    it("computes net worth as the converted sum of all-time vault balances", () => {
        const ctx = buildMonthlyReportContext({
            transactions: [
                makeTx({ id: "t1", amount: 500, type: "income", date: "2026-01-01" }),
                makeTx({ id: "t2", amount: -50, type: "expense", date: "2026-09-05" }),
            ],
            subscriptions: [],
            vaults,
            monthISO: "2026-09",
            reportCurrency: "EUR",
            usdEurRate: 0.92,
        });
        expect(ctx.netWorth).toBeCloseTo(450, 2);
        expect(ctx.vaultBalances[0].balance).toBeCloseTo(450, 2);
    });
});
