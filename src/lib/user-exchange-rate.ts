import { z } from "zod";

export const ExchangeRateCurrencySchema = z.enum(["USD", "EUR"]);

export const ExchangeRatePutSchema = z.object({
    baseCurrency: ExchangeRateCurrencySchema.default("USD"),
    targetCurrency: ExchangeRateCurrencySchema.default("EUR"),
    exchangeRate: z.number().positive(),
});

export function safeParseExchangeRatePutPayload(input: unknown) {
    return ExchangeRatePutSchema.safeParse(input);
}

