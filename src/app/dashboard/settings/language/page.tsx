"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Translate,
    Calendar,
    CurrencyDollar,
    Check,
    FloppyDisk,
    Eye,
} from "@phosphor-icons/react";
import { useToastStore } from "@/stores/toast-store";

interface RegionalPreferences {
    language: "en" | "es" | "de" | "fr" | "pt";
    dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
    numberFormat: "en" | "de"; // en = 1,234.56, de = 1.234,56
    firstDayOfWeek: "monday" | "sunday";
}

const DEFAULT_PREFS: RegionalPreferences = {
    language: "es",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "en",
    firstDayOfWeek: "monday",
};

const STORAGE_KEY = "nomadix_regional_preferences";

function loadRegionalPrefs(): RegionalPreferences {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_PREFS;
        return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_PREFS;
    }
}

const LANGUAGES = [
    { code: "es", label: "Español", region: "España & Latinoamérica", flag: "🇪🇸" },
    { code: "en", label: "English", region: "United States & Global", flag: "🇺🇸" },
    { code: "de", label: "Deutsch", region: "Deutschland, Österreich, Schweiz", flag: "🇩🇪" },
    { code: "fr", label: "Français", region: "France & Francophonie", flag: "🇫🇷" },
    { code: "pt", label: "Português", region: "Portugal & Brasil", flag: "🇵🇹" },
] as const;

export default function LanguagePage() {
    const addToast = useToastStore((s) => s.addToast);
    const [prefs, setPrefs] = useState<RegionalPreferences>(loadRegionalPrefs);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        }
        setTimeout(() => {
            setIsSaving(false);
            addToast("Language and regional preferences saved", "success");
        }, 300);
    };

    // Format sample date for live preview
    const formatSampleDate = () => {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        if (prefs.dateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
        if (prefs.dateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
        return `${day}/${month}/${year}`;
    };

    // Format sample number for live preview
    const formatSampleNumber = (val: number, symbol: string) => {
        if (prefs.numberFormat === "de") {
            // 1.234,56
            return `${val.toLocaleString("de-DE", { minimumFractionDigits: 2 })} ${symbol}`;
        }
        // 1,234.56
        return `${symbol}${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <Translate size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">Language & Regional Settings</h2>
                    <p className="text-xs text-zinc-400">
                        Customize interface language, numeric decimal formats, and date displays
                    </p>
                </div>
            </div>

            {/* Live Preview Box */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">
                    <Eye size={14} />
                    Live Regional Formatting Preview
                </div>
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 sm:grid-cols-3">
                    <div>
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide">Current Date</p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5">{formatSampleDate()}</p>
                    </div>
                    <div>
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide">Expense Sample</p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5">{formatSampleNumber(1450.75, "€")}</p>
                    </div>
                    <div>
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide">First Day of Week</p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5 capitalize">{prefs.firstDayOfWeek}</p>
                    </div>
                </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Display Language
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {LANGUAGES.map((lang) => {
                        const isSelected = prefs.language === lang.code;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => setPrefs({ ...prefs, language: lang.code })}
                                className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                                    isSelected
                                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                                        : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{lang.flag}</span>
                                    <div>
                                        <p className={`text-sm font-semibold ${isSelected ? "text-white" : "text-zinc-900"}`}>
                                            {lang.label}
                                        </p>
                                        <p className={`text-xs ${isSelected ? "text-zinc-400" : "text-zinc-400"}`}>
                                            {lang.region}
                                        </p>
                                    </div>
                                </div>
                                {isSelected && <Check size={18} weight="bold" className="text-white" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Date & Number Formats */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Date & Number Formats
                </h3>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
                    {/* Date format */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">Date Format</p>
                            <p className="text-xs text-zinc-400">Choose how calendar dates are arranged</p>
                        </div>
                        <select
                            value={prefs.dateFormat}
                            onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value as any })}
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
                        >
                            <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 24/12/2026)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 12/24/2026)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-12-24)</option>
                        </select>
                    </div>

                    {/* Number format */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">Number & Decimal Separator</p>
                            <p className="text-xs text-zinc-400">Standard for comma or period decimals</p>
                        </div>
                        <select
                            value={prefs.numberFormat}
                            onChange={(e) => setPrefs({ ...prefs, numberFormat: e.target.value as any })}
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
                        >
                            <option value="en">1,234.56 (Standard English)</option>
                            <option value="de">1.234,56 (Standard European)</option>
                        </select>
                    </div>

                    {/* Week start */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">First Day of the Week</p>
                            <p className="text-xs text-zinc-400">Affects calendar views and weekly reports</p>
                        </div>
                        <select
                            value={prefs.firstDayOfWeek}
                            onChange={(e) => setPrefs({ ...prefs, firstDayOfWeek: e.target.value as any })}
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
                        >
                            <option value="monday">Monday (Lunes)</option>
                            <option value="sunday">Sunday (Domingo)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                >
                    <FloppyDisk size={16} />
                    {isSaving ? "Saving..." : "Save Preferences"}
                </button>
            </div>
        </motion.div>
    );
}
