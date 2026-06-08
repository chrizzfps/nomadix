import type { Currency } from "@/types";

/**
 * Converts a transaction amount from its original currency to the target display currency.
 * If the transaction has a custom exchange rate (exchange_rate_at_time) stored, it will use that.
 * Otherwise, it falls back to the provided global rate.
 *
 * exchangeRate is represented as USD -> EUR (e.g. 0.92 means 1 USD = 0.92 EUR)
 */
export function convertTransactionAmount(
    amount: number,
    from: Currency,
    to: Currency,
    customRate: number | null | undefined,
    globalRate: number
): number {
    if (from === to) return amount;
    const rate = (customRate && customRate > 0) ? customRate : globalRate;
    // USD -> EUR: multiply by rate
    // EUR -> USD: divide by rate
    return from === "USD" ? amount * rate : amount / rate;
}
