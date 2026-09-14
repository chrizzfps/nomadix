"use client";

// ============================================
// usePlan — the account's current Free/Pro tier
// ============================================
//
// Reads public.account_plans, which only ever holds a row once a user
// upgrades — an absent row means free, matching nomadix_current_tier() in
// supabase/schema.sql. Never write to account_plans from the client: RLS
// grants select only, writes happen via the billing webhook, the manual
// activation snippet, or a security-definer RPC.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlanStore, FREE_PLAN, type AccountPlan } from "@/stores/plan-store";

const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // same grace window as nomadix_current_tier()

export function usePlan() {
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const { plan, loadedForUserId, isLoading, setPlan, setLoading } = usePlanStore();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!cancelled) setUserId(user?.id);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!userId || loadedForUserId === userId) return;

        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("account_plans")
                    .select(
                        "tier, status, period_interval, current_period_end, cancel_at_period_end"
                    )
                    .eq("user_id", userId)
                    .maybeSingle();

                if (cancelled) return;

                if (error || !data) {
                    setPlan(userId, FREE_PLAN);
                    return;
                }

                const withinGrace =
                    !data.current_period_end ||
                    new Date(data.current_period_end).getTime() > Date.now() - GRACE_MS;
                const effectiveTier: AccountPlan["tier"] =
                    data.tier === "pro" && data.status !== "canceled" && withinGrace
                        ? "pro"
                        : "free";

                setPlan(userId, {
                    tier: effectiveTier,
                    status: data.status,
                    periodInterval: data.period_interval,
                    currentPeriodEnd: data.current_period_end,
                    cancelAtPeriodEnd: data.cancel_at_period_end,
                });
            } catch {
                if (!cancelled) setPlan(userId, FREE_PLAN);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, loadedForUserId, setPlan, setLoading]);

    return {
        plan,
        tier: plan.tier,
        isPro: plan.tier === "pro",
        isLoading,
    };
}

/** Call after returning from checkout / cancellation so the UI refetches
 *  the tier instead of trusting a stale cached value. */
export function useInvalidatePlan() {
    return usePlanStore((s) => s.invalidate);
}
