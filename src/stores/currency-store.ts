import { create } from "zustand";
import type { Currency } from "@/types";
import { fetchExchangeRate, convertAmount } from "@/lib/exchange-rates";
import { createClient } from "@/lib/supabase/client";

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
    lastUpdated: number | null;
    toggleCurrency: () => void;
    setExchangeRate: (rate: number) => void;
    setManualRate: (config: ManualRateConfig) => void;
    convert: (amount: number, from: Currency) => number;
    loadRate: (forceRefresh?: boolean) => Promise<void>;
    refreshLiveRate: () => Promise<number>;
    getActiveRate: () => number;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
    displayCurrency: "USD",
    exchangeRate: 0.863,
    manualRate: loadManualRate(),
    rateLoaded: false,
    lastUpdated: null,
    toggleCurrency: () =>
        set((state) => ({
            displayCurrency: state.displayCurrency === "USD" ? "EUR" : "USD",
        })),
    setExchangeRate: (exchangeRate) => set({ exchangeRate }),
    setManualRate: (config) => {
        saveManualRate(config);
        set({ manualRate: config });
        void persistActiveRate(config.enabled ? config.rate : get().exchangeRate);
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
    loadRate: async (forceRefresh = false) => {
        if (get().rateLoaded && !forceRefresh) return;
        
        // Fetch fresh rate from external API
        const rate = await fetchExchangeRate(forceRefresh);
        set({
            exchangeRate: rate,
            rateLoaded: true,
            lastUpdated: Date.now(),
        });

        // If the user hasn't explicitly set a local preference, check server once
        const currentManual = get().manualRate;
        if (!currentManual.enabled && typeof window !== "undefined") {
            try {
                const res = await fetch(
                    "/api/exchange-rate?baseCurrency=USD&targetCurrency=EUR"
                );
                if (res.ok) {
                    const json = (await res.json()) as {
                        exchangeRate?: number;
                    };
                    // Keep live rate as default active rate
                    if (
                        typeof json.exchangeRate === "number" &&
                        json.exchangeRate > 0 &&
                        currentManual.enabled
                    ) {
                        set({
                            manualRate: { enabled: true, rate: json.exchangeRate },
                        });
                    }
                }
            } catch {
                // ignore
            }
        }

        // Persist active rate for server-side functions
        void persistActiveRate(get().getActiveRate());
    },
    refreshLiveRate: async () => {
        const rate = await fetchExchangeRate(true);
        set({
            exchangeRate: rate,
            rateLoaded: true,
            lastUpdated: Date.now(),
        });
        void persistActiveRate(get().getActiveRate());
        return rate;
    },
}));

async function persistActiveRate(rate: number) {
    if (!rate || rate <= 0) return;
    try {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from("user_exchange_rates").upsert(
            {
                user_id: user.id,
                base_currency: "USD",
                target_currency: "EUR",
                exchange_rate: rate,
                last_updated: new Date().toISOString(),
            },
            { onConflict: "user_id,base_currency,target_currency" }
        );
    } catch {
        // best-effort only
    }
}
