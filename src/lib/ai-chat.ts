// ============================================
// AI chat client — server-only provider fan-out
// ============================================
// Never import this from a "use client" file: it takes a decrypted API key
// as an argument and makes the outbound call, so it must only run inside a
// Route Handler / Server Action.

import type { AiProvider } from "@/lib/ai-providers";

export interface ChatCallResult {
    ok: boolean;
    text: string;
    error?: string;
    status?: number;
}

export async function callChatModel(params: {
    provider: AiProvider;
    model: string;
    apiKey: string;
    system: string;
    user: string;
}): Promise<ChatCallResult> {
    return params.provider === "openai" ? callOpenAI(params) : callGemini(params);
}

async function callOpenAI(params: {
    model: string;
    apiKey: string;
    system: string;
    user: string;
}): Promise<ChatCallResult> {
    let res: Response;
    try {
        res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${params.apiKey}`,
            },
            body: JSON.stringify({
                model: params.model,
                temperature: 0.4,
                messages: [
                    { role: "system", content: params.system },
                    { role: "user", content: params.user },
                ],
            }),
        });
    } catch {
        return { ok: false, text: "", error: "Could not reach OpenAI.", status: 502 };
    }

    if (!res.ok) {
        const detail = await res.json().catch(() => null);
        const message =
            res.status === 401
                ? "Invalid OpenAI API key."
                : detail?.error?.message || `OpenAI request failed (${res.status}).`;
        return { ok: false, text: "", error: message, status: res.status === 401 ? 401 : 502 };
    }

    const payload = await res.json();
    const text: string = payload?.choices?.[0]?.message?.content?.trim() || "";
    return { ok: true, text };
}

async function callGemini(params: {
    model: string;
    apiKey: string;
    system: string;
    user: string;
}): Promise<ChatCallResult> {
    let res: Response;
    try {
        res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": params.apiKey,
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: params.system }] },
                    contents: [{ role: "user", parts: [{ text: params.user }] }],
                    generationConfig: { temperature: 0.4 },
                }),
            }
        );
    } catch {
        return { ok: false, text: "", error: "Could not reach Gemini.", status: 502 };
    }

    if (!res.ok) {
        const detail = await res.json().catch(() => null);
        const message =
            res.status === 400 || res.status === 401 || res.status === 403
                ? "Invalid Gemini API key."
                : detail?.error?.message || `Gemini request failed (${res.status}).`;
        return {
            ok: false,
            text: "",
            error: message,
            status: [400, 401, 403].includes(res.status) ? 401 : 502,
        };
    }

    const payload = await res.json();
    const text: string =
        payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
        "";
    return { ok: true, text: text.trim() };
}
