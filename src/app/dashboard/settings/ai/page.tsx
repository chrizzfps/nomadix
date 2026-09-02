"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkle, Key, Check, Trash, ArrowSquareOut, Robot } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";

interface KeyStatus {
    keyLast4: string;
    updatedAt: string;
}

export default function AiSettingsPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [status, setStatus] = useState<KeyStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const loadStatus = async () => {
        const { data } = await supabase
            .from("user_openai_key")
            .select("key_last4, updated_at")
            .maybeSingle();
        setStatus(data ? { keyLast4: data.key_last4, updatedAt: data.updated_at } : null);
        setIsLoading(false);
    };

    useEffect(() => {
        loadStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async () => {
        const key = inputValue.trim();
        if (key.length < 10) {
            setError("That doesn't look like a valid API key.");
            return;
        }
        setIsSaving(true);
        setError(null);
        setSaved(false);

        const { error: rpcError } = await supabase.rpc("nomadix_set_openai_api_key", {
            p_key: key,
        });

        if (rpcError) {
            setError(rpcError.message);
            addToast(rpcError.message, "error");
        } else {
            setInputValue("");
            setSaved(true);
            addToast("OpenAI API key saved");
            await loadStatus();
            setTimeout(() => setSaved(false), 2000);
        }
        setIsSaving(false);
    };

    const handleRemove = async () => {
        setIsRemoving(true);
        const { error: rpcError } = await supabase.rpc("nomadix_delete_openai_api_key");
        if (rpcError) {
            addToast(rpcError.message, "error");
        } else {
            addToast("OpenAI API key removed");
            setStatus(null);
            setConfirmRemove(false);
        }
        setIsRemoving(false);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
                ))}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                    <Sparkle size={20} className="text-zinc-600" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">AI Assistant</h2>
                    <p className="text-xs text-zinc-400">
                        Connect your own OpenAI API key to unlock AI features
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-center gap-2">
                    <Key size={15} className="text-zinc-400" />
                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-zinc-400">
                        OpenAI API key
                    </label>
                </div>

                {status ? (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <div>
                            <p className="font-mono text-sm font-semibold text-zinc-900">
                                sk-••••{status.keyLast4}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-400">
                                Updated{" "}
                                {new Date(status.updatedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </p>
                        </div>
                        {confirmRemove ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setConfirmRemove(false)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRemove}
                                    disabled={isRemoving}
                                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                                >
                                    {isRemoving ? "Removing…" : "Confirm"}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmRemove(true)}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
                            >
                                <Trash size={13} />
                                Remove
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="mt-2 text-xs text-zinc-400">
                        No key connected yet. Paste one below to enable AI features.
                    </p>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                        type="password"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            setError(null);
                        }}
                        placeholder={status ? "Paste a new key to replace it…" : "sk-…"}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-900 placeholder:font-sans placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                    />
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !inputValue.trim()}
                        className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                            saved ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white hover:bg-zinc-800"
                        }`}
                    >
                        {saved ? (
                            <>
                                <Check size={16} weight="bold" />
                                Saved
                            </>
                        ) : (
                            <>{isSaving ? "Saving…" : status ? "Replace key" : "Save key"}</>
                        )}
                    </button>
                </div>

                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

                <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                    Your key is encrypted at rest (Supabase Vault) and never shown again after
                    saving — only the last 4 characters are kept for display. It's used
                    server-side only, never sent to your browser.{" "}
                    <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-zinc-600 underline hover:text-zinc-900"
                    >
                        Get an API key
                        <ArrowSquareOut size={11} />
                    </a>
                </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-center gap-2">
                    <Robot size={16} className="text-zinc-400" />
                    <h3 className="text-sm font-semibold text-zinc-900">What this unlocks</h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-zinc-500">
                    <li>
                        <span className="font-medium text-zinc-700">Monthly AI report</span> — a
                        plain-English summary of your spending, income and trends, generated from
                        your real numbers.{" "}
                        <a href="/dashboard/reports" className="font-medium text-zinc-900 underline">
                            Go to Reports →
                        </a>
                    </li>
                    <li>
                        <span className="font-medium text-zinc-700">Chat expense entry</span> —
                        coming soon.
                    </li>
                </ul>
                <p className="mt-3 text-[11px] text-zinc-400">
                    Usage is billed by OpenAI directly to your account. A monthly report costs a
                    fraction of a cent on gpt-4.1-mini.
                </p>
            </div>
        </motion.div>
    );
}
