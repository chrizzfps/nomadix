create table if not exists public.transaction_categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    name text not null,
    description text,
    icon_key text,
    color text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (user_id, key)
);

alter table public.transaction_categories enable row level security;

create policy "transaction_categories_select_own"
on public.transaction_categories
for select
using (auth.uid() = user_id);

create policy "transaction_categories_insert_own"
on public.transaction_categories
for insert
with check (auth.uid() = user_id);

create policy "transaction_categories_update_own"
on public.transaction_categories
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "transaction_categories_delete_own"
on public.transaction_categories
for delete
using (auth.uid() = user_id);

create table if not exists public.user_exchange_rates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    base_currency text not null,
    target_currency text not null,
    exchange_rate numeric not null,
    last_updated timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (user_id, base_currency, target_currency)
);

alter table public.user_exchange_rates enable row level security;

create policy "user_exchange_rates_select_own"
on public.user_exchange_rates
for select
using (auth.uid() = user_id);

create policy "user_exchange_rates_insert_own"
on public.user_exchange_rates
for insert
with check (auth.uid() = user_id);

create policy "user_exchange_rates_update_own"
on public.user_exchange_rates
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_exchange_rates_delete_own"
on public.user_exchange_rates
for delete
using (auth.uid() = user_id);

do $$
begin
    if to_regclass('public.transactions') is not null then
        update public.transactions
        set category = null
        where type = 'transfer' and category is not null;

        alter table public.transactions
        drop constraint if exists transactions_transfer_no_category;

        alter table public.transactions
        add constraint transactions_transfer_no_category
        check (type <> 'transfer' or category is null);
    end if;
end $$;

-- Migration: Add fee column to transactions table for vault transfer commissions
alter table public.transactions add column if not exists fee numeric not null default 0;


-- ============================================================================
-- SUBSCRIPTIONS & RECURRING PAYMENTS
-- ----------------------------------------------------------------------------
-- Phase 0: tables, indexes, RLS, updated_at triggers.
-- Re-runnable: every statement is idempotent.
-- After applying: Supabase -> Settings -> API -> Reload schema
--                 (or: notify pgrst, 'reload schema';)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- subscriptions: the recurrence rule
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    vault_id uuid not null references public.vaults(id) on delete cascade,

    -- Presentation
    name text not null,
    merchant text,
    description text,
    category text,                  -- free text = category NAME (repo convention)
    icon_key text,
    color text not null default '#18181b',
    cancel_url text,
    notes text,

    -- Money (unsigned magnitude; the sign lives only in public.transactions)
    direction text not null default 'expense'
        check (direction in ('expense', 'income')),
    amount numeric(14,2) not null default 0 check (amount >= 0),
    currency text not null default 'EUR'
        check (currency in ('EUR', 'USD')),
    is_variable_amount boolean not null default false,
    fee_mode text not null default 'none'
        check (fee_mode in ('none', 'fixed', 'percent')),
    fee_value numeric(14,4) not null default 0 check (fee_value >= 0),

    -- Recurrence
    billing_cycle text not null default 'monthly'
        check (billing_cycle in ('weekly','biweekly','monthly','quarterly','semiannual','yearly','custom_days')),
    interval_count integer not null default 1
        check (interval_count between 1 and 60),
    custom_interval_days integer
        check (custom_interval_days is null or custom_interval_days between 1 and 3650),
    anchor_day smallint
        check (anchor_day is null or anchor_day between 1 and 31),
    start_date date not null default current_date,
    end_date date,
    next_due_date date not null,
    last_charged_date date,

    -- Trial
    trial_end_date date,
    trial_amount numeric(14,2) not null default 0 check (trial_amount >= 0),

    -- Lifecycle
    status text not null default 'active'
        check (status in ('active','paused','canceled','ended')),
    auto_charge boolean not null default true,
    canceled_at timestamptz,

    -- Reminders (v1 in-app; email columns reserved for v2)
    reminder_days_before smallint not null default 3
        check (reminder_days_before between 0 and 60),
    notify_in_app boolean not null default true,
    notify_email boolean not null default false,
    last_reminder_seen_at timestamptz,
    last_email_sent_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint subscriptions_end_after_start
        check (end_date is null or end_date >= start_date),
    constraint subscriptions_custom_days_required
        check (billing_cycle <> 'custom_days' or custom_interval_days is not null),
    constraint subscriptions_trial_after_start
        check (trial_end_date is null or trial_end_date >= start_date)
);

