import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMonthlyReportContext, buildReportPrompt } from "@/lib/ai-report";
import { todayISO } from "@/lib/subscriptions";
import type { Currency, Subscription, Transaction, Vault } from "@/types";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
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

    const { data: apiKey, error: keyError } = await supabase.rpc(
        "nomadix_get_openai_api_key"
    );
    if (keyError) {
        return NextResponse.json({ error: keyError.message }, { status: 500 });
    }
    if (!apiKey) {
        return NextResponse.json(
            { error: "No OpenAI API key configured.", code: "no_api_key" },
            { status: 400 }
        );
    }

    const [{ data: profile }, { data: transactions }, { data: subscriptions }, { data: vaults }] =
        await Promise.all([
            supabase.from("users_profile").select("base_currency").eq("id", user.id).single(),
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

    let openaiRes: Response;
    try {
        openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.4,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: userPrompt },
                ],
            }),
        });
    } catch {
        return NextResponse.json(
            { error: "Could not reach OpenAI. Check your connection and try again." },
            { status: 502 }
        );
    }

    if (!openaiRes.ok) {
        const status = openaiRes.status;
        const detail = await openaiRes.json().catch(() => null);
        const message =
            status === 401
                ? "Invalid OpenAI API key. Update it in Settings → AI Assistant."
                : detail?.error?.message || `OpenAI request failed (${status}).`;
        return NextResponse.json({ error: message }, { status: status === 401 ? 401 : 502 });
    }

    const payload = await openaiRes.json();
    const narrative: string = payload?.choices?.[0]?.message?.content?.trim() || "";

    return NextResponse.json({ context, narrative });
}
