import { convertWithRate, formatMoney } from "@/lib/currency";

describe("currency conversion", () => {
    it("converts USD to EUR using rate", () => {
        expect(convertWithRate(100, "USD", "EUR", 0.9)).toBeCloseTo(90, 8);
    });

    it("converts EUR to USD using rate", () => {
        expect(convertWithRate(90, "EUR", "USD", 0.9)).toBeCloseTo(100, 8);
    });

    it("formats with 2 decimals", () => {
        expect(formatMoney(1799.09, "USD")).toBe("$1,799.09");
        expect(formatMoney(1799.09, "EUR")).toBe("€1,799.09");
    });
});

