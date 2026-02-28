"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
    DotsThree,
    Eye,
    EyeSlash,
    CalendarBlank,
    CheckCircle,
    WarningCircle,
    PencilSimple,
    Trash,
} from "@phosphor-icons/react";
import { usePrivacyStore } from "@/stores/privacy-store";
import type { DocumentType } from "@/types";

interface DocumentCardProps {
    id: string;
    title: string;
    type: DocumentType;
    expiryDate: string | null;
    isVerified?: boolean;
    fileUrl?: string;
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

const typeGradients: Record<DocumentType, string> = {
    passport: "from-zinc-900 via-zinc-800 to-zinc-900",
    residency: "from-zinc-800 via-zinc-700 to-zinc-800",
    license: "from-zinc-700 via-zinc-600 to-zinc-700",
    visa: "from-zinc-800 via-zinc-900 to-zinc-800",
    insurance: "from-zinc-600 via-zinc-700 to-zinc-600",
    other: "from-zinc-700 via-zinc-800 to-zinc-700",
};

const typeLabels: Record<DocumentType, string> = {
    passport: "PASSPORT",
    residency: "RESIDENCY (TIE)",
    license: "LICENSE",
    visa: "VISA",
    insurance: "INSURANCE",
    other: "OTHER",
};


function getExpiryStatus(expiryDate: string | null): {
    label: string;
    color: string;
    urgent: boolean;
} {
    if (!expiryDate)
        return { label: "No expiry", color: "text-zinc-500", urgent: false };

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil(
        (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
        return { label: "Expired", color: "text-red-400", urgent: true };
    } else if (diffDays <= 30) {
        return {
            label: `${diffDays}d left`,
            color: "text-amber-400",
            urgent: true,
        };
    } else if (diffDays <= 90) {
        return {
            label: `${Math.ceil(diffDays / 30)}mo left`,
            color: "text-amber-400/70",
            urgent: false,
        };
    } else {
        const formatted = expiry.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
        });
        return { label: formatted, color: "text-zinc-400", urgent: false };
    }
}

export function DocumentCard({
    title,
    type,
    expiryDate,
    isVerified = false,
    onView,
    onEdit,
    onDelete,
}: DocumentCardProps) {
    const { isPrivacyMode } = usePrivacyStore();
    const gradient = typeGradients[type] || typeGradients.other;
    const expiry = getExpiryStatus(expiryDate);

    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setShowMenu(false);
            }
        }
        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            return () =>
                document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [showMenu]);

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg transition-shadow hover:shadow-xl`}
        >
            {/* 
                Clickable overlay for "View" — z-20.
                The 3-dot menu sits at z-30, so it will always
                capture clicks BEFORE this overlay.
            */}
            <div
                className="absolute inset-0 z-20 cursor-pointer"
                onClick={() => onView?.()}
            />

            {/* Subtle decorative circles */}
            <div className="absolute inset-0 opacity-[0.04]">
                <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white" />
                <div className="absolute -bottom-3 -left-3 h-20 w-20 rounded-full bg-white" />
                <div className="absolute right-12 bottom-8 h-12 w-12 rounded-full bg-white" />
            </div>

            {/* Header */}
            <div className="relative flex items-start justify-between">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
                    {typeLabels[type]}
                </span>
                <div className="flex items-center gap-1.5">
                    {isVerified && (
                        <CheckCircle
                            size={16}
                            weight="fill"
                            className="text-emerald-400"
                        />
                    )}
                    {/* Menu button — z-30 sits ABOVE the clickable overlay */}
                    <div className="relative z-30" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="rounded-lg p-1.5 transition-colors hover:bg-white/15"
                        >
                            <DotsThree
                                size={18}
                                weight="bold"
                                className="text-zinc-300"
                            />
                        </button>

                        {/* Context Menu */}
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="absolute right-0 top-9 z-40 min-w-[140px] rounded-xl border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
                            >
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        onEdit?.();
                                    }}
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
                                >
                                    <PencilSimple size={15} />
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        onDelete?.();
                                    }}
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-400 transition-colors hover:bg-zinc-700"
                                >
                                    <Trash size={15} />
                                    Delete
                                </button>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Title */}
            <div className="relative mt-8">
                <p className="text-lg font-semibold tracking-tight">
                    {title}
                </p>
            </div>

            {/* Expiry */}
            <div className="relative mt-5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <CalendarBlank size={13} className="text-zinc-400" />
                    <span className={`text-xs font-medium ${expiry.color}`}>
                        {expiry.label}
                    </span>
                    {expiry.urgent && (
                        <WarningCircle
                            size={13}
                            weight="fill"
                            className={expiry.color}
                        />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {isPrivacyMode ? (
                        <EyeSlash size={14} className="text-zinc-500" />
                    ) : (
                        <Eye size={14} className="text-zinc-400" />
                    )}
                </div>
            </div>

            {/* Card shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent" />

            {/* Privacy blur overlay */}
            {isPrivacyMode && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-black/20"
                >
                    <div className="flex flex-col items-center gap-2">
                        <EyeSlash size={24} className="text-white/60" />
                        <span className="text-xs font-medium text-white/60">
                            Privacy Mode
                        </span>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
