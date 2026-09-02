import {
    nextDueDate,
    upcomingDueDates,
    dueDatesWithin,
    initialNextDueDate,
} from "@/lib/subscriptions";
import type { Subscription } from "@/types";

// This table must stay identical to the "Recurrence parity" block at the
// bottom of supabase/schema.sql (public.nomadix_next_due_date). If you
// change one, change the other.
const CASES: Array<{
    from: string;
    cycle: Parameters<typeof nextDueDate>[1];
    n?: number;
    customDays?: number | null;
    anchor?: number | null;
    expected: string;
}> = [
    { from: "2026-01-31", cycle: "monthly", anchor: 31, expected: "2026-02-28" },
    { from: "2026-02-28", cycle: "monthly", anchor: 31, expected: "2026-03-31" },
    { from: "2028-01-31", cycle: "monthly", anchor: 31, expected: "2028-02-29" },
    { from: "2026-01-30", cycle: "monthly", anchor: null, expected: "2026-02-28" },
    { from: "2026-12-15", cycle: "monthly", anchor: 15, expected: "2027-01-15" },
    { from: "2026-11-30", cycle: "quarterly", anchor: 30, expected: "2027-02-28" },
    { from: "2026-01-01", cycle: "weekly", expected: "2026-01-08" },
    { from: "2026-01-01", cycle: "custom_days", customDays: 45, expected: "2026-02-15" },
    { from: "2028-02-29", cycle: "yearly", anchor: 29, expected: "2029-02-28" },
];

describe("nextDueDate — parity matrix with nomadix_next_due_date()", () => {
    for (const c of CASES) {
        it(`${c.from} + ${c.cycle}(n=${c.n ?? 1}) anchor=${c.anchor ?? "auto"} -> ${c.expected}`, () => {
            expect(
                nextDueDate(c.from, c.cycle, c.n ?? 1, c.customDays ?? null, c.anchor ?? null)
            ).toBe(c.expected);
        });
    }
});

describe("nextDueDate — month-end clamping is non-lossy", () => {
    it("re-applies the anchor to each new month instead of carrying the clamp forward", () => {
        const anchor = 31;
        let due = "2026-01-31";
        const chain = [due];
        for (let i = 0; i < 4; i++) {
            due = nextDueDate(due, "monthly", 1, null, anchor);
            chain.push(due);
        }
        expect(chain).toEqual([
            "2026-01-31",
            "2026-02-28",
            "2026-03-31",
            "2026-04-30",
            "2026-05-31",
        ]);
    });

    it("handles a leap year Feb 29 anchor", () => {
        expect(nextDueDate("2028-01-31", "monthly", 1, null, 31)).toBe("2028-02-29");
    });

    it("rolls over the year boundary", () => {
        expect(nextDueDate("2026-12-31", "monthly", 1, null, 31)).toBe("2027-01-31");
    });
});

describe("nextDueDate — other cycles", () => {
    it("custom_days spans a month boundary", () => {
        expect(nextDueDate("2026-01-20", "custom_days", 1, 45, null)).toBe("2026-03-06");
    });

    it("weekly with intervalCount = 3 adds 21 days", () => {
        expect(nextDueDate("2026-01-01", "weekly", 3)).toBe("2026-01-22");
    });

    it("biweekly adds 14 days", () => {
        expect(nextDueDate("2026-01-01", "biweekly")).toBe("2026-01-15");
    });
});

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

describe("upcomingDueDates", () => {
    it("returns count dates starting from next_due_date", () => {
        const sub = makeSub({ next_due_date: "2026-01-01", billing_cycle: "monthly" });
        expect(upcomingDueDates(sub, 3)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    });

    it("stops at end_date", () => {
        const sub = makeSub({
            next_due_date: "2026-01-01",
            billing_cycle: "monthly",
            end_date: "2026-02-15",
        });
        expect(upcomingDueDates(sub, 5)).toEqual(["2026-01-01", "2026-02-01"]);
    });

    it("returns nothing when not active", () => {
        const sub = makeSub({ status: "paused" });
        expect(upcomingDueDates(sub, 3)).toEqual([]);
    });
});

describe("dueDatesWithin", () => {
    it("terminates on a 1-day cycle over a 400-day window", () => {
        const sub = makeSub({
            next_due_date: "2026-01-01",
            billing_cycle: "custom_days",
            custom_interval_days: 1,
        });
        const dates = dueDatesWithin(sub, "2026-01-01", "2027-02-05", 500);
        expect(dates.length).toBeGreaterThan(390);
        expect(dates[0]).toBe("2026-01-01");
    });

    it("only includes dates within [from, to]", () => {
        const sub = makeSub({ next_due_date: "2026-01-01", billing_cycle: "monthly" });
        const dates = dueDatesWithin(sub, "2026-02-01", "2026-04-01");
        expect(dates).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
    });
});

describe("initialNextDueDate", () => {
    it("uses start_date directly when it is in the future", () => {
        expect(
            initialNextDueDate("2026-06-01", "monthly", 1, null, null, "2026-01-01")
        ).toBe("2026-06-01");
    });

    it("rolls a past start_date forward to the first date >= today", () => {
        expect(
            initialNextDueDate("2026-01-01", "monthly", 1, null, null, "2026-03-15")
        ).toBe("2026-04-01");
    });
});
