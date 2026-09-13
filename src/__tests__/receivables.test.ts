import {
    outstandingAmount,
    effectiveStatus,
    totalsByVault,
    receivableTotals,
    validateReceivableForm,
    formValuesToInsert,
    type ReceivableFormValues,
} from "@/lib/receivables";
import type { Receivable } from "@/types";

function makeReceivable(overrides: Partial<Receivable> = {}): Receivable {
    return {
        id: "r1",
        user_id: "u1",
        vault_id: "v1",
        client_id: null,
        client_name: "Acme Co",
        direction: "receivable",
        description: "Invoice #1",
        amount: 500,
        currency: "USD",
        issue_date: "2026-08-01",
        expected_date: "2026-09-01",
        status: "pending",
        amount_collected: 0,
        paid_at: null,
        settled_vault_id: null,
        settlement_transaction_id: null,
        reminder_days_before: 3,
        notify_in_app: true,
        last_reminder_seen_at: null,
        notes: null,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
        ...overrides,
    };
}

describe("outstandingAmount", () => {
    it("is the full amount when nothing has been collected", () => {
        expect(outstandingAmount(makeReceivable({ amount: 500, amount_collected: 0 }))).toBe(500);
    });

    it("subtracts a partial collection", () => {
        expect(outstandingAmount(makeReceivable({ amount: 500, amount_collected: 400 }))).toBe(100);
    });

    it("is zero once fully collected", () => {
        expect(outstandingAmount(makeReceivable({ amount: 500, amount_collected: 500 }))).toBe(0);
    });
});

describe("effectiveStatus", () => {
    const today = "2026-09-12";

    it("paid and canceled never become overdue, regardless of date", () => {
        expect(
            effectiveStatus(
                makeReceivable({ status: "paid", expected_date: "2026-01-01" }),
                today
            ).status
        ).toBe("paid");
        expect(
            effectiveStatus(
                makeReceivable({ status: "canceled", expected_date: "2026-01-01" }),
                today
            ).status
        ).toBe("canceled");
    });

    it("is overdue the day after expected_date", () => {
        const { status, tone, days } = effectiveStatus(
            makeReceivable({ expected_date: "2026-09-11" }),
            today
        );
        expect(status).toBe("overdue");
        expect(tone).toBe("overdue");
        expect(days).toBe(-1);
    });

    it("is exactly on the boundary (expected_date == today) -> due_soon, not overdue", () => {
        const { status, tone } = effectiveStatus(
            makeReceivable({ expected_date: "2026-09-12", reminder_days_before: 3 }),
            today
        );
        expect(status).toBe("due_soon");
        expect(tone).toBe("today");
    });

    it("is due_soon inside the reminder window", () => {
        const { status } = effectiveStatus(
            makeReceivable({ expected_date: "2026-09-14", reminder_days_before: 3 }),
            today
        );
        expect(status).toBe("due_soon");
    });

    it("is pending outside the reminder window", () => {
        const { status } = effectiveStatus(
            makeReceivable({ expected_date: "2026-10-01", reminder_days_before: 3 }),
            today
        );
        expect(status).toBe("pending");
    });

    it("stays partial outside the reminder window if partially collected", () => {
        const { status } = effectiveStatus(
            makeReceivable({
                status: "partial",
                expected_date: "2026-10-01",
                reminder_days_before: 3,
            }),
            today
        );
        expect(status).toBe("partial");
    });
});

describe("totalsByVault", () => {
    it("sums outstanding per vault, skipping paid/canceled, and counts overdue", () => {
        const today = "2026-09-12";
        const receivables = [
            makeReceivable({ id: "r1", vault_id: "va", amount: 500, expected_date: "2026-09-01" }), // overdue
            makeReceivable({ id: "r2", vault_id: "va", amount: 300, amount_collected: 100, status: "partial", expected_date: "2026-12-01" }),
            makeReceivable({ id: "r3", vault_id: "va", amount: 999, status: "paid", amount_collected: 999, paid_at: "2026-09-05T00:00:00Z" }),
            makeReceivable({ id: "r4", vault_id: "vb", amount: 200, expected_date: "2026-12-01" }),
        ];

        const map = totalsByVault(receivables, today);

        expect(map.get("va")).toEqual({ outstanding: 700, count: 2, overdueCount: 1 });
        expect(map.get("vb")).toEqual({ outstanding: 200, count: 1, overdueCount: 0 });
    });
});

