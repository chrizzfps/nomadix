"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    CalendarBlank,
    CheckCircle,
    Trash,
    Download,
    File as FileIcon,
    WarningCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import type { DocumentType } from "@/types";

interface DocumentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeleted: () => void;
    document: {
        id: string;
        title: string;
        type: DocumentType;
        file_url: string | null;
        expiry_date: string | null;
        created_at: string;
    } | null;
}

const typeLabels: Record<DocumentType, string> = {
    passport: "Passport",
    residency: "Residency (TIE)",
    license: "License",
    visa: "Visa",
    insurance: "Insurance",
    other: "Other",
};


function getExpiryInfo(expiryDate: string | null) {
    if (!expiryDate) return { label: "No expiry set", color: "text-zinc-400", badge: "bg-zinc-100 text-zinc-500" };

    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: "Expired", color: "text-red-600", badge: "bg-red-50 text-red-600" };
    } else if (diffDays <= 30) {
        return { label: `Expires in ${diffDays} days`, color: "text-amber-600", badge: "bg-amber-50 text-amber-600" };
    } else if (diffDays <= 90) {
        return { label: `Expires in ${Math.ceil(diffDays / 30)} months`, color: "text-amber-500", badge: "bg-amber-50 text-amber-500" };
    } else {
        return { label: "Valid", color: "text-emerald-600", badge: "bg-emerald-50 text-emerald-600" };
    }
}

function isImageUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png") || lower.includes(".webp");
}

export function DocumentDetailModal({
    isOpen,
    onClose,
    onDeleted,
    document: doc,
}: DocumentDetailModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!doc) return null;

    const expiry = getExpiryInfo(doc.expiry_date);
    const hasFile = !!doc.file_url;
    const isImage = hasFile && isImageUrl(doc.file_url!);
    const isPdf = hasFile && doc.file_url!.toLowerCase().includes(".pdf");

    const handleDelete = async () => {
        setIsDeleting(true);

        // Delete from storage if there's a file
        if (doc.file_url) {
            // Extract storage path from URL
            const urlParts = doc.file_url.split("/documents/");
            if (urlParts.length > 1) {
                const storagePath = decodeURIComponent(urlParts[urlParts.length - 1]);
                await supabase.storage.from("documents").remove([storagePath]);
            }
        }

        // Delete the record
        const { error } = await supabase
            .from("documents")
            .delete()
            .eq("id", doc.id);

        if (error) {
            addToast(error.message, "error");
            setIsDeleting(false);
            return;
        }

        addToast("Document deleted");
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        onDeleted();
        onClose();
    };

    const handleClose = () => {
        setShowDeleteConfirm(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                        }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Document Preview */}
                        <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-t-2xl overflow-hidden">
                            {isImage ? (
                                <div className="relative h-64 w-full">
                                    <img
                                        src={doc.file_url!}
                                        alt={doc.title}
                                        className="h-full w-full object-contain bg-zinc-950 p-4"
                                    />
                                    {/* Gradient overlay on bottom */}
                                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-900/80 to-transparent" />
                                </div>
                            ) : isPdf ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-16">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                                        <FileIcon size={32} className="text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-zinc-400">
                                        PDF Document
                                    </p>
                                    <a
                                        href={doc.file_url!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                                    >
                                        <Download size={14} />
                                        Open PDF
                                    </a>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-16">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                                        <FileIcon size={32} className="text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-zinc-400">
                                        {hasFile ? "Document attached" : "No file uploaded"}
                                    </p>
                                </div>
                            )}

                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="absolute right-3 top-3 rounded-full bg-black/30 p-2 text-white transition-colors hover:bg-black/50 backdrop-blur-sm"
                            >
                                <X size={16} weight="bold" />
                            </button>

                            {/* Type badge */}
                            <div className="absolute left-4 top-4">
                                <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                                    {typeLabels[doc.type]}
                                </span>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="p-6 space-y-5">
                            {/* Title & status */}
                            <div>
                                <h2 className="text-xl font-bold text-zinc-900">
                                    {doc.title}
                                </h2>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${expiry.badge}`}>
                                        {expiry.label === "Expired" && <WarningCircle size={12} weight="fill" />}
                                        {expiry.label === "Valid" && <CheckCircle size={12} weight="fill" />}
                                        {expiry.label}
                                    </span>
                                    {hasFile && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                                            <CheckCircle size={12} weight="fill" />
                                            File attached
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-xl bg-zinc-50 p-3.5">
                                    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-400">
                                        Type
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                                        {typeLabels[doc.type]}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-zinc-50 p-3.5">
                                    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-400">
                                        Expiry Date
                                    </p>
                                    <p className={`mt-1 text-sm font-semibold ${expiry.color}`}>
                                        {doc.expiry_date
                                            ? new Date(doc.expiry_date).toLocaleDateString("en-US", {
                                                month: "long",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "Not set"}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-zinc-50 p-3.5">
                                    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-400">
                                        Added On
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                                        {new Date(doc.created_at).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-zinc-50 p-3.5">
                                    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-400">
                                        Document ID
                                    </p>
                                    <p className="mt-1 text-xs font-mono text-zinc-500 truncate">
                                        {doc.id.slice(0, 12)}...
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                {hasFile && (
                                    <a
                                        href={doc.file_url!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50"
                                    >
                                        <Download size={16} />
                                        Download
                                    </a>
                                )}
                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
                                    >
                                        <Trash size={16} />
                                        Delete
                                    </button>
                                ) : (
                                    <motion.button
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50"
                                    >
                                        <WarningCircle size={16} weight="fill" />
                                        {isDeleting ? "Deleting..." : "Confirm Delete"}
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
