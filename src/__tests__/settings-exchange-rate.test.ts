import { useCurrencyStore } from "@/stores/currency-store";

describe("Settings Exchange Rate Auto-polling & Manual override", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("defaults to live rate when manual rate is disabled", () => {
        const state = useCurrencyStore.getState();
        state.setManualRate({ enabled: false, rate: 0.95 });
        state.setExchangeRate(0.863);

        expect(useCurrencyStore.getState().getActiveRate()).toBe(0.863);
    });

    it("uses manual rate when enabled", () => {
        const state = useCurrencyStore.getState();
        state.setManualRate({ enabled: true, rate: 0.88 });
        state.setExchangeRate(0.863);

        expect(useCurrencyStore.getState().getActiveRate()).toBe(0.88);
    });

    it("refreshLiveRate forces fresh fetch and updates store rate and timestamp", async () => {
        global.fetch = jest.fn().mockImplementation((url: string) => {
            if (url.includes("exchangerate-api.com")) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ rates: { EUR: 0.8635 } }),
                });
            }
            return Promise.resolve({ ok: false });
        }) as jest.Mock;

        const state = useCurrencyStore.getState();
        state.setManualRate({ enabled: false, rate: 0.90 });

        const newRate = await state.refreshLiveRate();
        expect(newRate).toBe(0.8635);
        expect(useCurrencyStore.getState().exchangeRate).toBe(0.8635);
        expect(useCurrencyStore.getState().lastUpdated).toBeGreaterThan(0);
        expect(useCurrencyStore.getState().getActiveRate()).toBe(0.8635);
    });

    it("converts amounts correctly based on active rate", () => {
        const state = useCurrencyStore.getState();
        state.setManualRate({ enabled: false, rate: 0.90 });
        state.setExchangeRate(0.80); // 1 USD = 0.80 EUR

        // If display currency is EUR:
        useCurrencyStore.setState({ displayCurrency: "EUR" });
        // 100 USD in EUR = 100 * 0.80 = 80 EUR
        expect(useCurrencyStore.getState().convert(100, "USD")).toBe(80);

        // If display currency is USD:
        useCurrencyStore.setState({ displayCurrency: "USD" });
        // 80 EUR in USD = 80 / 0.80 = 100 USD
        expect(useCurrencyStore.getState().convert(80, "EUR")).toBe(100);
    });
});
