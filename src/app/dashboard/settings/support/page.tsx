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
    ChatTeardropText,
} from "@phosphor-icons/react";
import { useToastStore } from "@/stores/toast-store";

interface FaqItem {
    question: string;
    answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
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

export default function SupportPage() {
    const addToast = useToastStore((s) => s.addToast);

    // FAQ open states
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    // Support ticket form state
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState("General Question");
    const [priority, setPriority] = useState("Normal");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmitTicket = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            addToast("Please fill in both subject and message", "error");
            return;
        }

        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
            addToast("Support message sent. Our nomad team will reply within 24 hours.", "success");
            setSubject("");
            setMessage("");
            setTimeout(() => setSubmitted(false), 4000);
        }, 800);
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
                    <Headset size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">Help & Support</h2>
                    <p className="text-xs text-zinc-400">
                        Frequently asked questions, direct helpdesk contact, and resources
                    </p>
                </div>
            </div>

            {/* Resources Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">Documentation</p>
                            <p className="text-xs text-zinc-400">Guides & vault management</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-zinc-900">Nomad Community</p>
                            <p className="text-xs text-zinc-400">Discord & Telegram chat</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <p className="text-sm font-semibold text-zinc-900">System Status</p>
                            </div>
                            <p className="text-xs text-zinc-400">All systems operational</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive FAQ */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-400">
                    Frequently Asked Questions
                </h3>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                    {FAQ_ITEMS.map((item, idx) => {
                        const isOpen = openFaq === idx;
                        return (
                            <div key={idx} className="transition-colors">
                                <button
                                    type="button"
                                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                                    className="flex w-full items-center justify-between p-4 text-left font-medium text-zinc-900 hover:bg-zinc-50"
                                >
                                    <span className="text-sm font-medium">{item.question}</span>
                                    <CaretDown
                                        size={16}
                                        className={`shrink-0 text-zinc-400 transition-transform ${
                                            isOpen ? "rotate-180 text-zinc-900" : ""
                                        }`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden bg-zinc-50/50 px-4 pb-4 pt-1"
                                        >
                                            <p className="text-xs leading-relaxed text-zinc-600">{item.answer}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Contact Support Form */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                        <ChatTeardropText size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900">Contact Nomadix Support</h3>
                        <p className="text-xs text-zinc-400">
                            Have an issue with vault conversion or account billing? Send us a ticket
                        </p>
                    </div>
                </div>

                {submitted ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle size={36} weight="fill" className="text-emerald-500 mb-2" />
                        <p className="text-sm font-semibold text-zinc-900">Message Received</p>
                        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                            Thank you! A member of our support team has received your inquiry and will respond to your email shortly.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitTicket} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                    Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                >
                                    <option value="General Question">General Question</option>
                                    <option value="Exchange Rates & Vaults">Exchange Rates & Vaults</option>
                                    <option value="Subscriptions & Charges">Subscriptions & Charges</option>
                                    <option value="Billing & Invoices">Billing & Invoices</option>
                                    <option value="Bug Report">Bug Report</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                    Priority
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                >
                                    <option value="Normal">Normal</option>
                                    <option value="High">High (Urgent travel issue)</option>
                                    <option value="Urgent">Critical (Account access)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Brief summary of your question"
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium tracking-[0.08em] uppercase text-zinc-400">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                placeholder="Describe your issue or request in detail..."
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                                required
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
                            >
                                <PaperPlaneTilt size={16} />
                                {isSubmitting ? "Sending..." : "Submit Ticket"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </motion.div>
    );
}