create index if not exists subscriptions_user_id_idx
    on public.subscriptions (user_id);
create index if not exists subscriptions_user_status_due_idx
    on public.subscriptions (user_id, status, next_due_date);
create index if not exists subscriptions_due_active_idx
    on public.subscriptions (next_due_date) where status = 'active';
create index if not exists subscriptions_vault_id_idx
    on public.subscriptions (vault_id);

-- ---------------------------------------------------------------------------
-- subscription_occurrences: the payment ledger.
-- unique (subscription_id, due_date) IS the idempotency key that stops
-- cron + client catch-up from double-charging the same period.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_occurrences (
    id uuid primary key default gen_random_uuid(),
    subscription_id uuid not null references public.subscriptions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,

    due_date date not null,
    status text not null default 'pending'
        check (status in ('pending','charged','skipped','failed','canceled')),

    -- Amounts stored in the SUBSCRIPTION's currency (the un-converted truth)
    expected_amount numeric(14,2) not null default 0,
    actual_amount numeric(14,2),
    fee_amount numeric(14,2) not null default 0,
    currency text not null default 'EUR'
        check (currency in ('EUR','USD')),
    exchange_rate_at_time numeric,

    transaction_id uuid references public.transactions(id) on delete set null,
    charged_at timestamptz,
    failure_reason text,
    notes text,
    is_trial boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (subscription_id, due_date)
);

create index if not exists subscription_occurrences_user_idx
    on public.subscription_occurrences (user_id);
create index if not exists subscription_occurrences_user_status_due_idx
    on public.subscription_occurrences (user_id, status, due_date);
create index if not exists subscription_occurrences_sub_due_idx
    on public.subscription_occurrences (subscription_id, due_date desc);
create index if not exists subscription_occurrences_tx_idx
    on public.subscription_occurrences (transaction_id);

-- ---------------------------------------------------------------------------
-- subscription_price_changes: price history (populated in Phase 5)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_price_changes (
    id uuid primary key default gen_random_uuid(),
    subscription_id uuid not null references public.subscriptions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    old_amount numeric(14,2) not null,
    new_amount numeric(14,2) not null,
    currency text not null,
    source text not null default 'manual'
        check (source in ('manual','charge')),
    note text,
    changed_at timestamptz not null default now()
);

create index if not exists subscription_price_changes_sub_idx
    on public.subscription_price_changes (subscription_id, changed_at desc);
create index if not exists subscription_price_changes_user_idx
    on public.subscription_price_changes (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared)
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
    new.updated_at = now();
    return new;
end $$;

drop trigger if exists subscriptions_touch_trg on public.subscriptions;
create trigger subscriptions_touch_trg
    before update on public.subscriptions
    for each row execute function public.nomadix_touch_updated_at();

drop trigger if exists subscription_occurrences_touch_trg on public.subscription_occurrences;
create trigger subscription_occurrences_touch_trg
    before update on public.subscription_occurrences
    for each row execute function public.nomadix_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: 4 own-row policies per table, idempotent
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.subscription_occurrences enable row level security;
alter table public.subscription_price_changes enable row level security;

