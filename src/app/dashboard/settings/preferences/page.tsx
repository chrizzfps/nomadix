"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Sliders,
    Globe,
    Receipt,
    ArrowsClockwise,
    Moon,
    CurrencyDollar,
} from "@phosphor-icons/react";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToastStore } from "@/stores/toast-store";
import { useThemeStore } from "@/stores/theme-store";
import { useLanguageStore } from "@/stores/language-store";

interface ToggleItemProps {
    icon: React.ElementType;
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}

function ToggleItem({
    icon: Icon,
    label,
    description,
    checked,
    onChange,
}: ToggleItemProps) {
    return (
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                <Icon size={18} className="text-zinc-600" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">{label}</p>
                <p className="text-xs text-zinc-400">{description}</p>
            </div>
            <label className="relative cursor-pointer shrink-0">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </label>
        </div>
    );
}

const GENERAL_PREFS_KEY = "nomadix_general_preferences";

interface GeneralPrefs {
    publicProfile: boolean;
    taxAlerts: boolean;
    autoSync: boolean;
    darkMode: boolean;
}

function loadGeneralPrefs(): GeneralPrefs {
    if (typeof window === "undefined") {
        return { publicProfile: false, taxAlerts: true, autoSync: true, darkMode: false };
    }
    try {
        const raw = localStorage.getItem(GENERAL_PREFS_KEY);
        if (!raw) return { publicProfile: false, taxAlerts: true, autoSync: true, darkMode: false };
        return { ...{ publicProfile: false, taxAlerts: true, autoSync: true, darkMode: false }, ...JSON.parse(raw) };
    } catch {
        return { publicProfile: false, taxAlerts: true, autoSync: true, darkMode: false };
    }
}

function saveGeneralPrefs(prefs: GeneralPrefs) {
    if (typeof window === "undefined") return;
    localStorage.setItem(GENERAL_PREFS_KEY, JSON.stringify(prefs));
}

