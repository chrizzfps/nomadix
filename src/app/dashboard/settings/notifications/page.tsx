"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Bell,
    WarningCircle,
    DeviceMobile,
    HandCoins,
} from "@phosphor-icons/react";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { useRemindersStore } from "@/stores/reminders-store";

// Only these two flags are ever read (see reminders-store.ts's load()) --
// every other toggle this page used to render (per-day due-date reminders,
// vault low-balance, email digests) wrote to localStorage but nothing
// consumed them, so they were removed rather than left as fake controls.
interface NotificationConfig {
    subPriceChange: boolean;
    receivableReminder: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
    subPriceChange: true,
    receivableReminder: true,
};

const STORAGE_KEY = "nomadix_notification_settings";

function loadConfig(): NotificationConfig {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_CONFIG;
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_CONFIG;
    }
}

export default function NotificationsPage() {
    const addToast = useToastStore((s) => s.addToast);
    const t = useLanguageStore((s) => s.t);
    const [config, setConfig] = useState<NotificationConfig>(loadConfig);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setPushPermission(Notification.permission);
        }
    }, []);

    const toggle = (key: keyof NotificationConfig) => {
        setConfig((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
            return next;
        });
        useRemindersStore.getState().load(true);
        addToast(t("prefs.savedToast"), "info");
    };

    const handleRequestPush = async () => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            addToast("Browser does not support push notifications", "error");
            return;
        }

        try {
            const res = await Notification.requestPermission();
            setPushPermission(res);
            if (res === "granted") {
                addToast("Notificaciones push activadas", "success");
                new Notification("Nomadix Notifications", {
                    body: "Alertas y avisos activados en tu navegador.",
                    icon: "/favicon.ico",
                });
            } else {
                addToast("Permiso de notificaciones denegado", "error");
            }
        } catch {
            addToast("No se pudo solicitar el permiso", "error");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <Bell size={20} className="text-foreground/70" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{t("notif.title")}</h2>
                    <p className="text-xs text-muted-foreground">{t("notif.subtitle")}</p>
                </div>
            </div>

            {/* Browser Push Permission Card */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground/80">
                        <DeviceMobile size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{t("notif.push")}</h3>
                            <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    pushPermission === "granted"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-accent text-foreground/70"
                                }`}
                            >
                                {pushPermission === "granted" ? "Activo" : "Inactivo"}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("notif.pushDesc")}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRequestPush}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                    <Bell size={14} />
                    {pushPermission === "granted" ? "Re-check" : t("notif.enablePush")}
                </button>
            </div>

            {/* Subscriptions & Bills */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("notif.subsSection")}
                </h3>
                <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground/70">
                                <WarningCircle size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{t("notif.subPrice")}</p>
                                <p className="text-xs text-muted-foreground">Aviso de fin de prueba o subida de tarifa</p>
                            </div>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={config.subPriceChange}
                                onChange={() => toggle("subPriceChange")}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Receivables */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("notif.receivablesSection")}
                </h3>
                <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground/70">
                                <HandCoins size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{t("notif.receivableReminder")}</p>
                                <p className="text-xs text-muted-foreground">{t("notif.receivableReminderDesc")}</p>
                            </div>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={config.receivableReminder}
                                onChange={() => toggle("receivableReminder")}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
