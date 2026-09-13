"use client";

// ============================================
// LimitBadge — "N of LIMIT" next to a "create" button
// ============================================
//
// Purely a counter; it never blocks anything itself. Pair it with a
// disabled create button (disabled={reached}) that opens UpgradeDialog on
// click — see usePlanLimit() for where `used`/`limit`/`reached` come from.

import type { GatedEntity } from "@/lib/plan";
import { usePlanLimit } from "@/hooks/use-plan-limit";

interface LimitBadgeProps {
    entity: GatedEntity;
    className?: string;
}

export function LimitBadge({ entity, className }: LimitBadgeProps) {
    const { used, limit, isLoading } = usePlanLimit(entity);

    if (isLoading || limit === null) return null;

    return (
        <span
            className={`rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ${className ?? ""}`}
        >
            {used}/{limit}
        </span>
    );
}
