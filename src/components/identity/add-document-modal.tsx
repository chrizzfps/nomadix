"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    IdentificationCard,
    CloudArrowUp,
    File as FileIcon,
    Trash,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { DOCUMENT_TYPES } from "@/lib/constants";
import type { DocumentType } from "@/types";

interface AddDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export function AddDocumentModal({
    isOpen,
    onClose,
    onCreated,
}: AddDocumentModalProps) {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState("");
    const [docType, setDocType] = useState<DocumentType>("passport");
    const [expiryDate, setExpiryDate] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setTitle("");
        setDocType("passport");
        setExpiryDate("");
        setSelectedFile(null);
        setError(null);
    };

    const handleFileSelect = (file: File) => {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            setError("File size must be under 10MB.");
            return;
        }
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
        ];
        if (!allowedTypes.includes(file.type)) {
            setError("Only JPEG, PNG, WebP, and PDF files are allowed.");
            return;
        }
        setError(null);
        setSelectedFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleCreate = async () => {
        if (!title.trim()) {
            setError("Document title is required.");
            return;
        }
        if (!selectedFile) {
            setError("Please select a file to upload.");
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

        // Upload file to Supabase Storage
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, selectedFile, {
                cacheControl: "3600",
                upsert: false,
            });

        if (uploadError) {
            setError(uploadError.message);
            addToast("Upload failed", "error");
            setIsLoading(false);
            return;
        }

        // Get signed URL (works even if bucket is not public)
        const { data: signedUrlData } = await supabase.storage
            .from("documents")
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

        const fileUrl = signedUrlData?.signedUrl || "";

        // Insert document record
        const { error: insertError } = await supabase.from("documents").insert({
            user_id: user.id,
            title: title.trim(),
            type: docType,
            file_url: fileUrl,
            expiry_date: expiryDate || null,
        });

        if (insertError) {
            setError(insertError.message);
            addToast(insertError.message, "error");
            setIsLoading(false);
            return;
        }

        resetForm();
        setIsLoading(false);
        addToast("Document uploaded");
        onCreated();
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
                        onClick={onClose}
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
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                    <IdentificationCard
                                        size={20}
                                        className="text-foreground/70"
                                    />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        Add Document
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Upload a new identity document
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="mt-6 space-y-5">
                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Document Title
                                </label>
                                <input
                                    type="text"
                                    placeholder='e.g. "Spanish Passport", "US B1 Visa"'
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    autoFocus
                                    className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            {/* Document Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {DOCUMENT_TYPES.map((dt) => (
                                        <button
                                            key={dt.value}
                                            type="button"
                                            onClick={() =>
                                                setDocType(
                                                    dt.value as DocumentType
                                                )
                                            }
                                            className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${docType === dt.value
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-card text-muted-foreground hover:border-ring"
                                                }`}
                                        >
                                            {dt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Expiry Date */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    Expiry Date{" "}
                                    <span className="normal-case tracking-normal text-muted-foreground">
                                        (optional)
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={(e) =>
                                        setExpiryDate(e.target.value)
                                    }
                                    className="w-full rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                />
                            </div>

                            {/* File Upload */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                    File
                                </label>

                                {!selectedFile ? (
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-all ${isDragging
                                            ? "border-ring bg-accent"
                                            : "border-border bg-accent hover:border-ring hover:bg-accent"
                                            }`}
                                    >
                                        <CloudArrowUp
                                            size={28}
                                            className="text-muted-foreground"
                                        />
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {isDragging
                                                ? "Drop file here"
                                                : "Drag & drop or click to browse"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            JPEG, PNG, WebP, PDF — Max 10MB
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 rounded-xl border border-border bg-accent px-4 py-3">
                                        <FileIcon
                                            size={20}
                                            className="shrink-0 text-muted-foreground"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-foreground/80">
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {(
                                                    selectedFile.size /
                                                    1024 /
                                                    1024
                                                ).toFixed(2)}{" "}
                                                MB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedFile(null)
                                            }
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70"
                                        >
                                            <Trash size={16} />
                                        </button>
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
                                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 transition-all hover:bg-accent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={
                                    isLoading || !title.trim() || !selectedFile
                                }
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isLoading ? "Uploading..." : "Add Document"}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
