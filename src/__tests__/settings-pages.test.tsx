import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SecurityPage from "@/app/dashboard/settings/security/page";
import NotificationsPage from "@/app/dashboard/settings/notifications/page";
import BillingPage from "@/app/dashboard/settings/billing/page";
import LanguagePage from "@/app/dashboard/settings/language/page";
import SupportPage from "@/app/dashboard/settings/support/page";
import DataManagementPage from "@/app/dashboard/settings/data/page";

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

jest.mock("@/lib/supabase/client", () => {
    const mockUser = { id: "u1", email: "nomad@example.com", last_sign_in_at: "2026-09-01T12:00:00Z" };
    return {
        createClient: () => ({
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
                updateUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
                signOut: jest.fn().mockResolvedValue({ error: null }),
            },
            from: (table: string) => ({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { full_name: "Nomad User" }, error: null }),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { full_name: "Nomad User" }, error: null }),
                        order: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                }),
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ error: null }),
                }),
            }),
        }),
    };
});

describe("New Settings Pages Functionality", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders Security page with password form and session control", async () => {
        render(<SecurityPage />);
        expect(await screen.findByText("Security & Authentication")).toBeInTheDocument();
        expect(screen.getByText("Change Password")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /sign out other devices/i })).toBeInTheDocument();
    });

    it("renders Notifications page with subscription and push toggles", () => {
        render(<NotificationsPage />);
        expect(screen.getByText("Notifications & Alerts")).toBeInTheDocument();
        expect(screen.getByText("1-Day Due Date Alert")).toBeInTheDocument();
        expect(screen.getByText("Price Changes & Trial Expirations")).toBeInTheDocument();
        expect(screen.getByText("Low Balance Warnings")).toBeInTheDocument();
    });

    it("renders Billing page with plan details, benefits, and invoice history", async () => {
        render(<BillingPage />);
        expect(await screen.findByText("Billing & Subscription")).toBeInTheDocument();
        expect(screen.getByText("Nomadix Premium Plan")).toBeInTheDocument();
        expect(await screen.findByText("Vaults Created")).toBeInTheDocument();
        expect(screen.getByText("Payment Receipts & Invoices")).toBeInTheDocument();
    });

    it("renders Language page with live formatting preview and language cards", () => {
        render(<LanguagePage />);
        expect(screen.getByText("Language & Regional Settings")).toBeInTheDocument();
        expect(screen.getByText("Live Regional Formatting Preview")).toBeInTheDocument();
        expect(screen.getByText("Español")).toBeInTheDocument();
        expect(screen.getByText("English")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save preferences/i })).toBeInTheDocument();
    });

    it("renders Support page with interactive FAQ accordion and ticket form", () => {
        render(<SupportPage />);
        expect(screen.getByText("Help & Support")).toBeInTheDocument();
        expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
        expect(screen.getByText("How does multi-currency conversion work in Nomadix?")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /submit ticket/i })).toBeInTheDocument();
    });

    it("renders Data Management page with JSON and CSV export and danger zone", () => {
        render(<DataManagementPage />);
        expect(screen.getByText("Data Management & Privacy")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /download json/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
        expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    });
});