do $$
begin
    -- subscriptions
    begin
        create policy "subscriptions_select_own" on public.subscriptions
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscriptions_insert_own" on public.subscriptions
        for insert with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscriptions_update_own" on public.subscriptions
        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscriptions_delete_own" on public.subscriptions
        for delete using (auth.uid() = user_id);
    exception when duplicate_object then null; end;

    -- subscription_occurrences
    begin
        create policy "subscription_occurrences_select_own" on public.subscription_occurrences
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscription_occurrences_insert_own" on public.subscription_occurrences
        for insert with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscription_occurrences_update_own" on public.subscription_occurrences
        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscription_occurrences_delete_own" on public.subscription_occurrences
        for delete using (auth.uid() = user_id);
    exception when duplicate_object then null; end;

    -- subscription_price_changes
    begin
        create policy "subscription_price_changes_select_own" on public.subscription_price_changes
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscription_price_changes_insert_own" on public.subscription_price_changes
        for insert with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscription_price_changes_update_own" on public.subscription_price_changes
        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "subscription_price_changes_delete_own" on public.subscription_price_changes
        for delete using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
end $$;

-- ============================================================================
-- SUBSCRIPTIONS ENGINE (Phase 2)
-- ----------------------------------------------------------------------------
-- Recurrence math + FX resolver + charger + catch-up driver + skip.
-- All charge/skip/driver functions are SECURITY DEFINER: they must run for
-- pg_cron (no JWT) as well as for a logged-in user via supabase.rpc(). Each
-- restores the RLS guarantee explicitly by checking auth.uid() against the
-- row's own user_id whenever a JWT is present.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- nomadix_next_due_date: pure recurrence math. Mirrored exactly by
-- nextDueDate() in src/lib/subscriptions.ts -- keep them identical.
--
-- Month-based cycles move to the target month FIRST, then clamp the day to
-- that month's last day. This ordering is why Jan 31 -> Feb 28 -> Mar 31
-- (not Mar 28): the anchor is re-applied against the new month, not carried
-- forward from the clamped previous date.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_next_due_date(
    p_from date,
    p_cycle text,
    p_interval_count integer default 1,
    p_custom_days integer default null,
    p_anchor_day smallint default null
) returns date
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
    v_n        integer := greatest(coalesce(p_interval_count, 1), 1);
    v_months   integer;
    v_target   date;
    v_last_day integer;
    v_day      integer;
begin
    if p_from is null then
        return null;
    end if;

    if p_cycle = 'weekly' then
        return p_from + (7 * v_n);
    elsif p_cycle = 'biweekly' then
        return p_from + (14 * v_n);
    elsif p_cycle = 'custom_days' then
        return p_from + (greatest(coalesce(p_custom_days, 30), 1) * v_n);
    end if;

    v_months := case p_cycle
        when 'monthly'    then 1 * v_n
        when 'quarterly'  then 3 * v_n
        when 'semiannual' then 6 * v_n
        when 'yearly'     then 12 * v_n
        else 1 * v_n
    end;

    v_target   := (date_trunc('month', p_from::timestamp)
                   + make_interval(months => v_months))::date;
    v_last_day := extract(day from
                   (date_trunc('month', v_target::timestamp)
                    + interval '1 month' - interval '1 day'))::integer;
    v_day      := least(
                    coalesce(p_anchor_day::integer, extract(day from p_from)::integer),
                    v_last_day
                  );

    return make_date(
        extract(year  from v_target)::integer,
        extract(month from v_target)::integer,
        v_day
    );
end $$;

-- ---------------------------------------------------------------------------
-- nomadix_usd_eur_rate: FX resolver for the charger.
-- SECURITY DEFINER is required: under pg_cron auth.uid() is NULL, so RLS on
-- user_exchange_rates would return zero rows and every charge would silently
-- fall back to 0.92 for every user. This bypasses RLS deliberately, scoped
-- by the (trusted, caller-supplied) p_user_id.
-- Fallback 0.92 matches getActiveUsdToEurRate() in src/lib/currency.ts.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_usd_eur_rate(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        (select r.exchange_rate
           from public.user_exchange_rates r
          where r.user_id = p_user_id
            and r.base_currency = 'USD' and r.target_currency = 'EUR'
            and r.exchange_rate > 0
          order by r.last_updated desc
          limit 1),
        (select 1.0 / r.exchange_rate
           from public.user_exchange_rates r
          where r.user_id = p_user_id
            and r.base_currency = 'EUR' and r.target_currency = 'USD'
            and r.exchange_rate > 0
          order by r.last_updated desc
          limit 1),
        0.92
    );
