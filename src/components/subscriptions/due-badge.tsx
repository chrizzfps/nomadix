"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { dueStatus } from "@/lib/subscriptions";

interface DueBadgeProps {
    dueDate: string;
    todayIso?: string;
    className?: string;
}

const TONE_CLASSES: Record<string, string> = {
    overdue: "border-red-100 bg-red-50 text-red-600",
    today: "border-primary bg-primary text-primary-foreground",
    urgent: "border-amber-100 bg-amber-50 text-amber-700",
    soon: "border-border bg-accent text-foreground/70",
    normal: "border-transparent bg-transparent text-muted-foreground",
};

export function DueBadge({ dueDate, todayIso, className = "" }: DueBadgeProps) {
    const { label, tone } = dueStatus(dueDate, todayIso);
    const isChip = tone !== "normal";

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold ${
                isChip ? `border px-2.5 py-1 ${TONE_CLASSES[tone]}` : TONE_CLASSES.normal
            } ${className}`}
        >
            {tone === "overdue" && <WarningCircle size={12} weight="fill" />}
            {label}
        </span>
    );
}
