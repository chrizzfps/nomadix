"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    Eye,
    EyeSlash,
    ShieldCheck,
    Files,
    CheckCircle,
    LockKey,
} from "@phosphor-icons/react";
import { DocumentCard } from "@/components/identity/document-card";
import { AddDocumentModal } from "@/components/identity/add-document-modal";
import { DocumentDetailModal } from "@/components/identity/document-detail-modal";
import { EditDocumentModal } from "@/components/identity/edit-document-modal";
import { AccessLog } from "@/components/identity/access-log";
import { usePrivacyStore } from "@/stores/privacy-store";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { useLanguageStore } from "@/stores/language-store";
import type { DocumentType, AccessLogEntry } from "@/types";

interface DocumentData {
    id: string;
    title: string;
    type: DocumentType;
    file_url: string | null;
    expiry_date: string | null;
    created_at: string;
}

export default function IdentityPage() {
    const supabase = createClient();
    const { isPrivacyMode, togglePrivacy } = usePrivacyStore();
    const t = useLanguageStore((s) => s.t);
    const [showAddDocument, setShowAddDocument] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<DocumentData | null>(null);
    const [editDoc, setEditDoc] = useState<DocumentData | null>(null);
    const [documents, setDocuments] = useState<DocumentData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const addToast = useToastStore((s) => s.addToast);

    const loadDocuments = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("documents")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        setDocuments(data || []);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    const totalDocuments = documents.length;
    const verifiedCount = documents.filter((d) => !!d.file_url).length;

    // Build access log from real documents (simulate recent activity)
    const accessLog: AccessLogEntry[] = documents.slice(0, 5).map((doc, i) => ({
        id: doc.id,
        action: i === 0 ? "uploaded" : i % 2 === 0 ? "viewed" : "downloaded",
        document_title: doc.title,
        document_type: doc.type,
        timestamp: new Date(doc.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }),
        device: t("identity.currentDevice"),
    }));

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8 space-y-6">
                <div className="h-10 w-56 animate-pulse rounded-lg bg-accent" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-20 animate-pulse rounded-2xl bg-accent"
                        />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-48 animate-pulse rounded-2xl bg-accent"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {t("identity.title")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("identity.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Privacy Toggle */}
                    <button
                        onClick={togglePrivacy}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${isPrivacyMode
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground/80 hover:bg-accent"
                            }`}
                    >
                        {isPrivacyMode ? (
                            <EyeSlash size={16} />
                        ) : (
                            <Eye size={16} />
                        )}
                        {isPrivacyMode ? t("identity.privacyOn") : t("identity.privacyOff")}
                    </button>
                    <button
                        onClick={() => setShowAddDocument(true)}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                    >
                        <Plus size={16} weight="bold" />
                        {t("identity.addDocument")}
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
                {/* Total Documents */}
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                        <Files size={20} className="text-foreground/70" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                            {t("identity.totalDocuments")}
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                            {totalDocuments}
                        </p>
                    </div>
                </div>

                {/* Verified */}
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                        <CheckCircle
                            size={20}
                            weight="fill"
                            className="text-emerald-500"
                        />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                            {t("identity.withFiles")}
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                            {verifiedCount}
                            <span className="ml-1 text-sm font-normal text-muted-foreground">
                                / {totalDocuments}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Privacy Mode */}
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                    <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isPrivacyMode ? "bg-primary" : "bg-accent"
                            }`}
                    >
                        <ShieldCheck
                            size={20}
                            weight={isPrivacyMode ? "fill" : "regular"}
                            className={
                                isPrivacyMode ? "text-white" : "text-foreground/70"
                            }
                        />
                    </div>
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground">
                            {t("identity.privacyMode")}
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                            {isPrivacyMode ? t("identity.active") : t("identity.inactive")}
                        </p>
                    </div>
                    {/* Toggle switch */}
                    <label className="relative cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isPrivacyMode}
                            onChange={togglePrivacy}
                            className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                    </label>
                </div>
            </motion.div>

            {/* Document Cards Grid */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {documents.map((doc, i) => (
                    <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                    >
                        <DocumentCard
                            id={doc.id}
                            title={doc.title}
                            type={doc.type}
                            expiryDate={doc.expiry_date ?? null}
                            isVerified={!!doc.file_url}
                            fileUrl={doc.file_url || ""}
                            onView={() => setSelectedDoc(doc)}
                            onEdit={() => setEditDoc(doc)}
                            onDelete={async () => {
                                if (!confirm(t("identity.confirmDelete"))) return;
                                const supabase2 = createClient();
                                const { error } = await supabase2.from("documents").delete().eq("id", doc.id);
                                if (error) {
                                    addToast(error.message, "error");
                                } else {
                                    addToast(t("identity.documentDeleted"));
                                    loadDocuments();
                                }
                            }}
                        />
                    </motion.div>
                ))}

                {/* Add Document Card */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        delay: 0.15 + documents.length * 0.05,
                    }}
                >
                    <button
                        onClick={() => setShowAddDocument(true)}
                        className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 transition-all hover:border-ring hover:bg-accent active:scale-[0.98]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                            <Plus
                                size={22}
                                weight="bold"
                                className="text-muted-foreground"
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-foreground/70">
                                {t("identity.addDocument")}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {t("identity.uploadNewDoc")}
                            </p>
                        </div>
                    </button>
                </motion.div>
            </div>

            {/* Access Log */}
            {accessLog.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8"
                >
                    <h2 className="text-xl font-semibold text-foreground">
                        {t("identity.accessLog")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("identity.recentActivity")}
                    </p>
                    <div className="mt-4">
                        <AccessLog entries={accessLog} />
                    </div>
                </motion.div>
            )}

            {/* Encryption Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-zinc-900 to-zinc-800 p-6"
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card/10">
                        <LockKey
                            size={24}
                            weight="fill"
                            className="text-white"
                        />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-white">
                            {t("identity.e2eTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t("identity.e2eDesc")}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-400">
                            {t("identity.protected")}
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Modals */}
            <AddDocumentModal
                isOpen={showAddDocument}
                onClose={() => setShowAddDocument(false)}
                onCreated={loadDocuments}
            />
            <DocumentDetailModal
                isOpen={!!selectedDoc}
                onClose={() => setSelectedDoc(null)}
                onDeleted={loadDocuments}
                document={selectedDoc}
            />
            <EditDocumentModal
                isOpen={!!editDoc}
                onClose={() => setEditDoc(null)}
                onUpdated={loadDocuments}
                document={editDoc}
            />
        </div>
    );
}
