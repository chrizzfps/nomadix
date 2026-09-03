import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { buildReminders, todayISO, type ReminderItem } from "@/lib/subscriptions";
import type { Subscription, SubscriptionOccurrence } from "@/types";

const CATCHUP_KEY = "nomadix_subs_catchup_at";
const CATCHUP_TTL = 6 * 60 * 60 * 1000; // 6h — cron is the real safety net
const LOAD_TTL = 5 * 60 * 1000; // 5 min

interface RemindersState {
    items: ReminderItem[];
    unreadCount: number;
    isLoading: boolean;
    lastLoadedAt: number | null;
    load: (force?: boolean) => Promise<void>;
    markSeen: (subscriptionId: string) => Promise<void>;
    markAllSeen: () => Promise<void>;
    runCatchUp: () => Promise<void>;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
    items: [],
    unreadCount: 0,
    isLoading: false,
    lastLoadedAt: null,

    load: async (force = false) => {
        const { lastLoadedAt, isLoading } = get();
        if (isLoading) return;
        if (!force && lastLoadedAt && Date.now() - lastLoadedAt < LOAD_TTL) return;

        set({ isLoading: true });
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            set({ isLoading: false });
            return;
        }

        const [{ data: subs }, { data: occs }] = await Promise.all([
            supabase.from("subscriptions").select("*").eq("user_id", user.id),
            supabase
                .from("subscription_occurrences")
                .select("*")
                .eq("user_id", user.id)
                .in("status", ["pending", "failed"]),
        ]);

        const subscriptions = (subs || []) as Subscription[];
        const occurrences = (occs || []) as SubscriptionOccurrence[];
        let items = buildReminders(subscriptions, occurrences);

        if (typeof window !== "undefined") {
            try {
                const raw = localStorage.getItem("nomadix_notification_settings");
                if (raw) {
                    const cfg = JSON.parse(raw);
                    items = items.filter((it) => {
                        if (it.kind === "trial_ending" && cfg.subPriceChange === false) return false;
                        return true;
                    });
                }
            } catch {
                // ignore
            }
        }

        const today = todayISO();
        const unreadCount = items.filter((it) => {
            const sub = subscriptions.find((s) => s.id === it.subscriptionId);
            if (!sub) return true;
            if (!sub.last_reminder_seen_at) return true;
            // "unread" if the subscription hasn't been acknowledged since
            // this due window opened (reminder_days_before the due date).
            return sub.last_reminder_seen_at < today;
        }).length;

        set({ items, unreadCount, isLoading: false, lastLoadedAt: Date.now() });
    },

    markSeen: async (subscriptionId: string) => {
        const supabase = createClient();
        await supabase
            .from("subscriptions")
            .update({ last_reminder_seen_at: new Date().toISOString() })
            .eq("id", subscriptionId);
        set((state) => ({
            items: state.items.filter((it) => it.subscriptionId !== subscriptionId),
            unreadCount: Math.max(0, state.unreadCount - 1),
        }));
    },

    markAllSeen: async () => {
        const { items } = get();
        const ids = Array.from(new Set(items.map((it) => it.subscriptionId)));
        if (ids.length === 0) return;
        const supabase = createClient();
        await supabase
            .from("subscriptions")
            .update({ last_reminder_seen_at: new Date().toISOString() })
            .in("id", ids);
        set({ unreadCount: 0 });
    },

    runCatchUp: async () => {
        if (typeof window === "undefined") return;
        const last = Number(localStorage.getItem(CATCHUP_KEY) || 0);
        if (Date.now() - last < CATCHUP_TTL) return;

        const supabase = createClient();
        const { error } = await supabase.rpc("nomadix_run_due_subscriptions", {
            p_through: todayISO(),
        });
        if (!error) {
            localStorage.setItem(CATCHUP_KEY, String(Date.now()));
        }
    },
}));
