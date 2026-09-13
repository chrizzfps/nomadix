"use client";

import { motion } from "framer-motion";

const container = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.12, delayChildren: 0.2 },
    },
};

const card = {
    hidden: { opacity: 0, y: 24, rotate: 0 },
    show: { opacity: 1, y: 0 },
};

export function HeroLedger() {
    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="relative w-full max-w-sm"
        >
            <motion.div
                variants={card}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ rotate: -3 }}
                className="relative z-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
            >
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-500">
                        Vault — Operating
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                        USD
                    </span>
                </div>
                <p className="mt-4 font-mono text-3xl font-semibold text-white">
                    $24,180.42
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>+$3,940 this month</span>
                </div>
            </motion.div>

            <motion.div
                variants={card}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ rotate: 2 }}
                className="relative z-20 -mt-6 ml-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            >
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-500">
                        Vault — Taxes
                    </span>
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                        EUR
                    </span>
                </div>
                <p className="mt-4 font-mono text-3xl font-semibold text-white">
                    €8,940.00
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4 text-xs">
                    <span className="text-zinc-500">Receivable — Acme Co.</span>
                    <span className="font-mono text-zinc-300">$3,200.00</span>
                </div>
            </motion.div>
        </motion.div>
    );
}
