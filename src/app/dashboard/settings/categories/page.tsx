"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Tag, CheckCircle, XCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import {
    CATEGORY_ICON_MAP,
    DEFAULT_TRANSACTION_CATEGORIES,
    normalizeHexColor,
    slugifyKey,
} from "@/lib/transaction-categories";

type CategoryRow = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    icon_key: string | null;
    color: string | null;
    is_active: boolean;
    created_at: string;
};

export default function CategoriesPage() {
    const supabase = createClient();

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
            setError(fetchError.message);
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
            }));

            const { error: seedError } = await supabase
                .from("transaction_categories")
                .upsert(seed, { onConflict: "user_id,key" });

            if (seedError) {
                setError(seedError.message);
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

    const openCreate = () => {
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
                setFormError(updateError.message);
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
            setFormError(createError.message);
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
            setError(updateError.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                        <Tag size={20} className="text-zinc-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900">
                            Categories
                        </h2>
                        <p className="text-xs text-zinc-400">
                            Create and manage your transaction categories
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98]"
                >
                    <Plus size={16} weight="bold" />
                    New Category
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                    <div className="h-6 w-40 animate-pulse rounded-lg bg-zinc-100" />
                    <div className="mt-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-14 animate-pulse rounded-xl bg-zinc-50"
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div className="grid grid-cols-[1fr_120px_80px] gap-3 border-b border-zinc-100 px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase text-zinc-400">
                        <span>Category</span>
                        <span>Status</span>
                        <span className="text-right">Edit</span>
                    </div>
                    <div className="divide-y divide-zinc-50">
                        {categories.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-zinc-400">
                                No categories found.
                            </div>
                        ) : (
                            categories.map((c) => {
                                const Icon =
                                    CATEGORY_ICON_MAP[c.icon_key || ""] || Tag;
                                return (
                                    <div
                                        key={c.id}
                                        className="grid grid-cols-[1fr_120px_80px] gap-3 px-5 py-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                                                <Icon
                                                    size={18}
                                                    className="text-zinc-600"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-zinc-900">
                                                    {c.name}
                                                </p>
                                                <p className="truncate text-xs text-zinc-400">
                                                    {c.description || "—"}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(c)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
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
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(c)}
                                                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                                            >
                                                Edit
                                            </button>
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
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                                <h3 className="text-base font-semibold text-zinc-900">
                                    {editing ? "Edit Category" : "New Category"}
                                </h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                                >
                                    <X size={18} weight="bold" />
                                </button>
                            </div>

                            <div className="space-y-4 px-6 py-5">
                                {formError && (
                                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                        {formError}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                        Name
                                    </label>
                                    <input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                        Description
                                    </label>
                                    <input
                                        value={formDescription}
                                        onChange={(e) =>
                                            setFormDescription(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Icon
                                        </label>
                                        <select
                                            value={formIconKey}
                                            onChange={(e) =>
                                                setFormIconKey(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
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
                                        <label className="text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-400">
                                            Color
                                        </label>
                                        <input
                                            value={formColor}
                                            onChange={(e) =>
                                                setFormColor(e.target.value)
                                            }
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900">
                                            Active
                                        </p>
                                        <p className="text-xs text-zinc-400">
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
                                        <div className="h-5 w-9 rounded-full bg-zinc-200 peer-checked:bg-zinc-900 transition-colors" />
                                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={formSaving}
                                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {formSaving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

