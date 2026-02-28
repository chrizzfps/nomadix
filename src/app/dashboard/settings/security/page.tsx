"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "@phosphor-icons/react";

export default function SecurityPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <ShieldCheck size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">Security</h2>
                    <p className="text-xs text-zinc-400">Manage your security settings</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16">
                <ShieldCheck size={40} weight="thin" className="text-zinc-300" />
                <p className="mt-3 text-sm font-semibold text-zinc-400">Coming Soon</p>
                <p className="mt-1 text-xs text-zinc-300">Two-factor authentication, password change, and session management.</p>
            </div>
        </motion.div>
    );
}