export default function PreferencesPage() {
    const t = useLanguageStore((s) => s.t);
    const { isDark, setDarkMode } = useThemeStore();
    const [prefs, setPrefs] = useState<GeneralPrefs>(() => ({
        ...loadGeneralPrefs(),
        darkMode: isDark,
    }));
    const [isRefreshingRate, setIsRefreshingRate] = useState(false);

    const {
        manualRate,
        setManualRate,
        exchangeRate,
        loadRate,
        refreshLiveRate,
        lastUpdated,
    } = useCurrencyStore();

    const [rateInput, setRateInput] = useState(String(manualRate.rate));
    const [rateError, setRateError] = useState<string | null>(null);
    const [rateSaving, setRateSaving] = useState(false);
    const addToast = useToastStore((s) => s.addToast);

    useEffect(() => {
        loadRate();
    }, [loadRate]);

    useEffect(() => {
        setRateInput(String(manualRate.rate));
    }, [manualRate.rate]);

    const updatePref = <K extends keyof GeneralPrefs>(key: K, value: GeneralPrefs[K]) => {
        setPrefs((prev) => {
            const next = { ...prev, [key]: value };
            saveGeneralPrefs(next);
            return next;
        });
        if (key === "darkMode") {
            setDarkMode(Boolean(value));
        }
        addToast(t("prefs.savedToast"), "info");
    };

    const handleRefreshLiveRate = async () => {
        setIsRefreshingRate(true);
        try {
            const fresh = await refreshLiveRate();
            addToast(`Live rate updated: 1 USD = ${fresh.toFixed(4)} EUR`, "success");
        } catch {
            addToast("Failed to fetch fresh live rate", "error");
        } finally {
            setIsRefreshingRate(false);
        }
    };

    const persistRate = async (rate: number) => {
        setRateSaving(true);
        setRateError(null);
        try {
            const res = await fetch("/api/exchange-rate", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseCurrency: "USD",
                    targetCurrency: "EUR",
                    exchangeRate: rate,
                }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as
                    | { error?: string }
                    | null;
                throw new Error(json?.error || "Unable to save exchange rate.");
            }
        } catch (e) {
            const raw =
                e instanceof Error ? e.message : "Unable to save exchange rate.";
            const msg =
                raw.includes("schema cache") ||
                raw.includes("Could not find the table")
                    ? "Falta crear la tabla user_exchange_rates en Supabase. Ejecuta supabase/schema.sql en el SQL Editor y luego recarga el schema de la API en Supabase (Settings → API → Reload schema)."
                    : raw;
            setRateError(msg);
            addToast(msg, "error");
        } finally {
            setRateSaving(false);
        }
    };

    const handleToggleManualRate = (enabled: boolean) => {
        setRateError(null);
        setManualRate({
            enabled,
            rate: enabled ? (parseFloat(rateInput) || 1.08) : manualRate.rate,
        });
        if (enabled) {
            const parsed = parseFloat(rateInput);
            if (parsed && parsed > 0) persistRate(parsed);
        }
    };

    const handleRateSave = () => {
        const parsed = parseFloat(rateInput);
        if (!parsed || parsed <= 0) {
            setRateError("Enter a positive exchange rate.");
            return;
        }
        setManualRate({ enabled: true, rate: parsed });
        persistRate(parsed);
    };

    const handleUseLiveRate = () => {
        const rate = Number(exchangeRate);
        if (!rate || rate <= 0) return;
        setRateInput(String(rate));
        setManualRate({ enabled: true, rate });
        persistRate(rate);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Section Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <Sliders size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                        {t("prefs.title")}
                    </h2>
                    <p className="text-xs text-zinc-400">
                        {t("prefs.subtitle")}
                    </p>
                </div>
            </div>

            {/* Exchange Rate Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                        {t("prefs.rateTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={handleRefreshLiveRate}
                        disabled={isRefreshingRate}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60"
                        title="Query live rate from exchange API"
                    >
                        <ArrowsClockwise
                            size={14}
                            className={isRefreshingRate ? "animate-spin text-zinc-900" : ""}
                        />
                        {isRefreshingRate ? t("prefs.refreshing") : t("prefs.refreshRate")}
                    </button>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                    {/* Live status bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/70 px-5 py-3.5">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span
                                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                                        manualRate.enabled ? "bg-amber-400" : "bg-emerald-400"
                                    }`}
                                />
                                <span
                                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                                        manualRate.enabled ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                />
                            </span>
                            <span className="text-xs font-semibold text-zinc-800">
                                {manualRate.enabled ? "Manual Override Active" : "Automatic Live Rate"}
                            </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                            {lastUpdated
                                ? `Checked ${new Date(lastUpdated).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                  })}`
                                : "Auto-synced via ExchangeRate API"}
                        </div>
                    </div>

                    {/* Dual Rate Preview Cards */}
                    <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                        <div className="p-5">
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                                Base USD → EUR
                            </p>
                            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                                1 USD ={" "}
                                <span className="text-zinc-900">
                                    {(manualRate.enabled ? manualRate.rate : exchangeRate).toFixed(4)}
                                </span>{" "}
                                <span className="text-sm font-normal text-zinc-500">EUR</span>
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                                {manualRate.enabled
                                    ? `Custom fixed rate (API: ${exchangeRate.toFixed(4)})`
                                    : "Live rate applied across all vaults"}
                            </p>
                        </div>
                        <div className="p-5">
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                                Inverted EUR → USD
                            </p>
                            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                                1 EUR ={" "}
                                <span className="text-zinc-900">
                                    {(
                                        1 / (manualRate.enabled ? manualRate.rate : exchangeRate)
                                    ).toFixed(4)}
                                </span>{" "}
                                <span className="text-sm font-normal text-zinc-500">USD</span>
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                                Automatic bidirectional conversion
                            </p>
                        </div>
                    </div>

                    {/* Toggle manual rate */}
                    <div className="flex items-center gap-4 border-t border-zinc-100 p-5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                            <CurrencyDollar size={18} className="text-zinc-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-900">
                                Custom Manual Rate
                            </p>
                            <p className="text-xs text-zinc-400">
                                Set a fixed conversion rate instead of querying the market rate automatically
                            </p>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={manualRate.enabled}
                                onChange={(e) => handleToggleManualRate(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                        </label>
                    </div>

                    {/* Rate Input (visible when enabled) */}
                    {manualRate.enabled && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4 space-y-3"
                        >
                            {rateError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-600">
                                    {rateError}
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-500">
                                        Custom USD → EUR Rate
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0.01"
                                        value={rateInput}
                                        onChange={(e) => setRateInput(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={handleRateSave}
                                    disabled={rateSaving}
                                    className="mt-6 rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]"
                                >
                                    {rateSaving ? "Saving..." : "Save Rate"}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handleUseLiveRate}
                                    disabled={rateSaving}
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                                >
                                    Copy current live rate ({exchangeRate.toFixed(4)})
                                </button>
                                <span className="text-[11px] text-zinc-400">
                                    Saved to your Nomadix account
                                </span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Other Toggles */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    {t("prefs.generalPrefs")}
                </h3>
                <ToggleItem
                    icon={Globe}
                    label={t("prefs.publicProfile")}
                    description={t("prefs.publicProfileDesc")}
                    checked={prefs.publicProfile}
                    onChange={(val) => updatePref("publicProfile", val)}
                />
                <ToggleItem
                    icon={Receipt}
                    label={t("prefs.taxAlerts")}
                    description={t("prefs.taxAlertsDesc")}
                    checked={prefs.taxAlerts}
                    onChange={(val) => updatePref("taxAlerts", val)}
                />
                <ToggleItem
                    icon={ArrowsClockwise}
                    label={t("prefs.autoSync")}
                    description={t("prefs.autoSyncDesc")}
                    checked={prefs.autoSync}
                    onChange={(val) => updatePref("autoSync", val)}
                />
                <ToggleItem
                    icon={Moon}
                    label={t("prefs.darkMode")}
                    description={t("prefs.darkModeDesc")}
                    checked={prefs.darkMode}
                    onChange={(val) => updatePref("darkMode", val)}
                />
            </div>
        </motion.div>
    );
}
