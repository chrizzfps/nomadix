"use client";

import { useState } from "react";
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

export default function PreferencesPage() {
    const [publicProfile, setPublicProfile] = useState(false);
    const [taxAlerts, setTaxAlerts] = useState(true);
    const [autoSync, setAutoSync] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    const { manualRate, setManualRate, exchangeRate } = useCurrencyStore();
    const [rateInput, setRateInput] = useState(String(manualRate.rate));

    const handleToggleManualRate = (enabled: boolean) => {
        setManualRate({
            enabled,
            rate: enabled ? (parseFloat(rateInput) || 1.08) : manualRate.rate,
        });
    };

    const handleRateSave = () => {
        const parsed = parseFloat(rateInput);
        if (!parsed || parsed <= 0) return;
        setManualRate({ enabled: true, rate: parsed });
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
                        Preferences
                    </h2>
                    <p className="text-xs text-zinc-400">
                        Customize your Nomadix experience
                    </p>
                </div>
            </div>

            {/* Exchange Rate Section */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Exchange Rate
                </h3>

                <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    {/* Toggle */}
                    <div className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                            <CurrencyDollar
                                size={18}
                                className="text-zinc-600"
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-900">
                                Manual Exchange Rate
                            </p>
                            <p className="text-xs text-zinc-400">
                                Override the automatic rate with your own
                            </p>
                        </div>
                        <label className="relative cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={manualRate.enabled}
                                onChange={(e) =>
                                    handleToggleManualRate(e.target.checked)
                                }
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
                            className="border-t border-zinc-100 px-4 py-4 space-y-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                        USD → EUR Rate
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0.01"
                                        value={rateInput}
                                        onChange={(e) =>
                                            setRateInput(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={handleRateSave}
                                    className="mt-6 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]"
                                >
                                    Save
                                </button>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                                API rate:{" "}
                                <span className="font-semibold text-zinc-600">
                                    1 USD = {exchangeRate.toFixed(4)} EUR
                                </span>
                                {" · "}
                                Your rate:{" "}
                                <span className="font-semibold text-zinc-600">
                                    1 USD = {manualRate.rate.toFixed(4)} EUR
                                </span>
                            </p>
                        </motion.div>
                    )}

                    {/* Show current rate when disabled */}
                    {!manualRate.enabled && (
                        <div className="border-t border-zinc-100 px-4 py-3">
                            <p className="text-[11px] text-zinc-400">
                                Using live rate:{" "}
                                <span className="font-semibold text-zinc-600">
                                    1 USD = {exchangeRate.toFixed(4)} EUR
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Other Toggles */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    General
                </h3>
                <ToggleItem
                    icon={Globe}
                    label="Public Profile"
                    description="Allow other Nomadix users to see your profile"
                    checked={publicProfile}
                    onChange={setPublicProfile}
                />
                <ToggleItem
                    icon={Receipt}
                    label="Tax Alerts"
                    description="Get notified about tax obligations in your current country"
                    checked={taxAlerts}
                    onChange={setTaxAlerts}
                />
                <ToggleItem
                    icon={ArrowsClockwise}
                    label="Auto Expense Sync"
                    description="Automatically sync transactions from connected accounts"
                    checked={autoSync}
                    onChange={setAutoSync}
                />
                <ToggleItem
                    icon={Moon}
                    label="Dark Mode"
                    description="Switch to dark theme for low-light environments"
                    checked={darkMode}
                    onChange={setDarkMode}
                />
            </div>
        </motion.div>
    );
}
