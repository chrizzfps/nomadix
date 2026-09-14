// ============================================
// Account plans (Free / Pro) — pure logic
// ============================================
//
// public.subscriptions is a PRODUCT feature (the user's own Netflix-style
// recurring charges) — this file is unrelated to that and only concerns
// Nomadix's own monetization tier, stored in public.account_plans.
//
// Guiding rule: never limit the act of recording money. Transactions,
// transfers, splits, and friends are unlimited on every tier — only the
// *number of entities* (vaults, clients, documents…) and *depth* (history
// range, AI reports) are gated. See supabase/schema.sql's
// nomadix_assert_quota() for the server-side mirror of PLAN_LIMITS below —
// if you change a number here, change it there too, or the client and the
// database will disagree about what's allowed.

export type Tier = "free" | "pro";

export type GatedEntity =
    | "vault"
    | "category"
    | "subscription"
    | "receivable"
    | "client"
    | "document"
    | "trip";

/** Entity limits for the free tier.
 *  Mirrors the `case p_entity when ...` in nomadix_assert_quota() exactly. */
export const PLAN_LIMITS: Record<GatedEntity, number> = {
    vault: 3,
    category: 5,
    subscription: 5,
    receivable: 0,
    client: 0,
    document: 2,
    trip: 1,
};

/** Entity limits for the pro tier — generous, not unlimited, so nothing in
 *  the product can be turned into an unbounded row count. Mirrors the pro
 *  branch of nomadix_assert_quota() exactly. */
export const PRO_PLAN_LIMITS: Record<GatedEntity, number> = {
    vault: 20,
    category: 30,
    subscription: 30,
    receivable: 20,
    client: 20,
    document: 15,
    trip: 12,
};

/** How many months of history a free user can see in dashboards, charts,
 *  and reports. Data older than this is never deleted — it is simply not
 *  rendered until the user upgrades. */
export const FREE_HISTORY_MONTHS = 3;

export function isPro(tier: Tier | null | undefined): boolean {
    return tier === "pro";
}

/** Returns the earliest ISO date (YYYY-MM-DD) a given tier is allowed to
 *  see, or null when there is no cutoff (pro, or an explicit "all time"). */
export function historyCutoff(tier: Tier | null | undefined, now = new Date()): string | null {
    if (isPro(tier)) return null;
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - FREE_HISTORY_MONTHS);
    return cutoff.toISOString().slice(0, 10);
}

export function limitFor(entity: GatedEntity, tier: Tier | null | undefined): number | null {
    return isPro(tier) ? PRO_PLAN_LIMITS[entity] : PLAN_LIMITS[entity];
}

export function isAtLimit(
    entity: GatedEntity,
    used: number,
    tier: Tier | null | undefined
): boolean {
    const limit = limitFor(entity, tier);
    return limit !== null && used >= limit;
}

/** Every quota trigger raises `NOMADIX_PLAN_LIMIT:<entity>` (see
 *  nomadix_assert_quota in supabase/schema.sql); nomadix_share_vault raises
 *  `NOMADIX_PLAN_LIMIT:share_vault` for the same reason. Any mutation that
 *  hits either should open the upgrade dialog instead of a raw error toast —
 *  this parses the Postgres/PostgREST error message down to the entity key,
 *  or null when the error is unrelated to plan limits. */
export function parsePlanLimitError(error: { message?: string } | null | undefined): string | null {
    const message = error?.message ?? "";
    const match = message.match(/NOMADIX_PLAN_LIMIT:(\w+)/);
    return match ? match[1] : null;
}

export const PLAN_PRICING = {
    monthly: { amount: 4.99, currency: "USD" as const },
    yearly: { amount: 36, currency: "USD" as const },
} as const;
