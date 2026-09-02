"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRinging, CheckCircle } from "@phosphor-icons/react";
import { useRemindersStore } from "@/stores/reminders-store";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import { formatDueDate } from "@/lib/subscriptions";
import type { ReminderItem } from "@/lib/subscriptions";

const GROUP_LABEL: Record<ReminderItem["kind"], string> = {
    overdue: "Needs attention",
    failed: "Needs attention",
    pending: "Needs attention",
    trial_ending: "Trial ending",
    upcoming: "Upcoming",
};

const GROUP_ORDER = ["Needs attention", "Trial ending", "Upcoming"];

export function NotificationBell() {
    const router = useRouter();
    const { items, unreadCount, load, markAllSeen } = useRemindersStore();
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

    const grouped = GROUP_ORDER.map((label) => ({
        label,
        items: items.filter((it) => GROUP_LABEL[it.kind] === label),
    })).filter((g) => g.items.length > 0);

    const goTo = (item: ReminderItem) => {
        setIsOpen(false);
        router.push(`/dashboard/subscriptions?open=${item.subscriptionId}`);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen((v) => !v)}
                className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Notifications"
            >
                {unreadCount > 0 ? (
                    <BellRinging size={18} weight="fill" />
                ) : (
                    <Bell size={18} />
                )}
                {unreadCount > 0 && (
                    <span
                        className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
                            hasOverdue ? "bg-red-500" : "bg-zinc-900"
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
                        className="absolute right-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
                    >
                        <div className="max-h-[380px] overflow-y-auto">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-10">
                                    <CheckCircle size={28} className="text-emerald-500" />
                                    <p className="text-sm font-medium text-zinc-500">
                                        You&apos;re all caught up.
                                    </p>
                                </div>
                            ) : (
                                grouped.map((group) => (
                                    <div key={group.label}>
                                        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-[0.1em] uppercase text-zinc-400">
                                            {group.label}
                                        </p>
                                        {group.items.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => goTo(item)}
                                                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-zinc-900">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-zinc-400">
                                                        {formatDueDate(item.dueDate)}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700">
                                                    {CURRENCY_SYMBOLS[item.currency] || "$"}
                                                    {item.amount.toFixed(2)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5">
                            <button
                                onClick={() => markAllSeen()}
                                disabled={items.length === 0}
                                className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 disabled:opacity-40"
                            >
                                Mark all as read
                            </button>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/dashboard/subscriptions");
                                }}
                                className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
                            >
                                Manage subscriptions →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
