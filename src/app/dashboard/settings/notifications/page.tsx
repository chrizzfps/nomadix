"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Bell,
    Receipt,
    EnvelopeSimple,
    DeviceMobile,
    WarningCircle,
    CalendarCheck,
    Vault,
} from "@phosphor-icons/react";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { useRemindersStore } from "@/stores/reminders-store";

interface NotificationConfig {
    subReminder1d: boolean;
    subReminder3d: boolean;
    subReminder7d: boolean;
    subPriceChange: boolean;
    vaultLowBalance: boolean;
    emailWeeklyDigest: boolean;
    emailSecurityAlerts: boolean;
    browserPushEnabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
    subReminder1d: true,
    subReminder3d: true,
    subReminder7d: false,
    subPriceChange: true,
    vaultLowBalance: true,
    emailWeeklyDigest: false,
    emailSecurityAlerts: true,
    browserPushEnabled: false,
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
                toggle("browserPushEnabled");
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
                                <CalendarCheck size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{t("notif.sub1d")}</p>
                                <p className="text-xs text-muted-foreground">24 horas antes del cargo</p>
                            </div>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={config.subReminder1d}
                                onChange={() => toggle("subReminder1d")}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground/70">
                                <Receipt size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{t("notif.sub3d")}</p>
                                <p className="text-xs text-muted-foreground">Aviso preventivo para revisar fondos</p>
                            </div>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={config.subReminder3d}
                                onChange={() => toggle("subReminder3d")}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>

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

            {/* Financial & Vault Alerts */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("notif.vaultsSection")}
                </h3>
                <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground/70">
                                <Vault size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{t("notif.vaultLow")}</p>
                                <p className="text-xs text-muted-foreground">{t("notif.vaultLowDesc")}</p>
                            </div>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={config.vaultLowBalance}
                                onChange={() => toggle("vaultLowBalance")}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Email Digests */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("notif.emailSection")}
                </h3>
                <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground/70">
                                <EnvelopeSimple size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{t("notif.emailWeekly")}</p>
                                <p className="text-xs text-muted-foreground">Reporte de balance y cambio de divisas</p>
                            </div>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={config.emailWeeklyDigest}
                                onChange={() => toggle("emailWeeklyDigest")}
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
