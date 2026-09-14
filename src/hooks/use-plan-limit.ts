"use client";

// ============================================
// usePlanLimit — "N of LIMIT" for a gated entity
// ============================================
//
// Purely presentational: the real enforcement is the before-insert trigger
// on each table (nomadix_assert_quota in supabase/schema.sql). This hook
// only lets the UI show a live counter and disable a "create" button before
// the user hits the server error, so the limit never reads as a broken
// button — always as a labeled wall.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlan } from "@/hooks/use-plan";
import { isAtLimit, limitFor, type GatedEntity } from "@/lib/plan";

// Same table + is_system exclusion as nomadix_assert_quota()'s v_used case.
const ENTITY_TABLE: Record<GatedEntity, string> = {
    vault: "vaults",
    category: "transaction_categories",
    subscription: "subscriptions",
    receivable: "receivables",
    client: "clients",
    document: "documents",
    trip: "trips",
};

export function usePlanLimit(entity: GatedEntity) {
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const { tier, isLoading: planLoading } = usePlan();

    const [used, setUsed] = useState(0);
    const [countLoading, setCountLoading] = useState(true);

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
        if (!userId) return;
        let cancelled = false;
        setCountLoading(true);

        (async () => {
            try {
                const supabase = createClient();
                let query = supabase
                    .from(ENTITY_TABLE[entity])
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", userId);
                if (entity === "category") {
                    query = query.eq("is_system", false);
                }
                const { count, error } = await query;
                if (cancelled) return;
                setUsed(error ? 0 : count ?? 0);
            } catch {
                if (!cancelled) setUsed(0);
            } finally {
                if (!cancelled) setCountLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [entity, userId]);

    const limit = limitFor(entity, tier);

    return {
        used,
        limit, // null = unlimited (pro)
        reached: isAtLimit(entity, used, tier),
        isLoading: planLoading || countLoading,
    };
}
