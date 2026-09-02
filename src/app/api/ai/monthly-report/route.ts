import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMonthlyReportContext, buildReportPrompt } from "@/lib/ai-report";
import { callChatModel } from "@/lib/ai-chat";
import { DEFAULT_MODEL, isKnownModel, type AiProvider } from "@/lib/ai-providers";
import { todayISO } from "@/lib/subscriptions";
import type { Currency, Subscription, Transaction, Vault } from "@/types";

const MONTH_RE = /^\d{4}-\d{2}$/;

async function resolveUsdEurRate(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
): Promise<number> {
    const { data } = await supabase
        .from("user_exchange_rates")
        .select("base_currency,target_currency,exchange_rate")
        .eq("user_id", userId)
        .order("last_updated", { ascending: false });

    const direct = (data || []).find(
        (r) => r.base_currency === "USD" && r.target_currency === "EUR" && r.exchange_rate > 0
    );
    if (direct) return direct.exchange_rate;

    const inverse = (data || []).find(
        (r) => r.base_currency === "EUR" && r.target_currency === "USD" && r.exchange_rate > 0
    );
    if (inverse) return 1 / inverse.exchange_rate;

    return 0.92;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const monthISO: string =
        typeof body?.month === "string" && MONTH_RE.test(body.month)
            ? body.month
            : todayISO().slice(0, 7);

    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("users_profile")
        .select("base_currency, preferred_ai_provider, preferred_ai_model")
        .eq("id", user.id)
        .single();

    const provider: AiProvider = profile?.preferred_ai_provider === "gemini" ? "gemini" : "openai";
    const model =
        profile?.preferred_ai_model && isKnownModel(provider, profile.preferred_ai_model)
            ? profile.preferred_ai_model
            : DEFAULT_MODEL[provider];

    const { data: apiKey, error: keyError } = await supabase.rpc("nomadix_get_ai_api_key", {
        p_provider: provider,
    });
    if (keyError) {
        return NextResponse.json({ error: keyError.message }, { status: 500 });
    }
    if (!apiKey) {
        return NextResponse.json(
            {
                error: `No ${provider === "openai" ? "OpenAI" : "Gemini"} API key configured.`,
                code: "no_api_key",
                provider,
            },
            { status: 400 }
        );
    }

    const [{ data: transactions }, { data: subscriptions }, { data: vaults }] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active"),
        supabase.from("vaults").select("*").eq("user_id", user.id),
    ]);

    const reportCurrency: Currency = profile?.base_currency || "EUR";
    const usdEurRate = await resolveUsdEurRate(supabase, user.id);

    const context = buildMonthlyReportContext({
        transactions: (transactions || []) as Transaction[],
        subscriptions: (subscriptions || []) as Subscription[],
        vaults: (vaults || []) as Vault[],
        monthISO,
        reportCurrency,
        usdEurRate,
    });

    const { system, user: userPrompt } = buildReportPrompt(context);

    const result = await callChatModel({ provider, model, apiKey, system, user: userPrompt });

    if (!result.ok) {
        return NextResponse.json({ error: result.error, provider }, { status: result.status || 502 });
    }

    return NextResponse.json({ context, narrative: result.text, provider, model });
}
