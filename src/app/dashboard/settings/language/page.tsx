"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Translate,
    Check,
    FloppyDisk,
    Eye,
} from "@phosphor-icons/react";
import { useToastStore } from "@/stores/toast-store";
import {
    useLanguageStore,
    type LanguageCode,
    type DateFormat,
    type NumberFormat,
} from "@/stores/language-store";

const LANGUAGES: Array<{
    code: LanguageCode;
    label: string;
    region: string;
    flag: string;
}> = [
    { code: "es", label: "Español", region: "España & Latinoamérica", flag: "🇪🇸" },
    { code: "en", label: "English", region: "United States & Global", flag: "🇺🇸" },
    { code: "de", label: "Deutsch", region: "Deutschland, Österreich, Schweiz", flag: "🇩🇪" },
    { code: "fr", label: "Français", region: "France & Francophonie", flag: "🇫🇷" },
    { code: "pt", label: "Português", region: "Portugal & Brasil", flag: "🇵🇹" },
];

export default function LanguagePage() {
    const addToast = useToastStore((s) => s.addToast);
    const {
        language,
        dateFormat,
        numberFormat,
        firstDayOfWeek,
        setLanguage,
        setRegionalPrefs,
        t,
        formatDate,
        formatNumber,
    } = useLanguageStore();

    const [isSaving, setIsSaving] = useState(false);

    const handleSelectLanguage = (code: LanguageCode) => {
        setLanguage(code);
        addToast(
            code === "es"
                ? "Idioma cambiado a Español"
                : `Language switched to ${LANGUAGES.find((l) => l.code === code)?.label}`,
            "success"
        );
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            addToast(t("prefs.savedToast"), "success");
        }, 300);
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
                    <h2 className="text-lg font-semibold text-zinc-900">{t("lang.title")}</h2>
                    <p className="text-xs text-zinc-400">{t("lang.subtitle")}</p>
                </div>
            </div>

            {/* Live Preview Box */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">
                    <Eye size={14} />
                    {t("lang.preview")}
                </div>
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 sm:grid-cols-3">
                    <div>
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide">
                            {t("lang.datePreview")}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                            {formatDate(new Date())}
                        </p>
                    </div>
                    <div>
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide">
                            {t("lang.numberPreview")}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                            {formatNumber(1450.75, "€")}
                        </p>
                    </div>
                    <div>
                        <p className="text-[11px] text-zinc-400 uppercase tracking-wide">
                            {t("lang.firstDayPreview")}
                        </p>
                        <p className="text-sm font-semibold text-zinc-900 mt-0.5 capitalize">
                            {firstDayOfWeek === "monday" ? t("lang.monday") : t("lang.sunday")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Language Selector */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    {t("lang.displayLang")}
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {LANGUAGES.map((lang) => {
                        const isSelected = language === lang.code;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => handleSelectLanguage(lang.code)}
                                className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                                    isSelected
                                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                                        : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{lang.flag}</span>
                                    <div>
                                        <p
                                            className={`text-sm font-semibold ${
                                                isSelected ? "text-white" : "text-zinc-900"
                                            }`}
                                        >
                                            {lang.label}
                                        </p>
                                        <p
                                            className={`text-xs ${
                                                isSelected ? "text-zinc-400" : "text-zinc-400"
                                            }`}
                                        >
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
                    {t("lang.formatsSection")}
                </h3>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
                    {/* Date format */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">{t("lang.dateFormat")}</p>
                            <p className="text-xs text-zinc-400">
                                {dateFormat === "DD/MM/YYYY"
                                    ? "Día/Mes/Año (24/12/2026)"
                                    : dateFormat === "MM/DD/YYYY"
                                    ? "Mes/Día/Año (12/24/2026)"
                                    : "Año-Mes-Día (2026-12-24)"}
                            </p>
                        </div>
                        <select
                            value={dateFormat}
                            onChange={(e) =>
                                setRegionalPrefs({ dateFormat: e.target.value as DateFormat })
                            }
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
                        >
                            <option value="DD/MM/YYYY">DD/MM/YYYY (24/12/2026)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (12/24/2026)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-24)</option>
                        </select>
                    </div>

                    {/* Number format */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">{t("lang.numberFormat")}</p>
                            <p className="text-xs text-zinc-400">
                                {numberFormat === "en" ? "1,234.56 (Coma miles, punto decimal)" : "1.234,56 (Punto miles, coma decimal)"}
                            </p>
                        </div>
                        <select
                            value={numberFormat}
                            onChange={(e) =>
                                setRegionalPrefs({ numberFormat: e.target.value as NumberFormat })
                            }
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
                        >
                            <option value="en">1,234.56 (English / US)</option>
                            <option value="de">1.234,56 (Europeo / ES)</option>
                        </select>
                    </div>

                    {/* Week start */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">{t("lang.firstDay")}</p>
                            <p className="text-xs text-zinc-400">
                                {firstDayOfWeek === "monday" ? t("lang.monday") : t("lang.sunday")}
                            </p>
                        </div>
                        <select
                            value={firstDayOfWeek}
                            onChange={(e) =>
                                setRegionalPrefs({
                                    firstDayOfWeek: e.target.value as "monday" | "sunday",
                                })
                            }
                            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:outline-none"
                        >
                            <option value="monday">{t("lang.monday")}</option>
                            <option value="sunday">{t("lang.sunday")}</option>
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
                    {isSaving ? t("account.saving") : t("lang.save")}
                </button>
            </div>
        </motion.div>
    );
}