describe("receivableTotals", () => {
    const identity = (amount: number, _from: "EUR" | "USD") => amount;

    it("computes outstanding, overdue and collected-this-month across currencies", () => {
        const today = "2026-09-12";
        const receivables = [
            makeReceivable({ id: "r1", amount: 500, expected_date: "2026-09-01" }), // overdue
            makeReceivable({ id: "r2", amount: 200, currency: "EUR", expected_date: "2026-09-20" }), // due this month
            makeReceivable({
                id: "r3",
                amount: 300,
                amount_collected: 300,
                status: "paid",
                paid_at: "2026-09-05T00:00:00Z",
            }),
            makeReceivable({ id: "r4", amount: 999, status: "canceled" }),
        ];

        const totals = receivableTotals(receivables, identity, today);

        expect(totals.outstanding).toBe(700);
        expect(totals.overdue).toBe(500);
        expect(totals.dueThisMonth).toBe(700);
        expect(totals.collectedThisMonth).toBe(300);
    });
});

describe("validateReceivableForm", () => {
    const valid: ReceivableFormValues = {
        vaultId: "v1",
        clientId: null,
        clientName: "Acme Co",
        description: "Invoice #1",
        amount: "500",
        currency: "USD",
        issueDate: "2026-09-01",
        expectedDate: "2026-09-30",
        reminderEnabled: true,
        reminderDaysBefore: "3",
        notes: "",
    };

    it("accepts a valid form", () => {
        expect(validateReceivableForm(valid)).toBeNull();
    });

    it("requires a vault", () => {
        expect(validateReceivableForm({ ...valid, vaultId: "" })).toMatch(/vault/i);
    });

    it("requires a client name", () => {
        expect(validateReceivableForm({ ...valid, clientName: "  " })).toMatch(/client/i);
    });

    it("rejects a zero or negative amount", () => {
        expect(validateReceivableForm({ ...valid, amount: "0" })).toMatch(/amount/i);
        expect(validateReceivableForm({ ...valid, amount: "-5" })).toMatch(/amount/i);
    });

    it("rejects an expected date before the issue date", () => {
        expect(
            validateReceivableForm({ ...valid, issueDate: "2026-09-15", expectedDate: "2026-09-01" })
        ).toMatch(/expected date/i);
    });

    it("rejects an out-of-range reminder window", () => {
        expect(validateReceivableForm({ ...valid, reminderDaysBefore: "90" })).toMatch(/reminder/i);
    });
});

describe("formValuesToInsert", () => {
    it("maps camelCase form values to snake_case DB columns", () => {
        const values: ReceivableFormValues = {
            vaultId: "v1",
            clientId: "c1",
            clientName: "Acme Co",
            description: "Invoice #1",
            amount: "500",
            currency: "USD",
            issueDate: "2026-09-01",
            expectedDate: "2026-09-30",
            reminderEnabled: true,
            reminderDaysBefore: "5",
            notes: "Net 30",
        };

        expect(formValuesToInsert(values, "u1")).toEqual({
            user_id: "u1",
            vault_id: "v1",
            client_id: "c1",
            client_name: "Acme Co",
            direction: "receivable",
            description: "Invoice #1",
            amount: 500,
            currency: "USD",
            issue_date: "2026-09-01",
            expected_date: "2026-09-30",
            reminder_days_before: 5,
            notify_in_app: true,
            notes: "Net 30",
        });
    });

    it("zeroes the reminder window when reminders are disabled", () => {
        const values: ReceivableFormValues = {
            vaultId: "v1",
            clientId: null,
            clientName: "Acme Co",
            description: "Invoice #1",
            amount: "500",
            currency: "USD",
            issueDate: "2026-09-01",
            expectedDate: "2026-09-30",
            reminderEnabled: false,
            reminderDaysBefore: "5",
            notes: "",
        };

        const insert = formValuesToInsert(values, "u1");
        expect(insert.notify_in_app).toBe(false);
        expect(insert.reminder_days_before).toBe(0);
        expect(insert.notes).toBeNull();
    });
});
