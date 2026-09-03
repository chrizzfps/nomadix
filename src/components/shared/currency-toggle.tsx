"use client";

import { useCurrencyStore } from "@/stores/currency-store";

interface CurrencyToggleProps {
    className?: string;
}

export function CurrencyToggle({ className }: CurrencyToggleProps) {
    const { displayCurrency, toggleCurrency } = useCurrencyStore();

    return (
        <div
            className={`inline-flex items-center rounded-full bg-accent p-0.5 ${className}`}
        >
            <button
                onClick={() => displayCurrency !== "USD" && toggleCurrency()}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "USD"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
            >
                USD
            </button>
            <button
                onClick={() => displayCurrency !== "EUR" && toggleCurrency()}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "EUR"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
            >
                EUR
            </button>
        </div>
    );
}
