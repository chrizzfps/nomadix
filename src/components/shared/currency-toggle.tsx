"use client";

import { useCurrencyStore } from "@/stores/currency-store";

interface CurrencyToggleProps {
    className?: string;
}

export function CurrencyToggle({ className }: CurrencyToggleProps) {
    const { displayCurrency, toggleCurrency } = useCurrencyStore();

    return (
        <div
            className={`inline-flex items-center rounded-full bg-zinc-100 p-0.5 ${className}`}
        >
            <button
                onClick={() => displayCurrency !== "USD" && toggleCurrency()}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "USD"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
            >
                USD
            </button>
            <button
                onClick={() => displayCurrency !== "EUR" && toggleCurrency()}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "EUR"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
            >
                EUR
            </button>
        </div>
    );
}
