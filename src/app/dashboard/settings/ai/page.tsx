"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, FloppyDisk, Robot } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/stores/toast-store";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { AI_PROVIDERS, DEFAULT_MODEL, providerInfo, type AiProvider } from "@/lib/ai-providers";

export default function AiSettingsPage() {
    const supabase = createClient();
    const addToast = useToastStore((s) => s.addToast);

    const [provider, setProvider] = useState<AiProvider>("openai");
    const [model, setModel] = useState(DEFAULT_MODEL.openai);
    const [hasKey, setHasKey] = useState<Record<AiProvider, boolean>>({
        openai: false,
        gemini: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function loadPreference() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("users_profile")
                .select("preferred_ai_provider, preferred_ai_model")
                .eq("id", user.id)
                .single();

            if (data?.preferred_ai_provider) {
                const p = data.preferred_ai_provider as AiProvider;
                setProvider(p);
                setModel(data.preferred_ai_model || DEFAULT_MODEL[p]);
            }
            setIsLoading(false);
        }
        loadPreference();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleProviderChange = (p: AiProvider) => {
        setProvider(p);
        setModel(DEFAULT_MODEL[p]);
    };

    const handleSavePreference = async () => {
        setIsSaving(true);
        setSaved(false);
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from("users_profile")
            .update({ preferred_ai_provider: provider, preferred_ai_model: model })
            .eq("id", user.id);

        if (error) {
            addToast(error.message, "error");
        } else {
            setSaved(true);
            addToast("Default model saved");
            setTimeout(() => setSaved(false), 2000);
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-accent" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <Robot size={20} className="text-foreground/70" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground">AI Assistant</h2>
                    <p className="text-xs text-muted-foreground">
                        Connect an API key and pick the model used for AI features
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-sm font-semibold text-foreground">Default for reports</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Which provider and model generate your monthly report.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {AI_PROVIDERS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => handleProviderChange(p.id)}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                                provider === p.id
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-ring"
                            }`}
                        >
                            {p.label}
                            {!hasKey[p.id] && (
                                <span
                                    className={`text-[10px] font-medium normal-case ${
                                        provider === p.id ? "text-muted-foreground" : "text-amber-500"
                                    }`}
                                >
                                    no key
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="mt-3 space-y-2">
                    {providerInfo(provider).models.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => setModel(m.id)}
                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                                model === m.id
                                    ? "border-primary bg-accent"
                                    : "border-border bg-card hover:border-ring"
                            }`}
                        >
                            <div>
                                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                                <p className="text-xs text-muted-foreground">{m.description}</p>
                            </div>
                            {model === m.id && <Check size={16} weight="bold" className="text-foreground" />}
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleSavePreference}
                        disabled={isSaving}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${
                            saved ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                    >
                        {saved ? (
                            <>
                                <Check size={15} weight="bold" />
                                Saved
                            </>
                        ) : (
                            <>
                                <FloppyDisk size={15} />
                                {isSaving ? "Saving…" : "Save default"}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {AI_PROVIDERS.map((p) => (
                <ApiKeyCard
                    key={p.id}
                    provider={p}
                    onStatusChange={(has) => setHasKey((prev) => ({ ...prev, [p.id]: has }))}
                />
            ))}

            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2">
                    <Robot size={16} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">What this unlocks</h3>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>
                        <span className="font-medium text-foreground/80">Monthly AI report</span> — a
                        plain-English summary of your spending, income and trends, generated from
                        your real numbers.{" "}
                        <a href="/dashboard/reports" className="font-medium text-foreground underline">
                            Go to Reports →
                        </a>
                    </li>
                    <li>
                        <span className="font-medium text-foreground/80">Chat expense entry</span> —
                        coming soon.
                    </li>
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    Keys are encrypted at rest (Supabase Vault) and never shown again after saving —
                    only the last 4 characters are kept for display. Used server-side only, never
                    sent to your browser. Usage is billed by the provider directly to your account.
                </p>
            </div>
        </motion.div>
    );
}
