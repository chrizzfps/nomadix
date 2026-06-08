function convertBetween(
    amount: number,
    from: string,
    to: string,
    offRate: number
): number {
    if (from === to) return amount;
    if (from === "USD" && to === "EUR") return amount * offRate;
    if (from === "EUR" && to === "USD") return amount / offRate;
    return amount;
}

function calculateBreakdown(params: {
    transactionAmount: number; // in database
    amountInput: number; // in UI
    currency: string; // original_currency
    type: string;
    useCustomRate: boolean;
    customRateMode: string;
    equivalentAmount: number;
    customRateVal: number;
    customRateDirection: string;
    offRate: number; // USD -> EUR
}) {
    const {
        transactionAmount,
        amountInput,
        currency,
        type,
        useCustomRate,
        customRateMode,
        equivalentAmount,
        customRateVal,
        customRateDirection,
        offRate
    } = params;

    const amountVal = amountInput;
    const oppositeCurrency = currency === "EUR" ? "USD" : "EUR";

    let finalRate = offRate;
    let finalEquivalent = 0;

    if (useCustomRate) {
        if (customRateMode === "auto") {
            const eqVal = equivalentAmount;
            if (eqVal > 0) {
                finalEquivalent = eqVal;
                if (currency === "EUR") {
                    finalRate = amountVal / eqVal;
                } else {
                    finalRate = eqVal / amountVal;
                }
            }
        } else {
            const manualVal = customRateVal;
            if (manualVal > 0) {
                if (currency === "EUR") {
                    if (customRateDirection === "from_to") {
                        finalEquivalent = amountVal * manualVal;
                        finalRate = 1 / manualVal;
                    } else {
                        finalEquivalent = amountVal / manualVal;
                        finalRate = manualVal;
                    }
                } else {
                    if (customRateDirection === "from_to") {
                        finalEquivalent = amountVal * manualVal;
                        finalRate = manualVal;
                    } else {
                        finalEquivalent = amountVal / manualVal;
                        finalRate = 1 / manualVal;
                    }
                }
            }
        }
    } else {
        finalEquivalent = currency === "EUR" ? amountVal / offRate : amountVal * offRate;
    }

    if (type === "transfer") {
        const isSource = transactionAmount < 0;
        const cSent = isSource ? currency : oppositeCurrency;
        const cReceived = isSource ? oppositeCurrency : currency;

        const sVal = isSource ? amountVal : finalEquivalent;
        const rVal = isSource ? finalEquivalent : amountVal;

        const officialReceived = cSent === "USD" ? sVal * offRate : sVal / offRate;
        const diffReceived = rVal - officialReceived;
        const isGain = diffReceived > 0;

        const differenceDest = diffReceived;
        const differenceSource = cReceived === "USD" ? diffReceived * offRate : diffReceived / offRate;

        return {
            officialRate: offRate,
            appliedRate: finalRate,
            isTransfer: true,
            isGain,
            differenceDest,
            differenceSource,
            oppositeCurrency,
            appliedEquivalent: finalEquivalent,
            symbol: transactionAmount < 0 ? oppositeCurrency : currency
        };
    }
    return null;
}

describe("Transfer Math Tests", () => {
    it("tests EUR -> USD transfer (editing Binance USD deposit side)", () => {
        // Nickel (EUR) -> Binance (USD)
        // Sent 133 EUR, received 148 USD
        // Binance (USD) transaction amount in DB is positive +148
        const result = calculateBreakdown({
            transactionAmount: 148, // positive!
            amountInput: 148,
            currency: "USD",
            type: "transfer",
            useCustomRate: true,
            customRateMode: "manual",
            equivalentAmount: 133,
            customRateVal: 0.8986,
            customRateDirection: "from_to", // 1 USD = 0.8986 EUR
            offRate: 0.8580 // official USD -> EUR rate
        });

        console.log("RESULT DEST:", result);
        expect(result?.isGain).toBe(false); // Should be a loss!
    });

    it("tests EUR -> USD transfer (editing Nickel EUR source side)", () => {
        // Nickel (EUR) -> Binance (USD)
        // Sent 133 EUR, received 148 USD
        // Nickel (EUR) transaction amount in DB is negative -133
        const result = calculateBreakdown({
            transactionAmount: -133, // negative!
            amountInput: 133,
            currency: "EUR",
            type: "transfer",
            useCustomRate: true,
            customRateMode: "manual",
            equivalentAmount: 148,
            customRateVal: 1.1128, // 1 EUR = 1.1128 USD
            customRateDirection: "from_to",
            offRate: 0.8580
        });

        console.log("RESULT SOURCE:", result);
        expect(result?.isGain).toBe(false); // Should be a loss!
    });
});
