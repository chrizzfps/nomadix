import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    ExchangeRateCurrencySchema,
    safeParseExchangeRatePutPayload,
} from "@/lib/user-exchange-rate";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const baseCurrency = ExchangeRateCurrencySchema.safeParse(
        url.searchParams.get("baseCurrency") || "USD"
    );
    const targetCurrency = ExchangeRateCurrencySchema.safeParse(
        url.searchParams.get("targetCurrency") || "EUR"
    );

    if (!baseCurrency.success || !targetCurrency.success) {
        return NextResponse.json(
            { error: "Invalid currency." },
            { status: 400 }
        );
    }

    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("user_exchange_rates")
        .select("exchange_rate,last_updated,base_currency,target_currency")
        .eq("user_id", user.id)
        .eq("base_currency", baseCurrency.data)
        .eq("target_currency", targetCurrency.data)
        .maybeSingle();

    if (error) {
        const msg =
            error.message.includes("schema cache") ||
            error.message.includes("Could not find the table")
                ? "Missing table user_exchange_rates. Apply supabase/schema.sql and reload the API schema cache in Supabase."
                : error.message;
        return NextResponse.json(
            { error: msg },
            { status: msg.startsWith("Missing table") ? 503 : 500 }
        );
    }

    return NextResponse.json(
        data
            ? {
                  baseCurrency: data.base_currency,
                  targetCurrency: data.target_currency,
                  exchangeRate: data.exchange_rate,
                  lastUpdated: data.last_updated,
              }
            : {
                  baseCurrency: baseCurrency.data,
                  targetCurrency: targetCurrency.data,
                  exchangeRate: null,
                  lastUpdated: null,
              }
    );
}

export async function PUT(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = safeParseExchangeRatePutPayload(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload." },
            { status: 400 }
        );
    }

    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = {
        user_id: user.id,
        base_currency: parsed.data.baseCurrency,
        target_currency: parsed.data.targetCurrency,
        exchange_rate: parsed.data.exchangeRate,
        last_updated: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from("user_exchange_rates")
        .upsert(payload, { onConflict: "user_id,base_currency,target_currency" })
        .select("exchange_rate,last_updated,base_currency,target_currency")
        .single();

    if (error) {
        const msg =
            error.message.includes("schema cache") ||
            error.message.includes("Could not find the table")
                ? "Missing table user_exchange_rates. Apply supabase/schema.sql and reload the API schema cache in Supabase."
                : error.message;
        return NextResponse.json(
            { error: msg },
            { status: msg.startsWith("Missing table") ? 503 : 500 }
        );
    }

    return NextResponse.json({
        baseCurrency: data.base_currency,
        targetCurrency: data.target_currency,
        exchangeRate: data.exchange_rate,
        lastUpdated: data.last_updated,
    });
}
