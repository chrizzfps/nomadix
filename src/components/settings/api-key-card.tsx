"use client";

import { useEffect, useState } from "react";
import { Key, Check, Trash, ArrowSquareOut } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import type { AiProviderInfo } from "@/lib/ai-providers";

interface KeyStatus {
    keyLast4: string;
    updatedAt: string;
}

export function ApiKeyCard({
    provider,
    onStatusChange,
}: {
    provider: AiProviderInfo;
    onStatusChange?: (hasKey: boolean) => void;
}) {
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
            .from("user_ai_keys")
            .select("key_last4, updated_at")
            .eq("provider", provider.id)
            .maybeSingle();
        const next = data ? { keyLast4: data.key_last4, updatedAt: data.updated_at } : null;
        setStatus(next);
        onStatusChange?.(!!next);
        setIsLoading(false);
    };

    useEffect(() => {
        loadStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider.id]);

    const handleSave = async () => {
        const key = inputValue.trim();
        if (key.length < 10) {
            setError("That doesn't look like a valid API key.");
            return;
        }
        setIsSaving(true);
        setError(null);
        setSaved(false);

        const { error: rpcError } = await supabase.rpc("nomadix_set_ai_api_key", {
            p_provider: provider.id,
            p_key: key,
        });

        if (rpcError) {
            setError(rpcError.message);
            addToast(rpcError.message, "error");
        } else {
            setInputValue("");
            setSaved(true);
            addToast(`${provider.label} API key saved`);
            await loadStatus();
            setTimeout(() => setSaved(false), 2000);
        }
        setIsSaving(false);
    };

    const handleRemove = async () => {
        setIsRemoving(true);
        const { error: rpcError } = await supabase.rpc("nomadix_delete_ai_api_key", {
            p_provider: provider.id,
        });
        if (rpcError) {
            addToast(rpcError.message, "error");
        } else {
            addToast(`${provider.label} API key removed`);
            setStatus(null);
            onStatusChange?.(false);
            setConfirmRemove(false);
        }
        setIsRemoving(false);
    };

    if (isLoading) {
        return <div className="h-32 animate-pulse rounded-2xl bg-accent" />;
    }

    return (
        <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Key size={15} className="text-muted-foreground" />
                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
                        {provider.label} API key
                    </label>
                </div>
                <a
                    href={provider.getKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline hover:text-foreground"
                >
                    Get a key
                    <ArrowSquareOut size={11} />
                </a>
            </div>

            {status ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-accent px-4 py-3">
                    <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                            ••••{status.keyLast4}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
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
                <p className="mt-2 text-xs text-muted-foreground">Not connected.</p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                    type="password"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setError(null);
                    }}
                    placeholder={status ? "Paste a new key to replace it…" : provider.keyPlaceholder}
                    className="w-full rounded-xl border border-border bg-accent px-4 py-3 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
                <button
                    onClick={handleSave}
                    disabled={isSaving || !inputValue.trim()}
                    className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                        saved ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                >
                    {saved ? (
                        <>
                            <Check size={16} weight="bold" />
                            Saved
                        </>
                    ) : (
                        <>{isSaving ? "Saving…" : status ? "Replace" : "Save"}</>
                    )}
                </button>
            </div>

            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
    );
}
