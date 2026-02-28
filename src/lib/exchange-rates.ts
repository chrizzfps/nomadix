import type { Currency } from "@/types";

const CACHE_KEY = "nomadix_exchange_rates";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedRates {
    rate: number; // USD → EUR
    timestamp: number;
}

function getCachedRate(): number | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached: CachedRates = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_TTL) return null;
        return cached.rate;
    } catch {
        return null;
    }
}

function setCachedRate(rate: number) {
    if (typeof window === "undefined") return;
    localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ rate, timestamp: Date.now() })
    );
}

/**
 * Fetches the USD→EUR exchange rate from a free API.
 * Rate means: 1 USD = X EUR (e.g. 0.92)
 * Falls back to cached value, then to a hardcoded default.
 */
export async function fetchExchangeRate(): Promise<number> {
    // Check cache first
    const cached = getCachedRate();
    if (cached) return cached;

    try {
        // Free API — base: USD
        const res = await fetch(
            "https://api.exchangerate-api.com/v4/latest/USD"
        );
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const rate = data.rates?.EUR;
        if (typeof rate === "number" && rate > 0) {
            setCachedRate(rate);
            return rate;
        }
        throw new Error("Invalid rate");
    } catch {
        // Fallback: try another free API
        try {
            const res2 = await fetch(
                "https://open.er-api.com/v6/latest/USD"
            );
            if (!res2.ok) throw new Error("API error");
            const data2 = await res2.json();
            const rate2 = data2.rates?.EUR;
            if (typeof rate2 === "number" && rate2 > 0) {
                setCachedRate(rate2);
                return rate2;
            }
        } catch {
            // ignore
        }
    }

    // Last resort: hardcoded fallback
    return cached || 0.92;
}

/**
 * Converts an amount from one currency to the target display currency.
 * usdToEurRate: 1 USD = X EUR (e.g. 0.82)
 *
 * USD → EUR: multiply by rate  (550 * 0.82 = 451)
 * EUR → USD: divide by rate    (451 / 0.82 = 550)
 */
export function convertAmount(
    amount: number,
    from: Currency,
    to: Currency,
    usdToEurRate: number
): number {
    if (from === to) return amount;
    // USD → EUR: multiply
    // EUR → USD: divide
    return from === "USD" ? amount * usdToEurRate : amount / usdToEurRate;
}
