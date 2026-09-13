import { create } from "zustand";
import type { Tier } from "@/lib/plan";

// ============================================
// Account plan store — cache for usePlan()
// ============================================
//
// Same shape as every other store in this folder (auth-store, currency-
// store, ...): a plain Zustand cache, no react-query. This app has no
// react-query provider mounted in its test renders, so a hook that reads
// public.account_plans has to cache and refetch itself instead of relying
// on a query-client context.

export interface AccountPlan {
    tier: Tier;
    status: "active" | "past_due" | "canceled";
    periodInterval: "month" | "year" | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
}

export const FREE_PLAN: AccountPlan = {
    tier: "free",
    status: "active",
    periodInterval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
};

interface PlanState {
    plan: AccountPlan;
    loadedForUserId: string | null;
    isLoading: boolean;
    setPlan: (userId: string, plan: AccountPlan) => void;
    setLoading: (loading: boolean) => void;
    /** Force the next usePlan() call to refetch — call after checkout
     *  returns, a cancellation, or a manual plan grant. */
    invalidate: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
    plan: FREE_PLAN,
    loadedForUserId: null,
    isLoading: false,
    setPlan: (userId, plan) => set({ plan, loadedForUserId: userId, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),
    invalidate: () => set({ loadedForUserId: null }),
}));
