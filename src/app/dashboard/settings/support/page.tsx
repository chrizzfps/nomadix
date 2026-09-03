"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Headset,
    CaretDown,
    PaperPlaneTilt,
    BookOpen,
    Users,
    ShieldCheck,
    CheckCircle,
} from "@phosphor-icons/react";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import { createClient } from "@/lib/supabase/client";

interface FaqItem {
    question: string;
    answer: string;
}

const FAQ_ITEMS_EN: FaqItem[] = [
    {
        question: "How does multi-currency conversion work in Nomadix?",
        answer: "Nomadix queries live market exchange rates via global financial APIs (such as ExchangeRate API). When you record transactions or view vaults in EUR or USD, amounts are dynamically converted using the official rate, while preserving the original currency amount and any applied transfer commissions.",
    },
    {
        question: "What is the difference between Live rate and Custom manual rate?",
        answer: "The Live rate updates automatically from financial markets. A Custom manual rate allows you to lock in a specific exchange rate (e.g. from an ATM withdrawal or wire transfer) so your spending balances remain predictable regardless of day-to-day market fluctuations.",
    },
    {
        question: "Are my passport copies and identity documents secure?",
        answer: "Yes. Documents stored in your Nomadix vault are encrypted and protected by Supabase Row Level Security (RLS). Only your authenticated account can retrieve and view these files.",
    },
    {
        question: "How do automated subscription charges work?",
        answer: "Nomadix tracks your recurring subscriptions and uses cron jobs to record upcoming charges automatically on the due date. You receive in-app alerts beforehand to ensure your target vault has sufficient balance.",
    },
    {
        question: "Can I export my data for tax or fiscal residency reports?",
        answer: "Yes, you can go to Settings → Data and download a complete JSON backup or an accounting-ready CSV file of all your transactions with currency breakdowns and category tags.",
    },
];

const FAQ_ITEMS_ES: FaqItem[] = [
    {
        question: "¿Cómo funciona la conversión multimoneda en Nomadix?",
        answer: "Nomadix consulta los tipos de cambio de mercado en tiempo real a través de APIs financieras globales. Al registrar transacciones o ver bóvedas en EUR o USD, los montos se convierten dinámicamente usando la tasa oficial, preservando la moneda original y las comisiones bancarias.",
    },
    {
        question: "¿Cuál es la diferencia entre Tasa en Vivo y Tasa Manual Fija?",
        answer: "La tasa en vivo se actualiza automáticamente del mercado. La tasa manual fija te permite fijar un tipo de cambio personalizado (por ejemplo, el de un retiro de cajero o transferencia) para mantener fijos tus cálculos de gastos.",
    },
    {
        question: "¿Están seguros mis pasaportes y documentos de identidad?",
        answer: "Sí. Los documentos almacenados en tu bóveda están cifrados y protegidos por Row Level Security (RLS) en Supabase. Solo tu cuenta autenticada tiene acceso a visualizarlos o descargarlos.",
    },
    {
        question: "¿Cómo funcionan los cargos automáticos de suscripciones?",
        answer: "Nomadix rastrea tus suscripciones recurrentes y registra los cobros correspondientes en la fecha de vencimiento. Recibirás avisos previos para verificar el saldo de la bóveda.",
    },
    {
        question: "¿Puedo exportar mis datos para declaraciones de impuestos o residencia fiscal?",
        answer: "Sí, en Configuración → Datos puedes descargar una copia de seguridad en JSON o una planilla contable en CSV de todas tus transacciones desglosadas por divisa y categoría.",
    },
];

