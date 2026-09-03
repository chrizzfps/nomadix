import { render, screen } from "@testing-library/react";
import { UpcomingChargesWidget } from "@/components/subscriptions/upcoming-charges-widget";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/subscriptions";
import { useLanguageStore } from "@/stores/language-store";

function makeSub(overrides: Record<string, unknown>) {
    return {
        id: "s1",
        user_id: "u1",
        vault_id: "v1",
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
        next_due_date: todayISO(),
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
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

jest.mock("@/lib/supabase/client", () => {
    let subscriptions: unknown[] = [makeSubForMock()];
    let vaultBalance = 1000;

    function makeSubForMock() {
        return {
            id: "s1",
            user_id: "u1",
            vault_id: "v1",
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
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        };
    }

    function makeBuilder(getData: () => unknown[]) {
        const builder: Record<string, unknown> = {};
        const chain = () => builder;
        builder.select = chain;
        builder.eq = chain;
        builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
            resolve({ data: getData(), error: null });
        return builder;
    }

    const client = {
        auth: {
            getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
        },
        from: (table: string) => {
            if (table === "vaults") return makeBuilder(() => [{ id: "v1", name: "Main", currency: "EUR" }]);
            if (table === "transactions")
                return makeBuilder(() => [{ vault_id: "v1", amount: vaultBalance }]);
            if (table === "subscriptions") return makeBuilder(() => subscriptions);
            return makeBuilder(() => []);
        },
        rpc: async () => ({ data: 0, error: null }),
        __setSubscriptions: (rows: unknown[]) => {
            subscriptions = rows;
        },
        __setVaultBalance: (n: number) => {
            vaultBalance = n;
        },
    };

    return { createClient: () => client };
});

describe("UpcomingChargesWidget", () => {
    beforeEach(() => {
        useLanguageStore.getState().setLanguage("en");
    });

    it("renders upcoming rows sorted by date", async () => {
        render(<UpcomingChargesWidget />);
        const rows = await screen.findAllByText("Netflix");
        expect(rows.length).toBeGreaterThan(0);
        expect(screen.getByText("Upcoming charges")).toBeInTheDocument();
    });

    it("shows the empty state when there are no active subscriptions", async () => {
        const client = createClient() as unknown as { __setSubscriptions: (rows: unknown[]) => void };
        client.__setSubscriptions([]);
        render(<UpcomingChargesWidget />);
        expect(
            await screen.findByText("No upcoming charges in the next 30 days.")
        ).toBeInTheDocument();
    });

    it("shows a shortfall warning when the balance would go negative", async () => {
        const client = createClient() as unknown as {
            __setSubscriptions: (rows: unknown[]) => void;
            __setVaultBalance: (n: number) => void;
        };
        client.__setSubscriptions([
            makeSub({ id: "big", name: "Rent", amount: 5000, next_due_date: todayISO() }),
        ]);
        client.__setVaultBalance(100);
        render(<UpcomingChargesWidget />);
        expect(await screen.findByText(/Balance may drop below/i)).toBeInTheDocument();
    });
});
