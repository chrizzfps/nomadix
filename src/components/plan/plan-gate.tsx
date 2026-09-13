"use client";

// ============================================
// PlanGate — declarative wrapper for a Pro-only feature
// ============================================
//
// Two shapes of gate:
//   - `entity`   — count-based (vault, document, trip, …). Renders children
//                  when under the limit, the locked panel once at/over it.
//                  A limit of 0 (receivable, client) means free users always
//                  see the locked panel — used for whole-feature paywalls
//                  like Receivables.
//   - `capability` — a plain boolean gate with no counter (export, AI chat,
//                  sharing a vault). Locked whenever the account isn't Pro.
//
// The locked panel never hides existing data — callers that already show a
// list should keep rendering it and only wrap the "create new" affordance,
// per the plan's rule that downgrading never deletes or hides what exists.

import { useState } from "react";
import { LockSimple } from "@phosphor-icons/react";
import type { GatedEntity } from "@/lib/plan";
import { usePlan } from "@/hooks/use-plan";
import { usePlanLimit } from "@/hooks/use-plan-limit";
import { UpgradeDialog } from "@/components/plan/upgrade-dialog";
import { useLanguageStore } from "@/stores/language-store";

interface PlanGateProps {
    children: React.ReactNode;
    entity?: GatedEntity;
    capability?: string;
    /** Custom locked state (e.g. a demo screenshot). Defaults to a simple
     *  centered card with an upgrade CTA. */
    fallback?: React.ReactNode;
}

export function PlanGate({ children, entity, capability, fallback }: PlanGateProps) {
    const t = useLanguageStore((s) => s.t);
    const { isPro, isLoading: planLoading } = usePlan();
    const limitState = usePlanLimit(entity ?? "vault");
    const [dialogOpen, setDialogOpen] = useState(false);

    const isLoading = entity ? limitState.isLoading : planLoading;
    const locked = entity ? limitState.reached : !isPro;
    const reasonKey = capability ?? entity;

    if (isLoading) return null;
    if (!locked) return <>{children}</>;

    return (
        <>
            {fallback ?? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
                        <LockSimple size={22} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                        {t("plan.gate.title")}
                    </p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                        {t("plan.gate.subtitle")}
                    </p>
                    <button
                        onClick={() => setDialogOpen(true)}
                        className="mt-1 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                    >
                        {t("plan.gate.cta")}
                    </button>
                </div>
            )}
            <UpgradeDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                reason={reasonKey}
            />
        </>
    );
}
