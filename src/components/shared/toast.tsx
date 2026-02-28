"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "@/stores/toast-store";
import { Check, X, Info } from "@phosphor-icons/react";

const icons = {
    success: Check,
    error: X,
    info: Info,
};

const colors = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    info: "bg-zinc-700",
};

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed bottom-20 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => {
                    const Icon = icons[toast.type];
                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            layout
                            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${colors[toast.type]}`}
                        >
                            <Icon size={16} weight="bold" />
                            <span>{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="ml-2 rounded p-0.5 transition-colors hover:bg-white/20"
                            >
                                <X size={12} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
