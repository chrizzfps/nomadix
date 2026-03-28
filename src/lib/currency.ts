import type { Currency } from "@/types";
import { convertAmount } from "@/lib/exchange-rates";

export function getActiveUsdToEurRate(input: number) {
    return Number.isFinite(input) && input > 0 ? input : 0.92;
}

export function convertWithRate(
    amount: number,
    from: Currency,
    to: Currency,
    usdToEurRate: number
) {
    return convertAmount(amount, from, to, getActiveUsdToEurRate(usdToEurRate));
}

export function formatMoney(
    amount: number,
    currency: Currency,
    locale = "en-US"
) {
    const symbol = currency === "EUR" ? "€" : "$";
    return (
        symbol +
        amount.toLocaleString(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

