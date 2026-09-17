"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    X,
    Tag,
    CheckCircle,
    XCircle,
    Trash,
    WarningCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { LimitBadge } from "@/components/plan/limit-badge";
import { UpgradeDialog } from "@/components/plan/upgrade-dialog";
import { usePlanLimit } from "@/hooks/use-plan-limit";
import {
    CATEGORY_ICON_MAP,
    DEFAULT_TRANSACTION_CATEGORIES,
    getCategoryLabel,
    normalizeHexColor,
    slugifyKey,
} from "@/lib/transaction-categories";
import { useLanguageStore } from "@/stores/language-store";

type CategoryRow = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    icon_key: string | null;
    color: string | null;
    is_active: boolean;
    is_system: boolean;
    created_at: string;
};

export default function CategoriesPage() {
    const supabase = createClient();
    const t = useLanguageStore((s) => s.t);

    const formatDbError = (message: string) => {
        if (
            message.includes("schema cache") ||
            message.includes("Could not find the table")
        ) {
            return "Falta crear la tabla transaction_categories en Supabase. Ejecuta supabase/schema.sql en el SQL Editor y luego recarga el schema de la API en Supabase (Settings → API → Reload schema).";
        }
        return message;
    };

    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<CategoryRow | null>(null);
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formIconKey, setFormIconKey] = useState("tag");
    const [formColor, setFormColor] = useState("#18181b");
    const [formActive, setFormActive] = useState(true);
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
    const [reassignToId, setReassignToId] = useState("");
    const [linkedCounts, setLinkedCounts] = useState<{
        transactions: number;
        subscriptions: number;
    } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const availableIcons = useMemo(() => {
        return Object.keys(CATEGORY_ICON_MAP)
            .filter((k) => k !== "tag")
            .sort((a, b) => a.localeCompare(b));
    }, []);

    const loadCategories = useCallback(async () => {
        setError(null);
        setIsLoading(true);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            setError("You must be logged in to manage categories.");
            setIsLoading(false);
            return;
        }

        const { data, error: fetchError } = await supabase
            .from("transaction_categories")
            .select("*")
            .eq("user_id", user.id)
            .order("name", { ascending: true });

        if (fetchError) {
            setError(formatDbError(fetchError.message));
            setIsLoading(false);
            return;
        }

        const rows = (data || []) as CategoryRow[];
        if (rows.length === 0) {
            const seed = DEFAULT_TRANSACTION_CATEGORIES.map((c) => ({
                user_id: user.id,
                key: c.key,
                name: c.name,
                description: c.description,
                icon_key: c.iconKey,
                color: c.color,
                is_active: c.isActive,
                is_system: c.isSystem ?? false,
            }));

            const { error: seedError } = await supabase
                .from("transaction_categories")
                .upsert(seed, { onConflict: "user_id,key" });

            if (seedError) {
                setError(formatDbError(seedError.message));
                setIsLoading(false);
                return;
            }

            const { data: seeded } = await supabase
                .from("transaction_categories")
                .select("*")
                .eq("user_id", user.id)
                .order("name", { ascending: true });

            setCategories(((seeded || []) as CategoryRow[]) || []);
            setIsLoading(false);
            return;
        }

        setCategories(rows);
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const [showUpgrade, setShowUpgrade] = useState(false);
    const categoryLimit = usePlanLimit("category");

    const openCreate = () => {
        if (categoryLimit.reached) {
            setShowUpgrade(true);
            return;
        }
        setEditing(null);
        setFormName("");
        setFormDescription("");
        setFormIconKey("tag");
        setFormColor("#18181b");
        setFormActive(true);
        setFormError(null);
        setIsModalOpen(true);
    };

    const openEdit = (row: CategoryRow) => {
        setEditing(row);
        setFormName(row.name);
        setFormDescription(row.description || "");
        setFormIconKey(row.icon_key || "tag");
        setFormColor(normalizeHexColor(row.color || "#18181b"));
        setFormActive(!!row.is_active);
        setFormError(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditing(null);
        setFormError(null);
    };

    const validateForm = () => {
        if (!formName.trim()) return "Name is required.";
        if (!/^#[0-9A-Fa-f]{6}$/.test(formColor.trim()))
            return "Color must be a valid hex (e.g. #18181b).";
        return null;
    };

    const handleSave = async () => {
        const msg = validateForm();
        if (msg) {
            setFormError(msg);
            return;
        }
        setFormSaving(true);
        setFormError(null);

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            setFormError("You must be logged in.");
            setFormSaving(false);
            return;
        }

        const payload = {
            name: formName.trim(),
            description: formDescription.trim() || null,
            icon_key: formIconKey || null,
            color: normalizeHexColor(formColor),
            is_active: formActive,
        };

        if (editing) {
            const { data: updated, error: updateError } = await supabase
                .from("transaction_categories")
                .update(payload)
                .eq("id", editing.id)
                .select("*")
                .single();

            if (updateError) {
                setFormError(formatDbError(updateError.message));
                setFormSaving(false);
                return;
            }

            setCategories((prev) =>
                prev.map((c) => (c.id === editing.id ? (updated as CategoryRow) : c))
            );
            setFormSaving(false);
            closeModal();
            return;
        }

        const key = slugifyKey(formName);
        if (!key) {
            setFormError("Unable to generate a unique identifier from the name.");
            setFormSaving(false);
            return;
        }

        const existingKey = categories.some((c) => c.key === key);
        if (existingKey) {
            setFormError("A category with the same identifier already exists.");
            setFormSaving(false);
            return;
        }

        const { data: created, error: createError } = await supabase
            .from("transaction_categories")
            .insert({
                user_id: user.id,
                key,
                ...payload,
            })
            .select("*")
            .single();

        if (createError) {
            setFormError(formatDbError(createError.message));
            setFormSaving(false);
            return;
        }

        setCategories((prev) =>
            [...prev, created as CategoryRow].sort((a, b) => a.name.localeCompare(b.name))
        );
        setFormSaving(false);
        closeModal();
    };

    const toggleActive = async (row: CategoryRow) => {
        const next = !row.is_active;
        setCategories((prev) =>
            prev.map((c) => (c.id === row.id ? { ...c, is_active: next } : c))
        );

        const { error: updateError } = await supabase
            .from("transaction_categories")
            .update({ is_active: next })
            .eq("id", row.id);

        if (updateError) {
            setCategories((prev) =>
                prev.map((c) => (c.id === row.id ? row : c))
            );
            setError(formatDbError(updateError.message));
        }
    };

    const reassignOptions = useMemo(() => {
        if (!deleteTarget) return [];
        return categories
            .filter((c) => c.id !== deleteTarget.id)
            .sort((a, b) => {
                if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
    }, [categories, deleteTarget]);

    const openDeleteConfirm = async (row: CategoryRow) => {
        setDeleteTarget(row);
        setDeleteError(null);
        setLinkedCounts(null);

        const fallback =
            categories.find((c) => c.is_system && c.id !== row.id) ||
            categories.find((c) => c.id !== row.id) ||
            null;
        setReassignToId(fallback?.id || "");

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const [{ count: txCount }, { count: subCount }] = await Promise.all([
            supabase
                .from("transactions")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("category", row.name),
            supabase
                .from("subscriptions")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("category", row.name),
        ]);

        setLinkedCounts({
            transactions: txCount || 0,
            subscriptions: subCount || 0,
        });
    };

    const closeDeleteModal = () => {
        setDeleteTarget(null);
        setLinkedCounts(null);
        setDeleteError(null);
        setReassignToId("");
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        const target = categories.find((c) => c.id === reassignToId);
        if (!target) {
            setDeleteError("Choose a category to move existing transactions to.");
            return;
        }

        setDeleteLoading(true);
        setDeleteError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setDeleteError("You must be logged in.");
            setDeleteLoading(false);
            return;
        }

        const { error: txError } = await supabase
            .from("transactions")
            .update({ category: target.name })
            .eq("user_id", user.id)
            .eq("category", deleteTarget.name);

        if (txError) {
            setDeleteError(formatDbError(txError.message));
            setDeleteLoading(false);
            return;
        }

        const { error: subError } = await supabase
            .from("subscriptions")
            .update({ category: target.name })
            .eq("user_id", user.id)
            .eq("category", deleteTarget.name);

        if (subError) {
            setDeleteError(formatDbError(subError.message));
            setDeleteLoading(false);
            return;
        }

        const { error: deleteRowError } = await supabase
            .from("transaction_categories")
            .delete()
            .eq("id", deleteTarget.id);

        if (deleteRowError) {
            setDeleteError(formatDbError(deleteRowError.message));
            setDeleteLoading(false);
            return;
        }

        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteLoading(false);
        closeDeleteModal();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                        <Tag size={20} className="text-foreground/70" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Categories
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Create and manage your transaction categories
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                    <Plus size={16} weight="bold" />
                    New Category
                    <LimitBadge entity="category" className="bg-primary-foreground/15 text-primary-foreground" />
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground/70">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="h-6 w-40 animate-pulse rounded-lg bg-accent" />
                    <div className="mt-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-14 animate-pulse rounded-xl bg-accent"
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="grid grid-cols-[1fr_120px_150px] gap-3 border-b border-border px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                        <span>Category</span>
                        <span>Status</span>
                        <span className="text-right">Actions</span>
                    </div>
                    <div className="divide-y divide-border">
                        {categories.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                                No categories found.
                            </div>
                        ) : (
                            categories.map((c) => {
                                const Icon =
                                    CATEGORY_ICON_MAP[c.icon_key || ""] || Tag;
                                return (
                                    <div
                                        key={c.id}
                                        className="grid grid-cols-[1fr_120px_150px] gap-3 px-5 py-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
                                                <Icon
                                                    size={18}
                                                    className="text-foreground/70"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                        {getCategoryLabel(c.name, t)}
                                                    </p>
                                                    {c.is_system && (
                                                        <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {c.description || "—"}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(c)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-accent"
                                        >
                                            {c.is_active ? (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Active
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle size={14} />
                                                    Inactive
                                                </>
                                            )}
                                        </button>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(c)}
                                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-accent"
                                            >
                                                Edit
                                            </button>
                                            {!c.is_system && (
                                                <button
                                                    type="button"
                                                    onClick={() => openDeleteConfirm(c)}
                                                    className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-foreground/70 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                                    aria-label={`Delete ${c.name}`}
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeModal}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{
                                type: "spring",
                                damping: 25,
                                stiffness: 300,
                            }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-border px-6 py-4">
                                <h3 className="text-base font-semibold text-foreground">
                                    {editing ? "Edit Category" : "New Category"}
                                </h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                                >
                                    <X size={18} weight="bold" />
                                </button>
                            </div>

                            <div className="space-y-4 px-6 py-5">
                                {formError && (
                                    <div className="rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground/70">
                                        {formError}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        Name
                                    </label>
                                    <input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        Description
                                    </label>
                                    <input
                                        value={formDescription}
                                        onChange={(e) =>
                                            setFormDescription(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                            Icon
                                        </label>
                                        <select
                                            value={formIconKey}
                                            onChange={(e) =>
                                                setFormIconKey(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        >
                                            <option value="tag">tag</option>
                                            {availableIcons.map((k) => (
                                                <option key={k} value={k}>
                                                    {k}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                            Color
                                        </label>
                                        <input
                                            value={formColor}
                                            onChange={(e) =>
                                                setFormColor(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-xl border border-border bg-accent px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            Active
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Disable to hide from category pickers
                                        </p>
                                    </div>
                                    <label className="relative cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={formActive}
                                            onChange={(e) =>
                                                setFormActive(e.target.checked)
                                            }
                                            className="peer sr-only"
                                        />
                                        <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
                                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform peer-checked:translate-x-4" />
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-accent"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={formSaving}
                                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {formSaving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteTarget && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeDeleteModal}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{
                                type: "spring",
                                damping: 25,
                                stiffness: 300,
                            }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-border px-6 py-4">
                                <h3 className="text-base font-semibold text-foreground">
                                    Delete &ldquo;{getCategoryLabel(deleteTarget.name, t)}&rdquo;
                                </h3>
                                <button
                                    type="button"
                                    onClick={closeDeleteModal}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
                                >
                                    <X size={18} weight="bold" />
                                </button>
                            </div>

                            <div className="space-y-4 px-6 py-5">
                                {deleteError && (
                                    <div className="rounded-xl border border-border bg-accent px-4 py-3 text-sm text-foreground/70">
                                        {deleteError}
                                    </div>
                                )}

                                <div className="flex gap-3 rounded-xl border border-border bg-accent px-4 py-3">
                                    <WarningCircle
                                        size={18}
                                        className="mt-0.5 shrink-0 text-foreground/60"
                                    />
                                    <p className="text-sm text-foreground/70">
                                        {linkedCounts === null ? (
                                            "Checking linked transactions…"
                                        ) : linkedCounts.transactions === 0 &&
                                          linkedCounts.subscriptions === 0 ? (
                                            "No transactions or subscriptions use this category."
                                        ) : (
                                            <>
                                                <strong>
                                                    {linkedCounts.transactions}
                                                </strong>{" "}
                                                transaction
                                                {linkedCounts.transactions === 1
                                                    ? ""
                                                    : "s"}{" "}
                                                and{" "}
                                                <strong>
                                                    {linkedCounts.subscriptions}
                                                </strong>{" "}
                                                subscription
                                                {linkedCounts.subscriptions === 1
                                                    ? ""
                                                    : "s"}{" "}
                                                use this category. They will be
                                                moved to the category you pick
                                                below.
                                            </>
                                        )}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground">
                                        Move existing transactions to
                                    </label>
                                    <select
                                        value={reassignToId}
                                        onChange={(e) =>
                                            setReassignToId(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-border bg-accent px-4 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                                    >
                                        {reassignOptions.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {getCategoryLabel(c.name, t)}
                                                {c.is_system ? " (default)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                                <button
                                    type="button"
                                    onClick={closeDeleteModal}
                                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-accent"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteConfirm}
                                    disabled={deleteLoading || !reassignToId}
                                    className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {deleteLoading ? "Deleting..." : "Delete category"}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <UpgradeDialog
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                reason="category"
            />
        </motion.div>
    );
}