export default function SupportPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const { language, t } = useLanguageStore();

    // FAQ open states
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    // Support ticket form state
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState("General Question");
    const [priority, setPriority] = useState("Normal");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const faqItems = language === "es" ? FAQ_ITEMS_ES : FAQ_ITEMS_EN;

    const handleSubmitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            addToast("Por favor completa el asunto y el mensaje", "error");
            return;
        }

        setIsSubmitting(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setIsSubmitting(false);
            addToast("You must be logged in.", "error");
            return;
        }

        const { error } = await supabase.from("support_tickets").insert({
            user_id: user.id,
            category,
            priority,
            subject: subject.trim(),
            message: message.trim(),
        });

        setIsSubmitting(false);

        if (error) {
            addToast(error.message, "error");
            return;
        }

        setSubmitted(true);
        addToast(
            language === "es" ? "Ticket de soporte enviado. Te responderemos pronto." : "Support ticket submitted. We will contact you soon.",
            "success"
        );
        setSubject("");
        setMessage("");
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
                    <Headset size={20} className="text-foreground/70" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{t("support.title")}</h2>
                    <p className="text-xs text-muted-foreground">
                        {t("support.subtitle")}
                    </p>
                </div>
            </div>

            {/* Quick Support Resource Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground/80">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{t("support.docs")}</p>
                            <p className="text-xs text-muted-foreground">Guías de bóvedas y divisas</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground/80">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{t("support.community")}</p>
                            <p className="text-xs text-muted-foreground">Discord & Telegram chat</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <p className="text-sm font-semibold text-foreground">{t("support.status")}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">Operacional 100%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive FAQ */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                    {t("support.faq")}
                </h3>
                <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                    {faqItems.map((item, idx) => {
                        const isOpen = openFaq === idx;
                        return (
                            <div key={idx} className="transition-colors">
                                <button
                                    type="button"
                                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                                    className="flex w-full items-center justify-between p-4 text-left font-medium text-foreground hover:bg-accent"
                                >
                                    <span className="text-sm font-medium">{item.question}</span>
                                    <CaretDown
                                        size={16}
                                        className={`shrink-0 text-muted-foreground transition-transform ${
                                            isOpen ? "rotate-180 text-foreground" : ""
                                        }`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden bg-accent/50 px-4 pb-4 pt-1"
                                        >
                                            <p className="text-xs leading-relaxed text-foreground/70">{item.answer}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Contact Support Form */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-1">{t("support.contact")}</h3>
                <p className="text-xs text-muted-foreground mb-5">
                    ¿Tienes dudas sobre tasas de cambio o configuración de cuentas? Escríbenos directamente.
                </p>

                {submitted ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 p-5 text-center">
                        <CheckCircle size={28} weight="fill" className="mx-auto text-emerald-600 mb-2" />
                        <p className="text-sm font-semibold text-foreground">
                            {language === "es" ? "Ticket enviado exitosamente" : "Ticket submitted successfully"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {language === "es" ? "Nuestro equipo te responderá en menos de 24 horas hábiles." : "Our support team will get back to you within 24 business hours."}
                        </p>
                        <button
                            type="button"
                            onClick={() => setSubmitted(false)}
                            className="mt-4 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground/80 hover:bg-accent"
                        >
                            {language === "es" ? "Enviar otra consulta" : "Submit another inquiry"}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitTicket} className="space-y-4 max-w-xl">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                    {t("support.category")}
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-accent px-3.5 py-2 text-xs font-medium text-foreground focus:border-ring focus:bg-card focus:outline-none"
                                >
                                    <option value="General Question">General / Consultas</option>
                                    <option value="Exchange Rates">Tasas de Cambio / Conversión</option>
                                    <option value="Subscriptions">Suscripciones y Facturación</option>
                                    <option value="Identity Vault">Bóvedas y Documentos</option>
                                    <option value="Security">Seguridad y Sesiones</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                    {t("support.priority")}
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="w-full rounded-xl border border-border bg-accent px-3.5 py-2 text-xs font-medium text-foreground focus:border-ring focus:bg-card focus:outline-none"
                                >
                                    <option value="Low">Baja (Informativa)</option>
                                    <option value="Normal">Normal</option>
                                    <option value="High">Alta (Urgente)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                {t("support.subject")}
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Resumen breve del problema..."
                                className="w-full rounded-xl border border-border bg-accent px-3.5 py-2 text-sm text-foreground focus:border-ring focus:bg-card focus:outline-none"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
                                {t("support.message")}
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe con detalle lo que sucede..."
                                rows={4}
                                className="w-full rounded-xl border border-border bg-accent p-3 text-sm text-foreground focus:border-ring focus:bg-card focus:outline-none"
                                required
                            />
                        </div>

                        <div className="pt-1">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                            >
                                <PaperPlaneTilt size={15} />
                                {isSubmitting ? "Enviando..." : t("support.send")}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </motion.div>
    );
}
