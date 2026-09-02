import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubscriptionsPage from "@/app/dashboard/subscriptions/page";
import { createClient } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => {
    const vault = { id: "v1", name: "Main Vault", currency: "EUR" };

    const defaultSubscriptions = [
        {
            id: "s1",
            user_id: "u1",
            vault_id: "v1",
            name: "Netflix",
            merchant: null,
            description: null,
            category: "Entertainment",
            icon_key: null,
            color: "#18181b",
            cancel_url: null,
            notes: null,
            direction: "expense",
            amount: 12.99,
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
            next_due_date: "2026-06-01",
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
        },
    ];

    let subscriptions: typeof defaultSubscriptions = defaultSubscriptions;
    let vaultError: { message: string } | null = null;

    function makeBuilder(getData: () => unknown[], error: { message: string } | null = null) {
        const builder: Record<string, unknown> = {};
        const chain = () => builder;
        builder.select = chain;
        builder.eq = chain;
        builder.order = chain;
        builder.in = chain;
        builder.limit = chain;
        builder.single = async () => ({ data: getData()[0] ?? null, error });
        builder.then = (resolve: (v: { data: unknown[]; error: unknown }) => void) =>
            resolve({ data: error ? [] : getData(), error });
        return builder;
    }

    const client = {
        auth: {
            getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
        },
        from: (table: string) => {
            if (table === "vaults") return makeBuilder(() => [vault], vaultError);
            if (table === "subscriptions") return makeBuilder(() => subscriptions);
            if (table === "subscription_occurrences") return makeBuilder(() => []);
            if (table === "transaction_categories") return makeBuilder(() => []);
            return makeBuilder(() => []);
        },
        rpc: async () => ({ data: 0, error: null }),
        __setSubscriptions: (rows: typeof subscriptions) => {
            subscriptions = rows;
        },
        __resetSubscriptions: () => {
            subscriptions = defaultSubscriptions;
        },
        __setVaultError: (err: { message: string } | null) => {
            vaultError = err;
        },
    };

    return { createClient: () => client };
});

describe("SubscriptionsPage", () => {
    afterEach(() => {
        const client = createClient() as unknown as {
            __resetSubscriptions: () => void;
            __setVaultError: (err: { message: string } | null) => void;
        };
        client.__resetSubscriptions();
        client.__setVaultError(null);
    });

    it("renders subscription rows", async () => {
        render(<SubscriptionsPage />);
        expect(await screen.findByText("Netflix")).toBeInTheDocument();
        expect(screen.getByText("Monthly")).toBeInTheDocument();
    });

    it("shows the empty state when there are no subscriptions", async () => {
        const client = createClient() as unknown as {
            __setSubscriptions: (rows: unknown[]) => void;
        };
        client.__setSubscriptions([]);
        render(<SubscriptionsPage />);
        expect(await screen.findByText("No subscriptions yet")).toBeInTheDocument();
    });

    it("opens the create modal from the New Subscription button", async () => {
        const user = userEvent.setup();
        render(<SubscriptionsPage />);
        await screen.findByText("Netflix");
        await user.click(screen.getByText("New Subscription"));
        expect(await screen.findByText("New Subscription", { selector: "h2" })).toBeInTheDocument();
    });

    it("surfaces the schema-cache error message", async () => {
        const client = createClient() as unknown as {
            __setVaultError: (err: { message: string } | null) => void;
        };
        client.__setVaultError({ message: "schema cache" });
        render(<SubscriptionsPage />);
        expect(
            await screen.findByText(/subscriptions tables aren't set up yet/i)
        ).toBeInTheDocument();
    });
});
