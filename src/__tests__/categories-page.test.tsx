import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoriesPage from "@/app/dashboard/settings/categories/page";

jest.mock("@/lib/supabase/client", () => {
    const categories = [
        {
            id: "c1",
            key: "food",
            name: "Food",
            description: "Meals",
            icon_key: "coffee",
            color: "#18181b",
            is_active: true,
            created_at: "2026-03-20T10:00:00.000Z",
            user_id: "u1",
        },
    ];

    const makeCatsBuilder = () => {
        type Builder = {
            select: () => Builder;
            eq: () => Builder;
            order: () => Promise<{ data: typeof categories; error: null }>;
            upsert: () => Promise<{ error: null }>;
            update: () => Builder;
            insert: () => Builder;
            single: () => Promise<{ data: (typeof categories)[number]; error: null }>;
        };
        const builder = {} as Builder;
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.order = async () => ({ data: categories, error: null });
        builder.upsert = async () => ({ error: null });
        builder.update = () => builder;
        builder.insert = () => builder;
        builder.single = async () => ({ data: categories[0], error: null });
        return builder;
    };

    const client = {
        auth: {
            getUser: async () => ({
                data: { user: { id: "u1" } },
                error: null,
            }),
        },
        from: () => makeCatsBuilder(),
    };

    return { createClient: () => client };
});

describe("CategoriesPage", () => {
    it("renders categories and opens create modal", async () => {
        const user = userEvent.setup();
        render(<CategoriesPage />);

        await screen.findByText("Food");
        await user.click(screen.getAllByText("New Category")[0]);
        expect(screen.getAllByText("New Category").length).toBeGreaterThan(1);
        await user.click(screen.getAllByText("Save")[0]);
        expect(screen.getByText("Name is required.")).toBeInTheDocument();
    });
});
