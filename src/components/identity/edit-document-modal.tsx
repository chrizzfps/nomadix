"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    PencilSimple,
    CloudArrowUp,
    File as FileIcon,
    Trash,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { DOCUMENT_TYPES } from "@/lib/constants";
import type { DocumentType } from "@/types";

interface EditDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => void;
    document: {
        id: string;
        title: string;
        type: DocumentType;
        file_url: string | null;
        expiry_date: string | null;
    } | null;
}

export function EditDocumentModal({
    isOpen,
    onClose,
    onUpdated,
    document: doc,
}: EditDocumentModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState(doc?.title || "");
    const [docType, setDocType] = useState<DocumentType>(doc?.type || "passport");
    const [expiryDate, setExpiryDate] = useState(doc?.expiry_date || "");
    const [newFile, setNewFile] = useState<File | null>(null);
    const [removeFile, setRemoveFile] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync form when doc changes
    const [lastDocId, setLastDocId] = useState<string | null>(null);
    if (doc && doc.id !== lastDocId) {
        setLastDocId(doc.id);
        setTitle(doc.title);
        setDocType(doc.type);
        setExpiryDate(doc.expiry_date || "");
        setNewFile(null);
        setRemoveFile(false);
        setError(null);
    }

    if (!doc) return null;

    const handleFileSelect = (file: File) => {
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            setError("File size must be under 10MB.");
            return;
        }
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(file.type)) {
            setError("Only JPEG, PNG, WebP, and PDF files are allowed.");
            return;
        }
        setError(null);
        setNewFile(file);
        setRemoveFile(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Document title is required.");
            return;
        }

        setIsLoading(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setError("You must be logged in.");
            setIsLoading(false);
            return;
        }

        let fileUrl = doc.file_url;

        // Upload new file if provided
        if (newFile) {
            const fileExt = newFile.name.split(".").pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from("documents")
                .upload(fileName, newFile, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (uploadError) {
                setError(uploadError.message);
                setIsLoading(false);
                return;
            }

            const { data: signedUrlData } = await supabase.storage
                .from("documents")
                .createSignedUrl(fileName, 60 * 60 * 24 * 365);
            fileUrl = signedUrlData?.signedUrl || "";
        } else if (removeFile) {
            // Remove old file from storage
            if (doc.file_url) {
                const urlParts = doc.file_url.split("/documents/");
                if (urlParts.length > 1) {
                    const storagePath = decodeURIComponent(urlParts[urlParts.length - 1]);
                    await supabase.storage.from("documents").remove([storagePath]);
                }
            }
            fileUrl = null;
        }

        // Update record
        const { error: updateError } = await supabase
            .from("documents")
            .update({
                title: title.trim(),
                type: docType,
                expiry_date: expiryDate || null,
                file_url: fileUrl,
            })
            .eq("id", doc.id);

        if (updateError) {
            setError(updateError.message);
            addToast(updateError.message, "error");
            setIsLoading(false);
            return;
        }

        setIsLoading(false);
        addToast("Document updated");
        onUpdated();
        onClose();
    };

    const currentFile = removeFile ? null : (newFile ? newFile.name : doc.file_url);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                                    <PencilSimple size={20} className="text-zinc-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900">
                                        Edit Document
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Update document details
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="mt-6 space-y-5">
                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Document Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                            </div>

                            {/* Document Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {DOCUMENT_TYPES.map((dt) => (
                                        <button
                                            key={dt.value}
                                            type="button"
                                            onClick={() => setDocType(dt.value as DocumentType)}
                                            className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${docType === dt.value
                                                ? "border-zinc-900 bg-zinc-900 text-white"
                                                : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                                                }`}
                                        >
                                            {dt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Expiry Date */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    Expiry Date{" "}
                                    <span className="normal-case tracking-normal text-zinc-300">
                                        (optional)
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                />
                            </div>

                            {/* File */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                                    File
                                </label>

                                {currentFile ? (
                                    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                                        <FileIcon size={20} className="shrink-0 text-zinc-500" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-zinc-700">
                                                {newFile
                                                    ? newFile.name
                                                    : "Current file attached"}
                                            </p>
                                            {newFile && (
                                                <p className="text-[11px] text-zinc-400">
                                                    {(newFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewFile(null);
                                                setRemoveFile(true);
                                            }}
                                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setIsDragging(true);
                                        }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-all ${isDragging
                                            ? "border-zinc-400 bg-zinc-100"
                                            : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100"
                                            }`}
                                    >
                                        <CloudArrowUp size={28} className="text-zinc-400" />
                                        <p className="text-sm font-medium text-zinc-500">
                                            {isDragging ? "Drop file here" : "Drag & drop or click to browse"}
                                        </p>
                                        <p className="text-[11px] text-zinc-400">
                                            JPEG, PNG, WebP, PDF — Max 10MB
                                        </p>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelect(file);
                                    }}
                                    className="hidden"
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading || !title.trim()}
                                className="flex-1 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isLoading ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
