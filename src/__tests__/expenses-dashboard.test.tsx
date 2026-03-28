import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpensesPage from "@/app/dashboard/expenses/page";

jest.mock("recharts", () => {
    const Mock = ({ children }: { children?: React.ReactNode }) =>
        React.createElement("div", null, children);
    return {
        ResponsiveContainer: Mock,
        LineChart: Mock,
        Line: Mock,
        XAxis: Mock,
        YAxis: Mock,
        CartesianGrid: Mock,
        Tooltip: Mock,
        PieChart: Mock,
        Pie: Mock,
        Cell: Mock,
        Legend: Mock,
        BarChart: Mock,
        Bar: Mock,
    };
});

jest.mock("@/stores/currency-store", () => ({
    useCurrencyStore: () => ({
        displayCurrency: "EUR",
        convert: (amount: number) => amount,
        loadRate: async () => {},
    }),
}));

jest.mock("@/lib/supabase/client", () => {
    const vaultRows = [
        { id: "v1", name: "Main", currency: "EUR" },
        { id: "v2", name: "Cash", currency: "EUR" },
    ];

    const txRows = [
        {
            id: "t1",
            user_id: "u1",
            vault_id: "v1",
            amount: -10,
            type: "expense",
            category: "Food",
            description: "Lunch",
            date: "2026-03-20",
            original_currency: "EUR",
            created_at: "2026-03-20T10:00:00.000Z",
        },
        {
            id: "t_transfer",
            user_id: "u1",
            vault_id: "v1",
            amount: -999,
            type: "transfer",
            category: null,
            description: "Transfer out",
            date: "2026-03-20",
            original_currency: "EUR",
            created_at: "2026-03-20T11:00:00.000Z",
        },
        {
            id: "t2",
            user_id: "u1",
            vault_id: "v2",
            amount: -20,
            type: "expense",
            category: "Tech",
            description: "Cable",
            date: "2026-03-21",
            original_currency: "EUR",
            created_at: "2026-03-21T10:00:00.000Z",
        },
        {
            id: "t3",
            user_id: "u1",
            vault_id: "v1",
            amount: 200,
            type: "income",
            category: "Salary",
            description: "Paycheck",
            date: "2026-03-21",
            original_currency: "EUR",
            created_at: "2026-03-21T10:00:00.000Z",
        },
    ];

    const makeBuilder = (data: unknown) => {
        const builder = {
            select: () => builder,
            eq: () => builder,
            order: async () => ({ data, error: null }),
        };
        return builder;
    };

    const client = {
        auth: {
            getUser: async () => ({
                data: { user: { id: "u1" } },
                error: null,
            }),
        },
        from: (table: string) => {
            if (table === "vaults") return makeBuilder(vaultRows);
            if (table === "transactions") return makeBuilder(txRows);
            return makeBuilder([]);
        },
    };

    return { createClient: () => client };
});

describe("Expenses dashboard", () => {
    it("aggregates expenses by category and filters by vault", async () => {
        const user = userEvent.setup();
        render(<ExpensesPage />);

        await screen.findByText("Spend by category");

        const totalSpentCard =
            screen.getByText("Total spent").closest("div")?.parentElement;
        expect(totalSpentCard).toBeTruthy();
        expect(within(totalSpentCard as HTMLElement).getByText("€30.00")).toBeInTheDocument();
        expect(screen.getByText("Food")).toBeInTheDocument();
        expect(screen.getByText("Tech")).toBeInTheDocument();
        expect(screen.getAllByText("€10.00").length).toBeGreaterThan(0);
        expect(screen.getAllByText("€20.00").length).toBeGreaterThan(0);

        await user.selectOptions(screen.getByLabelText("Vault filter"), "v1");
        expect(within(totalSpentCard as HTMLElement).getByText("€10.00")).toBeInTheDocument();
    });
});
