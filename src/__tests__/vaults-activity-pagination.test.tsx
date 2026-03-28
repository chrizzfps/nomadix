import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VaultsPage from "@/app/dashboard/vaults/page";

jest.mock("@/stores/currency-store", () => ({
    useCurrencyStore: () => ({
        displayCurrency: "USD",
        convert: (amount: number) => amount,
        loadRate: async () => {},
        getActiveRate: () => 1,
    }),
}));

jest.mock("@/stores/toast-store", () => ({
    useToastStore: (selector: (s: { addToast: () => void }) => unknown) =>
        selector({ addToast: () => {} }),
}));

jest.mock("@/lib/supabase/client", () => {
    const vaultRows = [
        {
            id: "v1",
            name: "Main",
            currency: "USD",
            type: "checking",
            is_protected: false,
            created_at: "2026-03-01T10:00:00.000Z",
        },
    ];

    const txRows = Array.from({ length: 12 }).map((_, i) => ({
        id: `t${i + 1}`,
        user_id: "u1",
        vault_id: "v1",
        amount: -(i + 1),
        type: "expense",
        category: i % 2 === 0 ? "Food" : "Home",
        description: `${i % 2 === 0 ? "Food" : "Home"} Tx ${i + 1}`,
        date: "2026-03-20",
        original_currency: "USD",
        created_at: `2026-03-${String(28 - i).padStart(2, "0")}T10:00:00.000Z`,
    }));

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

describe("Vaults Recent Activity pagination", () => {
    it("shows more movements without reloading", async () => {
        const user = userEvent.setup();
        render(<VaultsPage />);

        await screen.findByText("Recent Activity");

        expect(screen.getByText("Ver más movimientos")).toBeInTheDocument();
        expect(screen.queryByText("Food Tx 11")).not.toBeInTheDocument();

        await user.click(screen.getByText("Ver más movimientos"));

        await waitFor(() => {
            expect(screen.getByText("Food Tx 11")).toBeInTheDocument();
        });
    });

    it("filters movements by category without reloading", async () => {
        const user = userEvent.setup();
        render(<VaultsPage />);

        await screen.findByText("Recent Activity");

        expect(screen.getByText("Food Tx 1")).toBeInTheDocument();
        expect(screen.getByText("Home Tx 2")).toBeInTheDocument();

        await user.click(screen.getByLabelText("Filtrar por categoría"));
        await user.click(screen.getByRole("button", { name: "Home" }));

        expect(screen.queryByText("Food Tx 1")).not.toBeInTheDocument();
        expect(screen.getByText("Home Tx 2")).toBeInTheDocument();
    });
});
