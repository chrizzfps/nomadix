import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useRemindersStore } from "@/stores/reminders-store";

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

jest.mock("@/stores/reminders-store", () => ({
    useRemindersStore: jest.fn(),
}));

describe("NotificationBell UI alignment and toggle", () => {
    beforeEach(() => {
        (useRemindersStore as unknown as jest.Mock).mockReturnValue({
            items: [],
            unreadCount: 0,
            load: jest.fn(),
            markAllSeen: jest.fn(),
        });
    });

    it("renders bell button", () => {
        render(<NotificationBell align="left" />);
        expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });

    it("opens towards the right (left-0 origin-top-left) when align='left' for sidebar", () => {
        render(<NotificationBell align="left" />);
        const button = screen.getByRole("button", { name: /notifications/i });
        fireEvent.click(button);

        expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
        const modal = screen.getByText("You're all caught up.").closest("div[class*='absolute']");
        expect(modal).toHaveClass("left-0");
        expect(modal).toHaveClass("origin-top-left");
        expect(modal).not.toHaveClass("right-0");
    });

    it("opens with right-0 when align='right' for top/mobile bar", () => {
        render(<NotificationBell align="right" />);
        const button = screen.getByRole("button", { name: /notifications/i });
        fireEvent.click(button);

        expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
        const modal = screen.getByText("You're all caught up.").closest("div[class*='absolute']");
        expect(modal).toHaveClass("right-0");
        expect(modal).toHaveClass("origin-top-right");
        expect(modal).not.toHaveClass("left-0");
    });

    it("displays notification items when present", () => {
        (useRemindersStore as unknown as jest.Mock).mockReturnValue({
            items: [
                {
                    id: "rem-1",
                    subscriptionId: "sub-1",
                    kind: "upcoming",
                    title: "Spotify Subscription",
                    amount: 9.99,
                    currency: "USD",
                    dueDate: "2026-09-10",
                },
            ],
            unreadCount: 1,
            load: jest.fn(),
            markAllSeen: jest.fn(),
        });

        render(<NotificationBell align="left" />);
        const button = screen.getByRole("button", { name: /notifications/i });
        fireEvent.click(button);

        expect(screen.getByText("Spotify Subscription")).toBeInTheDocument();
        expect(screen.getByText("Upcoming")).toBeInTheDocument();
    });
});
