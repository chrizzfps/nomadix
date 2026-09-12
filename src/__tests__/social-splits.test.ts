import {
    describeNetBalance,
    previewSplitAmount,
    validateSplitValue,
} from "@/lib/social";

describe("previewSplitAmount", () => {
    it("equal splits into exact halves", () => {
        expect(previewSplitAmount(-100, "equal", null)).toBe(50);
        expect(previewSplitAmount(100, "equal", null)).toBe(50);
    });

    it("amount mode uses the raw value, rounded", () => {
        expect(previewSplitAmount(-100, "amount", 33.333)).toBe(33.33);
    });

    it("percent mode computes a fraction of the total's magnitude", () => {
        expect(previewSplitAmount(-40, "percent", 25)).toBe(10);
    });

    it("uses the transaction's absolute value regardless of sign", () => {
        expect(previewSplitAmount(-100, "equal", null)).toBe(
            previewSplitAmount(100, "equal", null)
        );
    });
});

describe("validateSplitValue", () => {
    it("equal mode never needs a value", () => {
        expect(validateSplitValue(-100, "equal", null)).toBeNull();
    });

    it("amount mode rejects zero, negative, null and over-total", () => {
        expect(validateSplitValue(-100, "amount", null)).not.toBeNull();
        expect(validateSplitValue(-100, "amount", 0)).not.toBeNull();
        expect(validateSplitValue(-100, "amount", -5)).not.toBeNull();
        expect(validateSplitValue(-100, "amount", 100.01)).not.toBeNull();
        expect(validateSplitValue(-100, "amount", 100)).toBeNull();
    });

    it("percent mode rejects outside (0, 100]", () => {
        expect(validateSplitValue(-100, "percent", 0)).not.toBeNull();
        expect(validateSplitValue(-100, "percent", 101)).not.toBeNull();
        expect(validateSplitValue(-100, "percent", 50)).toBeNull();
        expect(validateSplitValue(-100, "percent", 100)).toBeNull();
    });
});

describe("describeNetBalance", () => {
    it("marks a positive net as the friend owing the viewer", () => {
        const result = describeNetBalance(50);
        expect(result.owesYou).toBe(true);
        expect(result.absAmount).toBe(50);
        expect(result.isSettled).toBe(false);
    });

    it("marks a negative net as the viewer owing the friend", () => {
        const result = describeNetBalance(-50);
        expect(result.owesYou).toBe(false);
        expect(result.absAmount).toBe(50);
        expect(result.isSettled).toBe(false);
    });

    it("treats anything under half a cent as settled", () => {
        expect(describeNetBalance(0).isSettled).toBe(true);
        expect(describeNetBalance(0.001).isSettled).toBe(true);
        expect(describeNetBalance(0.01).isSettled).toBe(false);
    });
});
