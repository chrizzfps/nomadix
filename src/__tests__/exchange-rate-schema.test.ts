import { safeParseExchangeRatePutPayload } from "@/lib/user-exchange-rate";

describe("exchange rate payload validation", () => {
    it("rejects non-positive rates", () => {
        const parsed = safeParseExchangeRatePutPayload({
            baseCurrency: "USD",
            targetCurrency: "EUR",
            exchangeRate: 0,
        });
        expect(parsed.success).toBe(false);
    });

    it("accepts valid rates", () => {
        const parsed = safeParseExchangeRatePutPayload({
            baseCurrency: "USD",
            targetCurrency: "EUR",
            exchangeRate: 0.95,
        });
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.exchangeRate).toBe(0.95);
    });
});

