import {
    previewTransferConversion,
    reversalWindowRemaining,
    transferDirectionLabel,
} from "@/lib/social";

describe("previewTransferConversion", () => {
    it("passes the amount through unchanged for same-currency transfers", () => {
        expect(previewTransferConversion(100, "EUR", "EUR", 0.92)).toBe(100);
        expect(previewTransferConversion(50, "USD", "USD", 0.92)).toBe(50);
    });

    it("multiplies by the rate going USD -> EUR", () => {
        expect(previewTransferConversion(100, "USD", "EUR", 0.92)).toBe(92);
    });

    it("divides by the rate going EUR -> USD", () => {
        expect(previewTransferConversion(92, "EUR", "USD", 0.92)).toBeCloseTo(100, 5);
    });

    it("rounds to 2 decimals like the database does", () => {
        expect(previewTransferConversion(33.333, "USD", "EUR", 0.9)).toBe(30);
    });
});

describe("reversalWindowRemaining", () => {
    it("is expired when there is no window at all (internal transfers)", () => {
        expect(reversalWindowRemaining(null).expired).toBe(true);
    });

    it("is expired once reversible_until has passed", () => {
        const now = new Date("2026-01-02T00:00:00Z");
        expect(reversalWindowRemaining("2026-01-01T00:00:00Z", now).expired).toBe(true);
    });

    it("reports hours and minutes left within the window", () => {
        const now = new Date("2026-01-01T00:00:00Z");
        const until = new Date("2026-01-01T05:30:00Z").toISOString();
        const result = reversalWindowRemaining(until, now);
        expect(result.expired).toBe(false);
        expect(result.hoursLeft).toBe(5);
        expect(result.minutesLeft).toBe(30);
    });

    it("shows 0h in the final hour of the window", () => {
        const now = new Date("2026-01-01T23:50:00Z");
        const until = new Date("2026-01-02T00:00:00Z").toISOString();
        const result = reversalWindowRemaining(until, now);
        expect(result.expired).toBe(false);
        expect(result.hoursLeft).toBe(0);
        expect(result.minutesLeft).toBe(10);
    });
});

describe("transferDirectionLabel", () => {
    it("labels a transfer as sent when the viewer is the sender", () => {
        expect(
            transferDirectionLabel({ sender_user_id: "u1", kind: "friend" }, "u1")
        ).toBe("sent");
    });

    it("labels a transfer as received when the viewer is not the sender", () => {
        expect(
            transferDirectionLabel({ sender_user_id: "u1", kind: "friend" }, "u2")
        ).toBe("received");
    });
});
