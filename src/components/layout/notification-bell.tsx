"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRinging, CheckCircle } from "@phosphor-icons/react";
import { useRemindersStore } from "@/stores/reminders-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { formatDueDate } from "@/lib/subscriptions";
import type { ReminderItem } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/stores/language-store";

const GROUP_KEY: Record<ReminderItem["kind"], string> = {
    overdue: "bell.needsAttention",
    failed: "bell.needsAttention",
    pending: "bell.needsAttention",
    trial_ending: "bell.trialEnding",
    upcoming: "bell.upcoming",
};

const GROUP_ORDER = ["bell.needsAttention", "bell.trialEnding", "bell.upcoming"];

interface NotificationBellProps {
    align?: "left" | "right";
    className?: string;
}

export function NotificationBell({ align = "left", className }: NotificationBellProps = {}) {
    const router = useRouter();
    const { items, unreadCount, load, markAllSeen } = useRemindersStore();
    const t = useLanguageStore((s) => s.t);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    const hasOverdue = items.some((it) => it.kind === "overdue" || it.kind === "failed");

    const grouped = GROUP_ORDER.map((key) => ({
        key,
        label: t(key),
        items: items.filter((it) => GROUP_KEY[it.kind] === key),
    })).filter((g) => g.items.length > 0);

    const goTo = (item: ReminderItem) => {
        setIsOpen(false);
        router.push(`/dashboard/subscriptions?open=${item.subscriptionId}`);
    };

    return (
        <div className={cn("relative", className)} ref={menuRef}>
            <button
                onClick={() => setIsOpen((v) => !v)}
                className={cn(
                    "relative rounded-lg p-2 transition-colors",
                    isOpen
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                aria-label={t("bell.notifications")}
            >
                {unreadCount > 0 ? (
                    <BellRinging size={18} weight="fill" />
                ) : (
                    <Bell size={18} />
                )}
                {unreadCount > 0 && (
                    <span
                        className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-primary-foreground ${
                            hasOverdue ? "bg-red-500" : "bg-primary"
                        }`}
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            "absolute top-full z-50 mt-2 w-[calc(100vw-2rem)] sm:w-[340px] max-w-[340px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
                            align === "left"
                                ? "left-0 origin-top-left"
                                : "right-0 max-sm:-right-12 origin-top-right"
                        )}
                    >
                        <div className="max-h-[380px] overflow-y-auto">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-10">
                                    <CheckCircle size={28} className="text-emerald-500" />
                                    <p className="text-sm font-medium text-muted-foreground">
                                        {t("bell.allCaughtUp")}
                                    </p>
                                </div>
                            ) : (
                                grouped.map((group) => (
                                    <div key={group.key}>
                                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                                            {group.label}
                                        </p>
                                        {group.items.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => goTo(item)}
                                                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDueDate(item.dueDate)}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                                    {CURRENCY_SYMBOLS[item.currency] || "$"}
                                                    {item.amount.toFixed(2)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                            <button
                                onClick={() => markAllSeen()}
                                disabled={items.length === 0}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                                {t("bell.markAllRead")}
                            </button>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/dashboard/subscriptions");
                                }}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                            >
                                {t("bell.manageSubscriptions")}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