$$;

revoke all on function public.nomadix_usd_eur_rate(uuid) from public, anon;
grant execute on function public.nomadix_usd_eur_rate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_charge_occurrence: charge exactly one due date, atomically.
-- Returns the transactions.id that was created (or already existed).
-- Returns null when nothing was charged (paused, out of range, variable
-- amount awaiting confirmation, or vault missing).
--
-- Double-charge protection, in order:
--   1. `select ... for update` on the subscription serializes concurrent
--      callers (cron vs client rpc vs a double click).
--   2. A terminal occurrence (charged/skipped/canceled) short-circuits as
--      a no-op and returns the original transaction id.
--   3. `unique (subscription_id, due_date)` + the upsert's
--      `where status in ('pending','failed')` refuses to overwrite a
--      charged row even under a race the lock didn't catch.
--   4. The pointer advance is guarded by `where next_due_date <= p_due_date`
--      so a manual backfill of an old date can never rewind the schedule.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_charge_occurrence(
    p_subscription_id uuid,
    p_due_date        date,
    p_amount_override numeric default null,
    p_note            text    default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sub        public.subscriptions%rowtype;
    v_occ        public.subscription_occurrences%rowtype;
    v_vault_cur  text;
    v_rate       numeric := null;
    v_is_trial   boolean;
    v_base       numeric;
    v_fee        numeric;
    v_base_n     numeric;
    v_fee_n      numeric;
    v_signed     numeric;
    v_tx_id      uuid;
    v_next       date;
begin
    select * into v_sub
      from public.subscriptions
     where id = p_subscription_id
     for update;

    if not found then
        raise exception 'Subscription % not found', p_subscription_id
            using errcode = 'no_data_found';
    end if;

    if auth.uid() is not null and auth.uid() <> v_sub.user_id then
        raise exception 'Not authorized' using errcode = 'insufficient_privilege';
    end if;

    if v_sub.status <> 'active' then
        return null;
    end if;
    if p_due_date < v_sub.start_date then
        return null;
    end if;
    if v_sub.end_date is not null and p_due_date > v_sub.end_date then
        return null;
    end if;

    select * into v_occ
      from public.subscription_occurrences
     where subscription_id = p_subscription_id
       and due_date = p_due_date
     for update;

    if found and v_occ.status in ('charged','skipped','canceled') then
        return v_occ.transaction_id;
    end if;

    v_is_trial := v_sub.trial_end_date is not null
                  and p_due_date <= v_sub.trial_end_date;

    v_base := coalesce(
        p_amount_override,
        case when v_is_trial then v_sub.trial_amount else v_sub.amount end
    );

    if v_sub.is_variable_amount and p_amount_override is null then
        insert into public.subscription_occurrences
            (subscription_id, user_id, due_date, status,
             expected_amount, currency, is_trial)
        values (v_sub.id, v_sub.user_id, p_due_date, 'pending',
                v_base, v_sub.currency, v_is_trial)
        on conflict (subscription_id, due_date) do nothing;
        return null;
    end if;

    v_fee := case v_sub.fee_mode
        when 'fixed'   then v_sub.fee_value
        when 'percent' then round(v_base * v_sub.fee_value / 100.0, 2)
        else 0
    end;

    select currency into v_vault_cur from public.vaults where id = v_sub.vault_id;
    if v_vault_cur is null then
        insert into public.subscription_occurrences
            (subscription_id, user_id, due_date, status, expected_amount,
             currency, is_trial, failure_reason)
        values (v_sub.id, v_sub.user_id, p_due_date, 'failed', v_base,
                v_sub.currency, v_is_trial, 'Vault not found')
        on conflict (subscription_id, due_date) do update
           set status = 'failed', failure_reason = 'Vault not found',
               updated_at = now();
        return null;
    end if;

    if v_sub.currency = v_vault_cur then
        v_base_n := v_base;
        v_fee_n  := v_fee;
        v_rate   := null;
    else
        v_rate := public.nomadix_usd_eur_rate(v_sub.user_id);
        if v_sub.currency = 'USD' then
            v_base_n := round(v_base * v_rate, 2);
            v_fee_n  := round(v_fee  * v_rate, 2);
        else
            v_base_n := round(v_base / v_rate, 2);
            v_fee_n  := round(v_fee  / v_rate, 2);
        end if;
    end if;

    v_signed := case when v_sub.direction = 'expense'
                     then -(v_base_n + v_fee_n)
                     else  (v_base_n - v_fee_n)
                end;

    insert into public.transactions
        (user_id, vault_id, amount, type, original_currency,
         exchange_rate_at_time, category, description, date, status, fee)
    values
        (v_sub.user_id, v_sub.vault_id, v_signed,
         case when v_sub.direction = 'expense' then 'expense' else 'income' end,
         v_vault_cur, v_rate, v_sub.category,
         v_sub.name || case when v_is_trial then ' (trial)' else '' end,
         p_due_date, 'completed', v_fee_n)
    returning id into v_tx_id;

    insert into public.subscription_occurrences
        (subscription_id, user_id, due_date, status, expected_amount,
         actual_amount, fee_amount, currency, exchange_rate_at_time,
         transaction_id, charged_at, is_trial, notes)
    values
        (v_sub.id, v_sub.user_id, p_due_date, 'charged',
         case when v_is_trial then v_sub.trial_amount else v_sub.amount end,
         v_base, v_fee, v_sub.currency, v_rate,
         v_tx_id, now(), v_is_trial, p_note)
    on conflict (subscription_id, due_date) do update
        set status                = 'charged',
            actual_amount         = excluded.actual_amount,
            fee_amount            = excluded.fee_amount,
            exchange_rate_at_time = excluded.exchange_rate_at_time,
            transaction_id        = excluded.transaction_id,
            charged_at            = now(),
            failure_reason        = null,
            notes                 = coalesce(excluded.notes,
                                    public.subscription_occurrences.notes),
            updated_at            = now()
        where public.subscription_occurrences.status in ('pending','failed');

    v_next := public.nomadix_next_due_date(
        p_due_date, v_sub.billing_cycle, v_sub.interval_count,
        v_sub.custom_interval_days, v_sub.anchor_day
    );

    update public.subscriptions
       set last_charged_date = greatest(coalesce(last_charged_date, p_due_date), p_due_date),
           next_due_date     = v_next,
           status            = case when end_date is not null and v_next > end_date
                                    then 'ended' else status end,
           updated_at        = now()
     where id = v_sub.id
       and next_due_date <= p_due_date;

    return v_tx_id;
end $$;

revoke all on function public.nomadix_charge_occurrence(uuid, date, numeric, text)
    from public, anon;
grant execute on function public.nomadix_charge_occurrence(uuid, date, numeric, text)
    to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_process_subscription: catch-up loop for one rule, up to p_through.
-- Manual-confirm / variable-amount rules still advance next_due_date after
-- materializing a pending occurrence, or the schedule would stall forever.
-- p_max_iterations bounds a pathological case (e.g. a daily rule started
-- years ago) to one run; the next run finishes the rest.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_process_subscription(
    p_subscription_id uuid,
    p_through         date default current_date,
    p_max_iterations  integer default 120
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sub   public.subscriptions%rowtype;
    v_count integer := 0;
    v_i     integer := 0;
    v_due   date;
    v_next  date;
begin
    select * into v_sub from public.subscriptions
     where id = p_subscription_id for update;
    if not found then return 0; end if;

    if auth.uid() is not null and auth.uid() <> v_sub.user_id then
        raise exception 'Not authorized' using errcode = 'insufficient_privilege';
    end if;

    while v_i < p_max_iterations loop
        v_i := v_i + 1;

        select * into v_sub from public.subscriptions where id = p_subscription_id;
        exit when v_sub.status <> 'active';
        exit when v_sub.next_due_date > p_through;
        exit when v_sub.end_date is not null and v_sub.next_due_date > v_sub.end_date;

        v_due := v_sub.next_due_date;

        if v_sub.auto_charge and not v_sub.is_variable_amount then
            perform public.nomadix_charge_occurrence(p_subscription_id, v_due);
        else
            insert into public.subscription_occurrences
                (subscription_id, user_id, due_date, status,
                 expected_amount, currency, is_trial)
            values (v_sub.id, v_sub.user_id, v_due, 'pending',
                    case when v_sub.trial_end_date is not null
                              and v_due <= v_sub.trial_end_date
                         then v_sub.trial_amount else v_sub.amount end,
                    v_sub.currency,
                    v_sub.trial_end_date is not null and v_due <= v_sub.trial_end_date)
            on conflict (subscription_id, due_date) do nothing;

            v_next := public.nomadix_next_due_date(
                v_due, v_sub.billing_cycle, v_sub.interval_count,
                v_sub.custom_interval_days, v_sub.anchor_day);

            update public.subscriptions
               set next_due_date = v_next,
                   status = case when end_date is not null and v_next > end_date
                                 then 'ended' else status end,
                   updated_at = now()
             where id = p_subscription_id and next_due_date <= v_due;
        end if;

        v_count := v_count + 1;

        exit when (select next_due_date from public.subscriptions
                    where id = p_subscription_id) <= v_due;
    end loop;

    return v_count;
end $$;

revoke all on function public.nomadix_process_subscription(uuid, date, integer)
    from public, anon;
grant execute on function public.nomadix_process_subscription(uuid, date, integer)
    to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_run_due_subscriptions: single entry point for BOTH callers.
--   - pg_cron runs as `postgres`: no JWT -> auth.uid() is null, session_user
--     is not one of PostgREST's roles -> p_user_id is honored (null = all
--     users).
--   - Client via supabase.rpc(): PostgREST sets the JWT GUC, auth.uid() is
--     the caller -> v_target is FORCED to auth.uid() and p_user_id is
--     silently ignored. A malicious { p_user_id: <someone else> } does
--     nothing.
--   - Anon key with no session: auth.uid() is null AND session_user is
--     'anon'/'authenticated'/'authenticator' -> hard exception.
-- One bad rule must not abort the whole run: each iteration is wrapped in
-- its own exception handler (a PL/pgSQL subtransaction), so a failure rolls
-- back only that subscription's work.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_run_due_subscriptions(
    p_user_id uuid default null,
    p_through date default current_date
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_caller uuid := auth.uid();
    v_target uuid;
    v_row    record;
    v_total  integer := 0;
begin
    if v_caller is not null then
        v_target := v_caller;
    else
        if session_user in ('authenticator', 'anon', 'authenticated') then
            raise exception 'Not authenticated'
                using errcode = 'insufficient_privilege';
        end if;
        v_target := p_user_id;
    end if;

    for v_row in
        select id from public.subscriptions
         where status = 'active'
           and next_due_date <= p_through
           and (v_target is null or user_id = v_target)
         order by next_due_date asc
    loop
        begin
            v_total := v_total
                     + public.nomadix_process_subscription(v_row.id, p_through);
        exception when others then
            raise warning 'subscription % failed: %', v_row.id, sqlerrm;
        end;
    end loop;

    return v_total;
end $$;

revoke all on function public.nomadix_run_due_subscriptions(uuid, date) from public, anon;
grant execute on function public.nomadix_run_due_subscriptions(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_skip_occurrence: user-only (never called by cron). Marks one
-- occurrence skipped and advances the schedule past it.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_skip_occurrence(
    p_subscription_id uuid,
    p_due_date        date,
    p_note            text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_sub  public.subscriptions%rowtype;
    v_next date;
begin
    select * into v_sub from public.subscriptions
     where id = p_subscription_id for update;
    if not found then raise exception 'Subscription not found'; end if;
    if auth.uid() is null or auth.uid() <> v_sub.user_id then
        raise exception 'Not authorized' using errcode = 'insufficient_privilege';
    end if;

    insert into public.subscription_occurrences
        (subscription_id, user_id, due_date, status, expected_amount,
         currency, notes)
    values (v_sub.id, v_sub.user_id, p_due_date, 'skipped',
            v_sub.amount, v_sub.currency, p_note)
    on conflict (subscription_id, due_date) do update
        set status = 'skipped',
            notes  = coalesce(excluded.notes, public.subscription_occurrences.notes),
            updated_at = now()
        where public.subscription_occurrences.status in ('pending','failed');

    v_next := public.nomadix_next_due_date(
        p_due_date, v_sub.billing_cycle, v_sub.interval_count,
        v_sub.custom_interval_days, v_sub.anchor_day);

    update public.subscriptions
       set next_due_date = v_next, updated_at = now()
     where id = v_sub.id and next_due_date <= p_due_date;
end $$;

revoke all on function public.nomadix_skip_occurrence(uuid, date, text) from public, anon;
grant execute on function public.nomadix_skip_occurrence(uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- subscription_price_changes: auto-log on amount change (Phase 5, cheap now)
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_log_subscription_price_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.amount is distinct from old.amount then
        insert into public.subscription_price_changes
            (subscription_id, user_id, old_amount, new_amount, currency, source)
        values (new.id, new.user_id, old.amount, new.amount, new.currency, 'manual');
    end if;
    return new;
end $$;

drop trigger if exists subscriptions_price_change_trg on public.subscriptions;
create trigger subscriptions_price_change_trg
    after update of amount on public.subscriptions
    for each row execute function public.nomadix_log_subscription_price_change();

-- ---------------------------------------------------------------------------
-- pg_cron: daily driver, 03:10 UTC (re-runnable: unschedule swallowed first)
-- Requires the pg_cron extension enabled (Database -> Extensions -> pg_cron,
-- or the CREATE EXTENSION statement below run as `postgres`).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema cron;

do $$
begin
    perform cron.unschedule('nomadix-subscriptions-daily');
exception when others then null;
end $$;

select cron.schedule(
    'nomadix-subscriptions-daily',
    '10 3 * * *',
    $$select public.nomadix_run_due_subscriptions();$$
);

-- ============================================================================
-- AI: OpenAI API key storage (Supabase Vault) + report support
-- ----------------------------------------------------------------------------
-- The raw key is never stored in a plain column and never returned to the
-- client after being saved. `public.user_openai_key` only holds a pointer
-- (secret_id) into vault.secrets plus a last4 for display. All writes go
-- through the SECURITY DEFINER RPCs below -- there is deliberately no
-- insert/update RLS policy on the table, so a client cannot repoint
-- secret_id at an arbitrary (possibly another user's) vault secret.
-- nomadix_get_openai_api_key() must only ever be called server-side (a
-- Route Handler / Server Action) -- never from client-side JS -- or the
-- decrypted key would reach the browser.
-- ============================================================================

create table if not exists public.user_openai_key (
    user_id uuid primary key references auth.users(id) on delete cascade,
    secret_id uuid not null,
    key_last4 text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.user_openai_key enable row level security;

do $$
begin
    begin
        create policy "user_openai_key_select_own" on public.user_openai_key
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
end $$;

drop trigger if exists user_openai_key_touch_trg on public.user_openai_key;
create trigger user_openai_key_touch_trg
    before update on public.user_openai_key
    for each row execute function public.nomadix_touch_updated_at();

create or replace function public.nomadix_set_openai_api_key(p_key text)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
    v_uid      uuid := auth.uid();
    v_existing uuid;
    v_new      uuid;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;
    if p_key is null or length(trim(p_key)) < 10 then
        raise exception 'Invalid API key' using errcode = 'invalid_parameter_value';
    end if;

    select secret_id into v_existing from public.user_openai_key where user_id = v_uid;

    if v_existing is not null then
        perform vault.update_secret(v_existing, p_key);
        update public.user_openai_key
           set key_last4 = right(p_key, 4), updated_at = now()
         where user_id = v_uid;
    else
        v_new := vault.create_secret(p_key, 'openai_key_' || v_uid::text, 'Nomadix OpenAI API key');
        insert into public.user_openai_key (user_id, secret_id, key_last4)
        values (v_uid, v_new, right(p_key, 4));
    end if;
end $$;

revoke all on function public.nomadix_set_openai_api_key(text) from public, anon;
grant execute on function public.nomadix_set_openai_api_key(text) to authenticated;

create or replace function public.nomadix_get_openai_api_key()
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_key text;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;

    select vs.decrypted_secret into v_key
      from public.user_openai_key k
      join vault.decrypted_secrets vs on vs.id = k.secret_id
     where k.user_id = v_uid;

    return v_key;
end $$;

revoke all on function public.nomadix_get_openai_api_key() from public, anon;
grant execute on function public.nomadix_get_openai_api_key() to authenticated;

create or replace function public.nomadix_delete_openai_api_key()
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
    v_uid    uuid := auth.uid();
    v_secret uuid;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;

    select secret_id into v_secret from public.user_openai_key where user_id = v_uid;
    if v_secret is not null then
        delete from vault.secrets where id = v_secret;
        delete from public.user_openai_key where user_id = v_uid;
    end if;
end $$;

revoke all on function public.nomadix_delete_openai_api_key() from public, anon;
grant execute on function public.nomadix_delete_openai_api_key() to authenticated;

-- ============================================================================
-- MANUAL VERIFICATION (run once after applying, keep for future reference)
-- ============================================================================
--
-- 1) Recurrence parity -- must return 0 rows:
-- select * from (values
--   ('2026-01-31'::date,'monthly',1,null,31::smallint,'2026-02-28'::date),
--   ('2026-02-28','monthly',1,null,31,'2026-03-31'),
--   ('2028-01-31','monthly',1,null,31,'2028-02-29'),
--   ('2026-11-30','quarterly',1,null,30,'2027-02-28'),
--   ('2026-01-01','custom_days',1,45,null,'2026-02-15'),
--   ('2026-12-15','monthly',1,null,15,'2027-01-15')
-- ) as t(f, c, n, cd, ad, expected)
-- cross join lateral (select public.nomadix_next_due_date(f,c,n,cd,ad) as got) g
-- where g.got is distinct from t.expected;
--
-- 2) Idempotency -- call twice, expect 1 transaction + same returned uuid:
-- select public.nomadix_charge_occurrence('<sub-id>'::uuid, '2026-03-01'::date);
-- select public.nomadix_charge_occurrence('<sub-id>'::uuid, '2026-03-01'::date);
--
-- 3) Catch-up -- insert a monthly rule with start_date = current_date - 100,
--    next_due_date = start_date, then:
-- select public.nomadix_run_due_subscriptions();
--
-- 4) Cron health, after 24h:
-- select * from cron.job_run_details
--  where jobname = 'nomadix-subscriptions-daily'
--  order by start_time desc limit 20;
--
-- 5) OpenAI key round-trip -- run as the authenticated user (not postgres):
-- select public.nomadix_set_openai_api_key('sk-test-0000000000000000');
-- select key_last4 from public.user_openai_key; -- expect '0000'
-- select public.nomadix_get_openai_api_key();    -- expect the same key back
-- select public.nomadix_delete_openai_api_key();
-- select count(*) from public.user_openai_key;    -- expect 0
-- ============================================================================
