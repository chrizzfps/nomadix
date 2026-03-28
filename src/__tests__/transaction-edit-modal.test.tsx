import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionEditModal } from "@/components/vaults/transaction-edit-modal";

jest.mock("@/stores/toast-store", () => ({
    useToastStore: (selector: (s: { addToast: () => void }) => unknown) =>
        selector({ addToast: () => {} }),
}));

jest.mock("@/lib/supabase/client", () => {
    const updateSingle = jest.fn(async () => ({
        data: {
            id: "t1",
            amount: -15,
            type: "expense",
            category: "Food",
            description: "Lunch",
            original_currency: "USD",
            date: "2026-03-20",
            created_at: "2026-03-20T10:00:00.000Z",
        },
        error: null,
    }));

    const deleteEq = jest.fn(async () => ({ error: null }));

    const makeTxBuilder = () => {
        type Builder = {
            update: () => Builder;
            eq: () => Builder;
            select: () => Builder;
            single: typeof updateSingle;
            delete: () => { eq: typeof deleteEq };
        };
        const builder = {} as Builder;
        builder.update = () => builder;
        builder.eq = () => builder;
        builder.select = () => builder;
        builder.single = updateSingle;
        builder.delete = () => ({ eq: deleteEq });
        return builder;
    };

    const makeCatsBuilder = () => {
        type CatsBuilder = {
            select: () => CatsBuilder;
            eq: () => CatsBuilder;
            order: () => Promise<{
                data: { name: string; is_active: boolean }[];
                error: null;
            }>;
        };
        const builder = {} as CatsBuilder;
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.order = async () => ({
            data: [{ name: "Food", is_active: true }],
            error: null,
        });
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
            if (table === "transactions") return makeTxBuilder();
            if (table === "transaction_categories") return makeCatsBuilder();
            return makeTxBuilder();
        },
    };

    return { createClient: () => client };
});

describe("TransactionEditModal", () => {
    it("updates transaction and calls onUpdated", async () => {
        const user = userEvent.setup();
        const onUpdated = jest.fn();
        const onClose = jest.fn();

        render(
            <TransactionEditModal
                isOpen
                onClose={onClose}
                onUpdated={onUpdated}
                transaction={{
                    id: "t1",
                    amount: -10,
                    type: "expense",
                    category: "Food",
                    description: "Lunch",
                    original_currency: "USD",
                    date: "2026-03-20",
                    created_at: "2026-03-20T10:00:00.000Z",
                    vault_name: "Main",
                }}
            />
        );

        const amountInput = screen.getByDisplayValue("10");
        await user.clear(amountInput);
        await user.type(amountInput, "15");

        await user.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(onUpdated).toHaveBeenCalledWith(
                expect.objectContaining({ id: "t1", amount: -15 })
            );
        });
    });
});
