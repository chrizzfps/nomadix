// ============================================
// AI providers — model catalog (pure)
// ============================================
// The curated list of models selectable in Settings → AI Assistant.
// Keep this to a handful of well-known, cheap/fast options per provider —
// this is a personal-finance report, not a model playground.

export type AiProvider = "openai" | "gemini";

export interface AiModelOption {
    id: string;
    label: string;
    description: string;
}

export interface AiProviderInfo {
    id: AiProvider;
    label: string;
    keyPlaceholder: string;
    getKeyUrl: string;
    models: AiModelOption[];
}

export const AI_PROVIDERS: AiProviderInfo[] = [
    {
        id: "openai",
        label: "OpenAI",
        keyPlaceholder: "sk-…",
        getKeyUrl: "https://platform.openai.com/api-keys",
        models: [
            {
                id: "gpt-4.1-mini",
                label: "GPT-4.1 mini",
                description: "Balanced quality & cost (recommended)",
            },
            { id: "gpt-4o-mini", label: "GPT-4o mini", description: "Cheapest option" },
            { id: "gpt-5-mini", label: "GPT-5 mini", description: "Latest, higher quality" },
        ],
    },
    {
        id: "gemini",
        label: "Gemini",
        keyPlaceholder: "AIza…",
        getKeyUrl: "https://aistudio.google.com/apikey",
        models: [
            {
                id: "gemini-2.5-flash",
                label: "Gemini 2.5 Flash",
                description: "Fast & capable (recommended)",
            },
            {
                id: "gemini-2.5-flash-lite",
                label: "Gemini 2.5 Flash Lite",
                description: "Fastest, most generous free tier",
            },
            { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Previous generation" },
        ],
    },
];

export function providerInfo(provider: AiProvider): AiProviderInfo {
    return AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];
}

export function isKnownModel(provider: AiProvider, model: string): boolean {
    return providerInfo(provider).models.some((m) => m.id === model);
}

export const DEFAULT_PROVIDER: AiProvider = "openai";
export const DEFAULT_MODEL: Record<AiProvider, string> = {
    openai: "gpt-4.1-mini",
    gemini: "gemini-2.5-flash",
};
