import { isLiquidVault, LIQUID_VAULT_TYPES } from "@/lib/receivables";

// This is the test that protects the whole receivables feature: a vault of
// type "receivable" holds money that has not arrived yet, and must never be
// counted as liquid anywhere in the app (totals, net worth, runway,
// transfer/split/subscription vault pickers).
describe("isLiquidVault", () => {
    it("treats savings, checking and cash as liquid", () => {
        expect(isLiquidVault("savings")).toBe(true);
        expect(isLiquidVault("checking")).toBe(true);
        expect(isLiquidVault("cash")).toBe(true);
    });

    it("excludes receivable vaults", () => {
        expect(isLiquidVault("receivable")).toBe(false);
    });

    it("defaults an unknown or missing type to liquid (fail open on the read side, not the guard)", () => {
        expect(isLiquidVault(undefined)).toBe(true);
        expect(isLiquidVault(null)).toBe(true);
        expect(isLiquidVault("")).toBe(true);
    });

    it("LIQUID_VAULT_TYPES matches the types isLiquidVault accepts", () => {
        for (const t of LIQUID_VAULT_TYPES) {
            expect(isLiquidVault(t)).toBe(true);
        }
    });
});

describe("totalBalance-style aggregation excludes receivable vaults", () => {
    interface FakeVault {
        id: string;
        type: string;
        currency: "EUR" | "USD";
        balance: number;
    }

    const vaults: FakeVault[] = [
        { id: "v1", type: "checking", currency: "USD", balance: 600 },
        { id: "v2", type: "cash", currency: "USD", balance: 400 },
        { id: "v3", type: "receivable", currency: "USD", balance: 500 },
    ];

    // Identity conversion (same currency) keeps the math legible here —
    // the real app always runs amounts through useCurrencyStore().convert.
    const convert = (amount: number, _from: "EUR" | "USD") => amount;

    it("totalBalance (liquid only) excludes the receivable vault's balance", () => {
        const totalBalance = vaults
            .filter((v) => isLiquidVault(v.type))
            .reduce((sum, v) => sum + convert(v.balance, v.currency), 0);

        expect(totalBalance).toBe(1000);
    });

    it("the projected total (liquid + pending collection) includes it", () => {
        const totalBalance = vaults
            .filter((v) => isLiquidVault(v.type))
            .reduce((sum, v) => sum + convert(v.balance, v.currency), 0);
        const pendingCollection = vaults
            .filter((v) => !isLiquidVault(v.type))
            .reduce((sum, v) => sum + convert(v.balance, v.currency), 0);

        expect(pendingCollection).toBe(500);
        expect(totalBalance + pendingCollection).toBe(1500);
    });

    it("a vault-of-origin picker (transfers/subscriptions/splits) never offers a receivable vault", () => {
        const pickerOptions = vaults.filter((v) => isLiquidVault(v.type));
        expect(pickerOptions.map((v) => v.id)).toEqual(["v1", "v2"]);
        expect(pickerOptions.some((v) => v.type === "receivable")).toBe(false);
    });
});
