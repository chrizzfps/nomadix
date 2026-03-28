import { create } from "zustand";
import type { Currency } from "@/types";
import { fetchExchangeRate, convertAmount } from "@/lib/exchange-rates";

const MANUAL_RATE_KEY = "nomadix_manual_rate";

interface ManualRateConfig {
    enabled: boolean;
    rate: number; // USD → EUR (e.g. 0.82 means $1 = €0.82)
}

function loadManualRate(): ManualRateConfig {
    if (typeof window === "undefined") return { enabled: false, rate: 0.92 };
    try {
        const raw = localStorage.getItem(MANUAL_RATE_KEY);
        if (!raw) return { enabled: false, rate: 0.92 };
        return JSON.parse(raw);
    } catch {
        return { enabled: false, rate: 0.92 };
    }
}

function saveManualRate(config: ManualRateConfig) {
    if (typeof window === "undefined") return;
    localStorage.setItem(MANUAL_RATE_KEY, JSON.stringify(config));
}

interface CurrencyState {
    displayCurrency: Currency;
    exchangeRate: number; // USD → EUR rate (from API)
    manualRate: ManualRateConfig;
    rateLoaded: boolean;
    toggleCurrency: () => void;
    setExchangeRate: (rate: number) => void;
    setManualRate: (config: ManualRateConfig) => void;
    convert: (amount: number, from: Currency) => number;
    loadRate: () => Promise<void>;
    getActiveRate: () => number;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
    displayCurrency: "USD",
    exchangeRate: 0.92,
    manualRate: loadManualRate(),
    rateLoaded: false,
    toggleCurrency: () =>
        set((state) => ({
            displayCurrency: state.displayCurrency === "USD" ? "EUR" : "USD",
        })),
    setExchangeRate: (exchangeRate) => set({ exchangeRate }),
    setManualRate: (config) => {
        saveManualRate(config);
        set({ manualRate: config });
    },
    getActiveRate: () => {
        const { manualRate, exchangeRate } = get();
        return manualRate.enabled ? manualRate.rate : exchangeRate;
    },
    convert: (amount, from) => {
        const { displayCurrency, manualRate, exchangeRate } = get();
        const activeRate = manualRate.enabled ? manualRate.rate : exchangeRate;
        return convertAmount(amount, from, displayCurrency, activeRate);
    },
    loadRate: async () => {
        if (get().rateLoaded) return;
        if (typeof window !== "undefined") {
            try {
                const res = await fetch(
                    "/api/exchange-rate?baseCurrency=USD&targetCurrency=EUR"
                );
                if (res.ok) {
                    const json = (await res.json()) as {
                        exchangeRate?: number;
                    };
                    if (
                        typeof json.exchangeRate === "number" &&
                        json.exchangeRate > 0
                    ) {
                        const current = get().manualRate;
                        const next = {
                            enabled: current.enabled,
                            rate: json.exchangeRate,
                        };
                        saveManualRate(next);
                        set({ manualRate: next });
                    }
                }
            } catch {
            }
        }
        const rate = await fetchExchangeRate();
        set({ exchangeRate: rate, rateLoaded: true });
    },
}));
