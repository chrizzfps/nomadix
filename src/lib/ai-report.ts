// ============================================
// AI Monthly Report — data aggregation (pure logic)
// ============================================
//
// Every number in the report comes from here, computed in plain TypeScript
// from real rows. The OpenAI call never sees raw transactions and is never
// asked to add anything up — it only narrates numbers we already trust.
// Mirrors the "every number comes from subscriptions.ts" rule there.

import type { Currency, Subscription, Transaction, Vault } from "@/types";
import { convertTransactionAmount } from "@/lib/currency-helpers";
import { monthlyEquivalent } from "@/lib/subscriptions";

export interface CategoryTotal {
    category: string;
    amount: number;
}

export interface BiggestExpense {
    id: string;
    vaultId: string;
    description: string;
    amount: number;
    date: string;
}

export interface VaultBalance {
    name: string;
    currency: Currency;
    balance: number;
}

export interface MonthPeriodTotals {
    income: number;
    expense: number;
    net: number;
}

export interface MonthlyReportContext {
    monthISO: string;
    monthLabel: string;
    currency: Currency;
    current: MonthPeriodTotals;
    previous: MonthPeriodTotals | null;
    topExpenseCategories: CategoryTotal[];
    biggestExpenses: BiggestExpense[];
    activeSubscriptionsMonthlyCost: number;
    activeSubscriptionCount: number;
    vaultBalances: VaultBalance[];
    netWorth: number;
}

/** "2026-09" -> "September 2026" */
export function monthLabel(monthISO: string): string {
    const [y, m] = monthISO.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

/** "2026-09" -> "2026-08" */
export function previousMonthISO(monthISO: string): string {
    const [y, m] = monthISO.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(dateStr: string, monthISO: string): boolean {
    return (dateStr || "").slice(0, 7) === monthISO;
}

function computePeriodTotals(
    transactions: Transaction[],
    monthISO: string,
    reportCurrency: Currency,
    usdEurRate: number,
    vaultCurrencyOf: Map<string, Currency>
): MonthPeriodTotals {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
        if (!isInMonth(t.date, monthISO)) continue;
        const from = vaultCurrencyOf.get(t.vault_id) || t.original_currency;
        const converted = convertTransactionAmount(
            t.amount,
            from,
            reportCurrency,
            t.exchange_rate_at_time,
            usdEurRate
        );
        if (t.type === "expense") expense += Math.abs(converted);
        else if (t.type === "income") income += Math.abs(converted);
    }
    return { income, expense, net: income - expense };
}

export function buildMonthlyReportContext(params: {
    transactions: Transaction[];
    subscriptions: Subscription[];
    vaults: Vault[];
    monthISO: string;
    reportCurrency: Currency;
    usdEurRate: number;
}): MonthlyReportContext {
    const { transactions, subscriptions, vaults, monthISO, reportCurrency, usdEurRate } = params;

    const vaultCurrencyOf = new Map(vaults.map((v) => [v.id, v.currency]));
    const convert = (amount: number, from: Currency) =>
        convertTransactionAmount(amount, from, reportCurrency, null, usdEurRate);

    const current = computePeriodTotals(
        transactions,
        monthISO,
        reportCurrency,
        usdEurRate,
        vaultCurrencyOf
    );
    const prevISO = previousMonthISO(monthISO);
    const hasPrevious = transactions.some((t) => isInMonth(t.date, prevISO));
    const previous = hasPrevious
        ? computePeriodTotals(transactions, prevISO, reportCurrency, usdEurRate, vaultCurrencyOf)
        : null;

    const categoryMap = new Map<string, number>();
    const currentMonthExpenses = transactions.filter(
        (t) => t.type === "expense" && isInMonth(t.date, monthISO)
    );
    for (const t of currentMonthExpenses) {
        const from = vaultCurrencyOf.get(t.vault_id) || t.original_currency;
        const amount = Math.abs(
            convertTransactionAmount(t.amount, from, reportCurrency, t.exchange_rate_at_time, usdEurRate)
        );
        const key = t.category || "Other";
        categoryMap.set(key, (categoryMap.get(key) || 0) + amount);
    }
    const topExpenseCategories: CategoryTotal[] = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    const biggestExpenses: BiggestExpense[] = currentMonthExpenses
        .map((t) => {
            const from = vaultCurrencyOf.get(t.vault_id) || t.original_currency;
            return {
                id: t.id,
                vaultId: t.vault_id,
                description: t.description || t.category || "Expense",
                amount: Math.abs(
                    convertTransactionAmount(
                        t.amount,
                        from,
                        reportCurrency,
                        t.exchange_rate_at_time,
                        usdEurRate
                    )
                ),
                date: t.date,
            };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    const activeSubs = subscriptions.filter((s) => s.status === "active");
    const activeSubscriptionsMonthlyCost = activeSubs.reduce((sum, s) => {
        const monthly = monthlyEquivalent(s);
        const signed = s.direction === "expense" ? monthly : -monthly;
        return sum + convert(signed, s.currency);
    }, 0);

    const balanceMap = new Map<string, number>();
    for (const t of transactions) {
        balanceMap.set(t.vault_id, (balanceMap.get(t.vault_id) || 0) + Number(t.amount));
    }
    const vaultBalances: VaultBalance[] = vaults.map((v) => ({
        name: v.name,
        currency: v.currency,
        balance: balanceMap.get(v.id) || 0,
    }));
    const netWorth = vaultBalances.reduce((sum, v) => sum + convert(v.balance, v.currency), 0);

    return {
        monthISO,
        monthLabel: monthLabel(monthISO),
        currency: reportCurrency,
        current,
        previous,
        topExpenseCategories,
        biggestExpenses,
        activeSubscriptionsMonthlyCost,
        activeSubscriptionCount: activeSubs.length,
        vaultBalances,
        netWorth,
    };
}

export type ReportLanguage = "en" | "es";

const LANGUAGE_INSTRUCTION: Record<ReportLanguage, string> = {
    en: "Write your entire reply in English.",
    es: "Escribí toda tu respuesta en español (España/neutro), nunca en inglés.",
};

export function buildReportPrompt(
    ctx: MonthlyReportContext,
    language: ReportLanguage = "en"
): {
    system: string;
    user: string;
} {
    const system =
        "You are a concise, honest personal finance assistant inside the Nomadix app. " +
        "You are given already-computed figures for one month — never recompute or " +
        "second-guess them, and never invent numbers that are not in the data. " +
        `${LANGUAGE_INSTRUCTION[language]} No markdown headers, no emoji. ` +
        "Structure your reply in exactly three parts, each on its own paragraph or list: " +
        "1) a 2-3 sentence summary of the month, " +
        "2) 3-5 short bullet insights (start each line with '- '), " +
        "3) 1-2 short actionable recommendations (start each line with '- ').";

    const user = JSON.stringify(
        {
            month: ctx.monthLabel,
            currency: ctx.currency,
            thisMonth: ctx.current,
            previousMonth: ctx.previous,
            topExpenseCategories: ctx.topExpenseCategories,
            biggestExpenses: ctx.biggestExpenses.map((e) => ({
                description: e.description,
                amount: e.amount,
                date: e.date,
            })),
            activeSubscriptions: {
                count: ctx.activeSubscriptionCount,
                monthlyCost: ctx.activeSubscriptionsMonthlyCost,
            },
            vaultBalances: ctx.vaultBalances,
            netWorth: ctx.netWorth,
        },
        null,
        2
    );

    return { system, user };
}
