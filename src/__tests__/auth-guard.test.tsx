import { render, screen, waitFor } from "@testing-library/react";
import { AuthGuard } from "@/components/auth/auth-guard";

const replace = jest.fn();
let sessionValue: unknown = { access_token: "x" };

jest.mock("next/navigation", () => ({
    useRouter: () => ({ replace }),
}));

jest.mock("@/lib/supabase/client", () => {
    const onAuthStateChange = () => ({
        data: { subscription: { unsubscribe: () => {} } },
    });
    return {
        createClient: () => ({
            auth: {
                getSession: async () => ({
                    data: { session: sessionValue },
                }),
                onAuthStateChange,
            },
        }),
    };
});

describe("AuthGuard", () => {
    beforeEach(() => {
        replace.mockClear();
        sessionValue = { access_token: "x" };
    });

    it("renders children when session exists", async () => {
        render(
            <AuthGuard>
                <div>Protected</div>
            </AuthGuard>
        );
        expect(await screen.findByText("Protected")).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });

    it("redirects when session missing", async () => {
        sessionValue = null;
        render(
            <AuthGuard>
                <div>Protected</div>
            </AuthGuard>
        );
        await waitFor(() => {
            expect(replace).toHaveBeenCalledWith("/login");
        });
    });
});
