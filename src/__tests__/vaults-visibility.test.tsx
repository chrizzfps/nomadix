import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VaultsPage from "@/app/dashboard/vaults/page";
import { useLanguageStore } from "@/stores/language-store";

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

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

const mockVaultRows = Array.from({ length: 10 }).map((_, i) => ({
    id: `vault-${i + 1}`,
    name: `Vault Number ${i + 1}`,
    currency: "USD",
    type: "checking",
    is_protected: false,
    created_at: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
}));

jest.mock("@/lib/supabase/client", () => {
    const makeBuilder = (data: unknown) => {
        const builder: Record<string, unknown> = {};
        const chain = () => builder;
        builder.select = chain;
        builder.eq = chain;
        builder.in = chain;
        builder.order = chain;
        builder.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
            resolve({ data, error: null });
        return builder;
    };

    const client = {
        auth: {
            getUser: async () => ({
                data: { user: { id: "u1" } },
                error: null,
            }),
        },
        rpc: async () => ({ data: [], error: null }),
        from: (table: string) => {
            if (table === "vaults") return makeBuilder(mockVaultRows);
            if (table === "transactions") return makeBuilder([]);
            return makeBuilder([]);
        },
    };

    return { createClient: () => client };
});

describe("Vaults Visibility and Row Limiting", () => {
    beforeEach(() => {
        localStorage.clear();
        useLanguageStore.getState().setLanguage("en");
    });

    it("truncates at 2 rows (8 vaults) by default and shows 'Show 2 more' button", async () => {
        const user = userEvent.setup();
        render(<VaultsPage />);

        await screen.findByText("Your Vaults");

        // First 8 should be visible
        expect(screen.getByText("Vault Number 1")).toBeInTheDocument();
        expect(screen.getByText("Vault Number 8")).toBeInTheDocument();

        // 9 and 10 should be truncated / hidden initially
        expect(screen.queryByText("Vault Number 9")).not.toBeInTheDocument();
        expect(screen.queryByText("Vault Number 10")).not.toBeInTheDocument();

        // Button should say "Show 2 more"
        const showMoreBtn = screen.getByRole("button", { name: /Show 2 more/i });
        expect(showMoreBtn).toBeInTheDocument();

        // Click to expand
        await user.click(showMoreBtn);

        // Now 9 and 10 should appear
        expect(screen.getByText("Vault Number 9")).toBeInTheDocument();
        expect(screen.getByText("Vault Number 10")).toBeInTheDocument();

        // Button should now say "Show less"
        const showLessBtn = screen.getByRole("button", { name: /Show less/i });
        expect(showLessBtn).toBeInTheDocument();

        // Click to collapse
        await user.click(showLessBtn);

        // Should be hidden again
        expect(screen.queryByText("Vault Number 9")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Show 2 more/i })).toBeInTheDocument();
    });

    it("allows choosing visible limit via 3-dots menu and persists preference", async () => {
        const user = userEvent.setup();
        render(<VaultsPage />);

        await screen.findByText("Your Vaults");

        // Open 3-dots contextual menu
        const menuBtn = screen.getByRole("button", { name: /View options/i });
        await user.click(menuBtn);

        // Select "1 row (4 vaults)"
        const oneRowBtn = screen.getByRole("button", { name: /1 row \(4 vaults\)/i });
        await user.click(oneRowBtn);

        // Now only 4 vaults should be visible, and button says "Show 6 more"
        expect(screen.getByText("Vault Number 1")).toBeInTheDocument();
        expect(screen.getByText("Vault Number 4")).toBeInTheDocument();
        expect(screen.queryByText("Vault Number 5")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Show 6 more/i })).toBeInTheDocument();

        // Verified persisted to localStorage
        expect(localStorage.getItem("nomadix_vaults_visible_limit")).toBe("4");

        // Switch to "Show all"
        await user.click(menuBtn);
        const showAllBtn = screen.getByRole("button", { name: /Show all/i });
        await user.click(showAllBtn);

        // All 10 vaults should be visible
        expect(screen.getByText("Vault Number 10")).toBeInTheDocument();
        // Toggle button should not be rendered
        expect(screen.queryByRole("button", { name: /Show .* more/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Show less/i })).not.toBeInTheDocument();
        expect(localStorage.getItem("nomadix_vaults_visible_limit")).toBe("all");
    });
});
