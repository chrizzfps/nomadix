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

-- Migration: introduce the "adjustment" transaction type.
-- Manual vault balance corrections were previously stored as "income"/"expense",
-- which made them count as real spending in every monthly report. Backfill the
-- existing ones to the new type, then (re)pin an explicit allow-list so a typo
-- in `type` fails fast instead of silently breaking reports again.
do $$
begin
    if to_regclass('public.transactions') is not null then
        -- Drop first: a pre-existing check constraint on `type` (created
        -- outside this file, back when the table was first set up) does not
        -- allow 'adjustment' yet, and would reject the backfill below.
        alter table public.transactions
        drop constraint if exists transactions_type_check;

        update public.transactions
        set type = 'adjustment'
        where type in ('income', 'expense')
          and category = 'Adjustment'
          and description = 'Balance adjustment';

        alter table public.transactions
        add constraint transactions_type_check
        check (type in ('income', 'expense', 'transfer', 'adjustment'));
    end if;

    -- Any cached AI report for a month that contains an adjustment was
    -- generated with the old (inflated) numbers — drop it so the next visit
    -- to /dashboard/reports regenerates it with the corrected totals instead
    -- of silently serving the stale cache.
    if to_regclass('public.ai_monthly_reports') is not null
       and to_regclass('public.transactions') is not null then
        delete from public.ai_monthly_reports r
        using public.transactions t
        where t.user_id = r.user_id
          and t.type = 'adjustment'
          and left(t.date::text, 7) = r.month;
    end if;
end $$;


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
-- AI: multi-provider API key storage (Supabase Vault) + report support
-- ----------------------------------------------------------------------------
-- The raw key is never stored in a plain column and never returned to the
-- client after being saved. `public.user_ai_keys` only holds a pointer
-- (secret_id) into vault.secrets plus a last4 for display, keyed by
-- (user_id, provider) so a user can hold one key per provider (openai,
-- gemini, ...). All writes go through the SECURITY DEFINER RPCs below --
-- there is deliberately no insert/update RLS policy on the table, so a
-- client cannot repoint secret_id at an arbitrary (possibly another user's)
-- vault secret. nomadix_get_ai_api_key() must only ever be called
-- server-side (a Route Handler / Server Action) -- never from client-side
-- JS -- or the decrypted key would reach the browser.
-- ============================================================================

create table if not exists public.user_ai_keys (
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null check (provider in ('openai', 'gemini')),
    secret_id uuid not null,
    key_last4 text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, provider)
);

alter table public.user_ai_keys enable row level security;

do $$
begin
    begin
        create policy "user_ai_keys_select_own" on public.user_ai_keys
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
end $$;

drop trigger if exists user_ai_keys_touch_trg on public.user_ai_keys;
create trigger user_ai_keys_touch_trg
    before update on public.user_ai_keys
    for each row execute function public.nomadix_touch_updated_at();

-- One-time forward migration from the OpenAI-only table this replaces.
-- The vault secret itself is untouched -- only the pointer row moves -- so
-- keys saved before this migration keep working with no re-entry needed.
insert into public.user_ai_keys (user_id, provider, secret_id, key_last4, created_at, updated_at)
select user_id, 'openai', secret_id, key_last4, created_at, updated_at
  from public.user_openai_key
on conflict (user_id, provider) do nothing;

create or replace function public.nomadix_set_ai_api_key(p_provider text, p_key text)
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
    if p_provider not in ('openai', 'gemini') then
        raise exception 'Unknown provider' using errcode = 'invalid_parameter_value';
    end if;
    if p_key is null or length(trim(p_key)) < 10 then
        raise exception 'Invalid API key' using errcode = 'invalid_parameter_value';
    end if;

    select secret_id into v_existing from public.user_ai_keys
     where user_id = v_uid and provider = p_provider;

    if v_existing is not null then
        perform vault.update_secret(v_existing, p_key);
        update public.user_ai_keys
           set key_last4 = right(p_key, 4), updated_at = now()
         where user_id = v_uid and provider = p_provider;
    else
        v_new := vault.create_secret(
            p_key, p_provider || '_key_' || v_uid::text, 'Nomadix ' || p_provider || ' API key'
        );
        insert into public.user_ai_keys (user_id, provider, secret_id, key_last4)
        values (v_uid, p_provider, v_new, right(p_key, 4));
    end if;
end $$;

revoke all on function public.nomadix_set_ai_api_key(text, text) from public, anon;
grant execute on function public.nomadix_set_ai_api_key(text, text) to authenticated;

create or replace function public.nomadix_get_ai_api_key(p_provider text)
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
      from public.user_ai_keys k
      join vault.decrypted_secrets vs on vs.id = k.secret_id
     where k.user_id = v_uid and k.provider = p_provider;

    return v_key;
end $$;

revoke all on function public.nomadix_get_ai_api_key(text) from public, anon;
grant execute on function public.nomadix_get_ai_api_key(text) to authenticated;

create or replace function public.nomadix_delete_ai_api_key(p_provider text)
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

    select secret_id into v_secret from public.user_ai_keys
     where user_id = v_uid and provider = p_provider;
    if v_secret is not null then
        delete from vault.secrets where id = v_secret;
        delete from public.user_ai_keys where user_id = v_uid and provider = p_provider;
    end if;
end $$;

revoke all on function public.nomadix_delete_ai_api_key(text) from public, anon;
grant execute on function public.nomadix_delete_ai_api_key(text) to authenticated;

-- Retired now that the generalized (provider, key) versions above exist.
drop function if exists public.nomadix_set_openai_api_key(text);
drop function if exists public.nomadix_get_openai_api_key();
drop function if exists public.nomadix_delete_openai_api_key();
drop table if exists public.user_openai_key;

-- Which provider/model the report generator uses by default.
alter table public.users_profile
    add column if not exists preferred_ai_provider text not null default 'openai'
        check (preferred_ai_provider in ('openai', 'gemini')),
    add column if not exists preferred_ai_model text not null default 'gpt-4.1-mini';

-- ---------------------------------------------------------------------------
-- ai_monthly_reports: persisted report cache, one row per (user, month,
-- language). `context` is the exact aggregated numbers that were narrated --
-- kept alongside `narrative` so a re-visit renders instantly with no API
-- call, and stays internally consistent even if new transactions land later.
-- Regular data, not a secret -- plain owner RLS, no vault involved.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_monthly_reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    month text not null,
    language text not null default 'en' check (language in ('en', 'es')),
    provider text not null,
    model text not null,
    context jsonb not null,
    narrative text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, month, language)
);

create index if not exists ai_monthly_reports_user_month_idx
    on public.ai_monthly_reports (user_id, month);

alter table public.ai_monthly_reports enable row level security;

do $$
begin
    begin
        create policy "ai_monthly_reports_select_own" on public.ai_monthly_reports
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "ai_monthly_reports_insert_own" on public.ai_monthly_reports
        for insert with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "ai_monthly_reports_update_own" on public.ai_monthly_reports
        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "ai_monthly_reports_delete_own" on public.ai_monthly_reports
        for delete using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
end $$;

drop trigger if exists ai_monthly_reports_touch_trg on public.ai_monthly_reports;
create trigger ai_monthly_reports_touch_trg
    before update on public.ai_monthly_reports
    for each row execute function public.nomadix_touch_updated_at();

-- ---------------------------------------------------------------------------
-- support_tickets: real backing for Settings -> Support. The form used to be
-- a fake setTimeout with no persistence -- this makes it a real row the user
-- (or, later, a staff view) can read back.
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category text not null,
    priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High')),
    subject text not null,
    message text not null,
    status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
    on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

do $$
begin
    begin
        create policy "support_tickets_select_own" on public.support_tickets
        for select using (auth.uid() = user_id);
    exception when duplicate_object then null; end;
    begin
        create policy "support_tickets_insert_own" on public.support_tickets
        for insert with check (auth.uid() = user_id);
    exception when duplicate_object then null; end;
end $$;

drop trigger if exists support_tickets_touch_trg on public.support_tickets;
create trigger support_tickets_touch_trg
    before update on public.support_tickets
    for each row execute function public.nomadix_touch_updated_at();

-- ============================================================================
-- CATEGORIES: deletable, with a protected fallback for orphaned data.
-- ----------------------------------------------------------------------------
-- transactions.category and subscriptions.category are free text (matched by
-- NAME, not a foreign key -- see comment on subscriptions.category above), so
-- deleting a transaction_categories row does not cascade anywhere on its own.
-- The app now reassigns those text values to a replacement category before
-- deleting the row; is_system marks the built-in "Uncategorized" category
-- (seeded per user below) as the non-deletable default target.
-- ============================================================================
alter table public.transaction_categories
    add column if not exists is_system boolean not null default false;

do $$
begin
    if to_regclass('public.transaction_categories') is not null then
        -- Backfill "Uncategorized" for every user who already has categories,
        -- so existing accounts get a fallback target without revisiting the
        -- seeding path in src/app/dashboard/settings/categories/page.tsx.
        insert into public.transaction_categories
            (user_id, key, name, description, icon_key, color, is_active, is_system)
        select distinct user_id, 'uncategorized', 'Uncategorized',
               'Fallback for transactions whose category was deleted.',
               'bag', '#71717a', true, true
          from public.transaction_categories
        on conflict (user_id, key) do update set is_system = true;

        -- One-time cleanup of the pre-existing "Tech"/"Technology" duplicate.
        -- This is plain text matching (not joined through category rows):
        -- most existing transactions/subscriptions picked up "Tech" from the
        -- hardcoded fallback list in new-transaction-modal.tsx before the
        -- user ever had a transaction_categories row at all.
        update public.transactions
           set category = 'Technology'
         where category = 'Tech';

        if to_regclass('public.subscriptions') is not null then
            update public.subscriptions
               set category = 'Technology'
             where category = 'Tech';
        end if;

        -- Drop any leftover "tech" category row per user in favor of "technology".
        delete from public.transaction_categories tech
        using public.transaction_categories techn
        where tech.key = 'tech'
          and techn.user_id = tech.user_id
          and techn.key = 'technology';
    end if;
end $$;

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
-- 5) AI key round-trip -- run as the authenticated user (not postgres):
-- select public.nomadix_set_ai_api_key('gemini', 'test-0000000000000000');
-- select key_last4 from public.user_ai_keys where provider = 'gemini'; -- expect '0000'
-- select public.nomadix_get_ai_api_key('gemini');    -- expect the same key back
-- select public.nomadix_delete_ai_api_key('gemini');
-- select count(*) from public.user_ai_keys where provider = 'gemini'; -- expect 0
-- ============================================================================

-- ============================================================================
-- SOCIAL LAYER -- PHASE 1: IDENTITY + FRIENDS
-- ----------------------------------------------------------------------------
-- Full design rationale: docs/social-layer-sql-design.md
--
-- Adds a public handle (username) and a shareable friend code to
-- users_profile, and a bidirectional friendships table. Touches NEITHER
-- vaults NOR transactions -- this phase carries zero risk to money data.
--
-- Re-runnable: every statement is idempotent.
-- After applying: Supabase -> Settings -> API -> Reload schema
--                 (or: notify pgrst, 'reload schema';)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users_profile: username + friend code
-- (users_profile itself is dashboard-owned; only ALTERs live here.)
-- ---------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.users_profile') is null then
        raise notice 'users_profile missing; skipping social identity columns';
        return;
    end if;

    alter table public.users_profile
        add column if not exists username text,
        add column if not exists friend_code text,
        add column if not exists username_changed_at timestamptz,
        add column if not exists discoverable boolean not null default true;

    begin
        alter table public.users_profile
            add constraint users_profile_username_format
            check (username is null or username ~ '^[a-z0-9_]{3,20}$');
    exception when duplicate_object then null; end;

    begin
        alter table public.users_profile
            add constraint users_profile_friend_code_format
            check (friend_code is null or friend_code ~ '^NMDX-[0-9A-HJ-NP-Z]{4}$');
    exception when duplicate_object then null; end;
end $$;

-- Unique indexes, not table constraints: NULLs are ignored, so users who
-- have not picked a handle yet coexist. The CHECK above already forces
-- lowercase, so a plain unique index is case-insensitive in practice.
create unique index if not exists users_profile_username_uidx
    on public.users_profile (username) where username is not null;
create unique index if not exists users_profile_friend_code_uidx
    on public.users_profile (friend_code) where friend_code is not null;

-- ---------------------------------------------------------------------------
-- nomadix_new_friend_code: draws an unused NMDX-XXXX code. Alphabet
-- excludes I, O, 0, 1 so a code can never be misread aloud.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_new_friend_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
    v_alpha text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- 32 symbols
    v_code  text;
    v_i     integer;
    v_try   integer := 0;
begin
    loop
        v_try := v_try + 1;
        v_code := 'NMDX-';
        for v_i in 1..4 loop
            v_code := v_code || substr(v_alpha, 1 + floor(random() * 32)::int, 1);
        end loop;
        exit when not exists (
            select 1 from public.users_profile where friend_code = v_code
        );
        if v_try > 50 then
            raise exception 'Could not allocate a friend code'
                using errcode = 'too_many_rows';
        end if;
    end loop;
    return v_code;
end $$;

revoke all on function public.nomadix_new_friend_code() from public, anon;
grant execute on function public.nomadix_new_friend_code() to authenticated;

-- Backfill: every existing profile gets a code. Row-by-row because each
-- draw must see the codes issued by the previous iterations.
do $$
declare r record;
begin
    if to_regclass('public.users_profile') is null then return; end if;
    for r in select id from public.users_profile where friend_code is null loop
        update public.users_profile
           set friend_code = public.nomadix_new_friend_code()
         where id = r.id;
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- friendships: one row per PAIR, not per request. user_low_id < user_high_id
-- is the canonical ordering that makes "are these two friends?" a single
-- index probe and makes a crossed request (A->B while B->A is in flight)
-- resolve to one row instead of two.
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
    id uuid primary key default gen_random_uuid(),

    user_low_id  uuid not null references auth.users(id) on delete cascade,
    user_high_id uuid not null references auth.users(id) on delete cascade,

    requested_by uuid not null references auth.users(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending','accepted','declined','blocked')),
    blocked_by uuid references auth.users(id) on delete set null,

    note text,
    responded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint friendships_ordered_pair
        check (user_low_id < user_high_id),
    constraint friendships_requester_in_pair
        check (requested_by in (user_low_id, user_high_id)),
    constraint friendships_blocker_in_pair
        check (blocked_by is null or blocked_by in (user_low_id, user_high_id)),
    constraint friendships_blocked_consistency
        check ((status = 'blocked') = (blocked_by is not null)),

    unique (user_low_id, user_high_id)
);

create index if not exists friendships_low_idx
    on public.friendships (user_low_id, status);
create index if not exists friendships_high_idx
    on public.friendships (user_high_id, status);

alter table public.friendships enable row level security;

do $$
begin
    -- Readable by both parties, EXCEPT a block is invisible to the blocked
    -- party -- they see "no relationship", never "you are blocked".
    -- No write policies: every mutation goes through the RPCs below.
    begin
        create policy "friendships_select_party" on public.friendships
        for select to authenticated
        using (auth.uid() in (user_low_id, user_high_id)
               and (status <> 'blocked' or blocked_by = auth.uid()));
    exception when duplicate_object then null; end;
end $$;

drop trigger if exists friendships_touch_trg on public.friendships;
create trigger friendships_touch_trg
    before update on public.friendships
    for each row execute function public.nomadix_touch_updated_at();

-- ---------------------------------------------------------------------------
-- nomadix_are_friends: reads public.friendships. SECURITY DEFINER so it
-- works regardless of the friendships SELECT policy, which deliberately
-- hides blocked rows from the blocked party -- an invoker-rights read would
-- then report "not friends" inconsistently depending on who is asking.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select a is not null and b is not null and a <> b
       and exists (
           select 1 from public.friendships f
            where f.user_low_id  = case when a < b then a else b end
              and f.user_high_id = case when a < b then b else a end
              and f.status = 'accepted'
       );
$$;

revoke all on function public.nomadix_are_friends(uuid, uuid) from public, anon;
grant execute on function public.nomadix_are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_set_username: lowercases + trims, re-validates the format, blocks
-- a short reserved list, and enforces a 30-day cooldown so a handle cannot
-- be recycled to impersonate someone right after they change it.
-- Idempotent: re-setting your own current username is a no-op success.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid  uuid := auth.uid();
    v_norm text := lower(trim(coalesce(p_username, '')));
    v_current text;
    v_changed_at timestamptz;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;

    if v_norm !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Username must be 3-20 characters: letters, numbers, underscore'
            using errcode = 'invalid_parameter_value';
    end if;

    if v_norm = any (array['admin','nomadix','support','api','me','settings',
                            'root','system','null','undefined','friends']) then
        raise exception 'That username is reserved'
            using errcode = 'invalid_parameter_value';
    end if;

    select username, username_changed_at into v_current, v_changed_at
      from public.users_profile where id = v_uid;

    if v_current = v_norm then
        return v_norm;  -- idempotent no-op
    end if;

    if v_changed_at is not null and v_changed_at > now() - interval '30 days' then
        raise exception 'You can change your username again in % days',
            ceil(extract(epoch from (v_changed_at + interval '30 days' - now())) / 86400)
            using errcode = 'too_many_rows';
    end if;

    begin
        update public.users_profile
           set username = v_norm, username_changed_at = now(), updated_at = now()
         where id = v_uid;
    exception when unique_violation then
        raise exception 'Username already taken' using errcode = '23505';
    end;

    return v_norm;
end $$;

revoke all on function public.nomadix_set_username(text) from public, anon;
grant execute on function public.nomadix_set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_regenerate_friend_code: rotates the caller's code. Deliberately
-- NOT idempotent (every call issues a fresh code) -- that is the correct
-- behaviour for "my code leaked, give me a new one". The unique index is
-- the only safety net needed.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_regenerate_friend_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid  uuid := auth.uid();
    v_code text;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;

    v_code := public.nomadix_new_friend_code();

    update public.users_profile
       set friend_code = v_code, updated_at = now()
     where id = v_uid;

    return v_code;
end $$;

revoke all on function public.nomadix_regenerate_friend_code() from public, anon;
grant execute on function public.nomadix_regenerate_friend_code() to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_find_user: the ONLY user search surface. Friend code is exact
-- match only (a prefix search would let someone walk the code space);
-- username is exact or a >=3-char prefix. auth.users.email is never
-- referenced anywhere in this function or in this design.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_find_user(p_query text)
returns table (
    user_id uuid,
    username text,
    full_name text,
    avatar_url text,
    friendship_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with q as (select nullif(trim(lower(p_query)), '') as t)
    select p.id, p.username, p.full_name, p.avatar_url,
           coalesce(f.status, 'none')
      from public.users_profile p
      cross join q
      left join public.friendships f
             on f.user_low_id  = case when p.id < auth.uid() then p.id else auth.uid() end
            and f.user_high_id = case when p.id < auth.uid() then auth.uid() else p.id end
     where auth.uid() is not null
       and q.t is not null
       and p.id <> auth.uid()
       and p.discoverable
       and (
            upper(p.friend_code) = upper(q.t)
         or p.username = q.t
         or (length(q.t) >= 3 and p.username like q.t || '%')
       )
       -- Never surface someone who blocked me.
       and coalesce(f.blocked_by, '00000000-0000-0000-0000-000000000000'::uuid) <> p.id
     limit 5;
$$;

revoke all on function public.nomadix_find_user(text) from public, anon;
grant execute on function public.nomadix_find_user(text) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_list_friends: the narrow profile projection for the Friends
-- screen. A plain RLS policy on users_profile would leak emergency_contact,
-- timezone, social_links, base_currency and the AI provider prefs to every
-- friend -- this function is the allowlist instead.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_list_friends()
returns table (
    friendship_id uuid,
    friend_id uuid,
    username text,
    full_name text,
    avatar_url text,
    status text,
    direction text,
    since timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select f.id,
           case when f.user_low_id = auth.uid() then f.user_high_id else f.user_low_id end,
           p.username, p.full_name, p.avatar_url, f.status,
           case
               when f.status = 'accepted' then 'mutual'
               when f.requested_by = auth.uid() then 'outgoing'
               else 'incoming'
           end,
           coalesce(f.responded_at, f.created_at)
      from public.friendships f
      join public.users_profile p
        on p.id = case when f.user_low_id = auth.uid() then f.user_high_id else f.user_low_id end
     where auth.uid() is not null
       and auth.uid() in (f.user_low_id, f.user_high_id)
       and (f.status <> 'blocked' or f.blocked_by = auth.uid())
     order by
       case f.status when 'pending' then 0 else 1 end,
       coalesce(f.responded_at, f.created_at) desc;
$$;

revoke all on function public.nomadix_list_friends() from public, anon;
grant execute on function public.nomadix_list_friends() to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_send_friend_request: idempotent via the ordered-pair unique key.
-- A crossed request (B already asked A while A asks B) auto-accepts instead
-- of creating a second pending row.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_send_friend_request(
    p_target_user_id uuid,
    p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid  uuid := auth.uid();
    v_low  uuid;
    v_high uuid;
    v_id   uuid;
    v_target_ok boolean;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;
    if p_target_user_id is null or p_target_user_id = v_uid then
        raise exception 'Cannot send request' using errcode = 'invalid_parameter_value';
    end if;

    -- Uniform denial: missing, non-discoverable and blocking users all
    -- raise the identical message -- this must never be an existence oracle.
    select exists (
        select 1 from public.users_profile p where p.id = p_target_user_id and p.discoverable
    ) into v_target_ok;
    if not v_target_ok then
        raise exception 'Cannot send request' using errcode = 'insufficient_privilege';
    end if;

    v_low  := least(v_uid, p_target_user_id);
    v_high := greatest(v_uid, p_target_user_id);

    insert into public.friendships (user_low_id, user_high_id, requested_by, status, note)
    values (v_low, v_high, v_uid, 'pending', nullif(trim(p_note), ''))
    on conflict (user_low_id, user_high_id) do update
       set status = case
               -- Crossed request: the other person already asked me ->
               -- my "request" is really an accept.
               when public.friendships.status = 'pending'
                    and public.friendships.requested_by <> v_uid
                    then 'accepted'
               -- They had declined or blocked-then-unblocked me before ->
               -- a fresh ask from me reopens it as pending, from me.
               when public.friendships.status = 'declined' then 'pending'
               else public.friendships.status
           end,
           requested_by = case
               when public.friendships.status = 'declined' then v_uid
               else public.friendships.requested_by
           end,
           responded_at = case
               when public.friendships.status = 'pending'
                    and public.friendships.requested_by <> v_uid
                    then now()
               else public.friendships.responded_at
           end,
           updated_at = now()
     where public.friendships.status not in ('blocked')
    returning id into v_id;

    if v_id is null then
        -- The row exists and is 'blocked' -- the WHERE guard above skipped
        -- the update, so RETURNING produced nothing. Raise the SAME denial
        -- as a non-existent or non-discoverable target: silently handing
        -- back the blocked row's id here would leak "you are blocked" to
        -- the requester, which is exactly the oracle this design forbids.
        raise exception 'Cannot send request' using errcode = 'insufficient_privilege';
    end if;

    return v_id;
end $$;

revoke all on function public.nomadix_send_friend_request(uuid, text) from public, anon;
grant execute on function public.nomadix_send_friend_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_respond_friend_request: accept/decline/block/unblock/remove.
-- remove and block refuse when the net balance with that friend is
-- non-zero, unless p_force is true, in which case every active share in
-- the pair is voided in the same transaction -- a pair can never be
-- dissolved leaving a dangling debt.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_respond_friend_request(
    p_friendship_id uuid,
    p_action text,
    p_force boolean default false
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_row public.friendships%rowtype;
    v_other uuid;
    v_net numeric := 0;
    v_shared_live boolean := false;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;
    if p_action not in ('accept','decline','block','unblock','remove') then
        raise exception 'Unknown action' using errcode = 'invalid_parameter_value';
    end if;

    select * into v_row from public.friendships where id = p_friendship_id for update;
    if not found or v_uid not in (v_row.user_low_id, v_row.user_high_id) then
        raise exception 'Friend request not found' using errcode = 'no_data_found';
    end if;
    v_other := case when v_row.user_low_id = v_uid then v_row.user_high_id else v_row.user_low_id end;

    if p_action = 'accept' then
        -- Only the non-requester can accept -- you cannot accept your own
        -- outgoing request.
        if v_row.status <> 'pending' or v_row.requested_by = v_uid then
            return; -- idempotent no-op: nothing pending for me to accept
        end if;
        update public.friendships
           set status = 'accepted', responded_at = now(), updated_at = now()
         where id = p_friendship_id;
        return;
    end if;

    if p_action = 'decline' then
        -- Either party may decline a pending request: the recipient
        -- rejecting it, or the requester cancelling their own. Both end
        -- the same way, so no requested_by check is needed here.
        if v_row.status <> 'pending' then
            return; -- idempotent no-op
        end if;
        update public.friendships
           set status = 'declined', responded_at = now(), updated_at = now()
         where id = p_friendship_id;
        return;
    end if;

    if p_action = 'unblock' then
        if v_row.status <> 'blocked' or v_row.blocked_by <> v_uid then
            return;
        end if;
        update public.friendships
           set status = 'declined', blocked_by = null, responded_at = now(), updated_at = now()
         where id = p_friendship_id;
        return;
    end if;

    -- block / remove: both dissolve the relationship, so both are guarded
    -- by the same outstanding-balance and live-shared-vault checks.
    if to_regclass('public.transaction_shares') is not null then
        select coalesce(sum(case when creditor_user_id = v_uid
                                  then share_amount_eur else -share_amount_eur end), 0)
          into v_net
          from public.transaction_shares
         where status = 'active'
           and least(debtor_user_id, creditor_user_id) = least(v_uid, v_other)
           and greatest(debtor_user_id, creditor_user_id) = greatest(v_uid, v_other);
    end if;

    if to_regclass('public.vault_members') is not null then
        select exists (
            select 1 from public.vault_members m
             where m.user_id = v_other and m.status = 'active'
               and public.nomadix_is_vault_member(m.vault_id, v_uid)
        ) into v_shared_live;
    end if;

    if p_action = 'remove' and v_shared_live then
        raise exception 'Leave your shared vault with this friend first'
            using errcode = 'foreign_key_violation';
    end if;

    if v_net <> 0 and not p_force then
        raise exception 'You have an outstanding balance with this friend'
            using errcode = 'check_violation';
    end if;

    if v_net <> 0 and p_force and to_regclass('public.transaction_shares') is not null then
        update public.transaction_shares
           set status = 'void', updated_at = now()
         where status = 'active'
           and least(debtor_user_id, creditor_user_id) = least(v_uid, v_other)
           and greatest(debtor_user_id, creditor_user_id) = greatest(v_uid, v_other);
    end if;

    if p_action = 'block' then
        update public.friendships
           set status = 'blocked', blocked_by = v_uid, responded_at = now(), updated_at = now()
         where id = p_friendship_id;
    else
        update public.friendships
           set status = 'declined', responded_at = now(), updated_at = now()
         where id = p_friendship_id;
    end if;
end $$;

revoke all on function public.nomadix_respond_friend_request(uuid, text, boolean) from public, anon;
grant execute on function public.nomadix_respond_friend_request(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Manual verification (run in the SQL editor as two different authenticated
-- test users, A and B):
--
-- 1) A sets a username, B finds A by @username and by friend code:
-- select public.nomadix_set_username('alice');
-- select * from public.nomadix_find_user('alice');
-- select * from public.nomadix_find_user('NMDX-4F2K');   -- A's own code
--
-- 2) A cannot be found by email under any circumstance:
-- select * from public.nomadix_find_user('alice@example.com'); -- expect 0 rows
--
-- 3) B sends a request, A accepts, both list each other as friends:
-- select public.nomadix_send_friend_request('<A-uuid>'::uuid);
-- select public.nomadix_respond_friend_request('<friendship-id>'::uuid, 'accept');
-- select * from public.nomadix_list_friends();   -- run as both A and B
--
-- 4) Idempotency: re-run step 3's send_friend_request -- expect the SAME
--    friendship id back, no new row:
-- select count(*) from public.friendships where user_low_id in (...) ;
-- ============================================================================

-- ============================================================================
-- SOCIAL LAYER -- PHASE 2: TRANSFER LEDGER + PER-VAULT PRIVACY
-- ----------------------------------------------------------------------------
-- Full design rationale: docs/social-layer-sql-design.md
--
-- Replaces the two-unlinked-rows transfer hack (see new-transaction-modal.tsx)
-- with a first-class ledger: one `transfers` row + two `transactions` legs
-- bound by transfer_id, guarded against being edited or orphaned by a direct
-- delete. Adds accepts_transfers_from to vaults so an owner opts a vault IN
-- to receiving money from friends -- the default is closed.
--
-- Ownership note: `nomadix_owns_vault` is the only access check used here,
-- because shared vaults (public.vault_members) do not exist until Phase 3.
-- Phase 3 upgrades the relevant call sites to `nomadix_can_access_vault`
-- via `create or replace function` -- nothing here needs to change shape.
--
-- Re-runnable: every statement is idempotent.
-- After applying: Supabase -> Settings -> API -> Reload schema
--                 (or: notify pgrst, 'reload schema';)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- vaults: per-vault transfer privacy. Closed by default -- an existing
-- vault opts IN, it is never opened by this migration.
-- ---------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.vaults') is null then
        raise notice 'vaults missing; skipping social vault columns';
        return;
    end if;

    alter table public.vaults
        add column if not exists accepts_transfers_from text not null default 'nobody',
        add column if not exists transfer_note text;

    begin
        alter table public.vaults
            add constraint vaults_accepts_transfers_from_check
            check (accepts_transfers_from in ('nobody','friends','allowlist'));
    exception when duplicate_object then null; end;
end $$;

create index if not exists vaults_user_id_idx on public.vaults (user_id);
create index if not exists vaults_open_idx
    on public.vaults (user_id) where accepts_transfers_from <> 'nobody';

-- ---------------------------------------------------------------------------
-- nomadix_owns_vault: reads ONLY public.vaults. SECURITY DEFINER so it
-- behaves identically whether called from an RPC, a trigger, or (from
-- Phase 3 onward) a policy on a different table. Phase 3 adds the wider
-- nomadix_can_access_vault (owner OR active co-owner) for shared vaults --
-- this one stays owner-only on purpose, for settings writes that must
-- never be delegated to a co-owner. Defined before vault_transfer_allowlist
-- below because that table's RLS policy calls it.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_owns_vault(
    p_vault_id uuid,
    p_user_id  uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select p_user_id is not null
       and exists (select 1 from public.vaults v
                    where v.id = p_vault_id and v.user_id = p_user_id);
$$;

revoke all on function public.nomadix_owns_vault(uuid, uuid) from public, anon;
grant execute on function public.nomadix_owns_vault(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- vault_transfer_allowlist: who may transfer into a vault set to 'allowlist'.
-- No write policies -- every write goes through nomadix_set_vault_transfer_policy.
-- ---------------------------------------------------------------------------
create table if not exists public.vault_transfer_allowlist (
    vault_id uuid not null references public.vaults(id) on delete cascade,
    friend_user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (vault_id, friend_user_id)
);

create index if not exists vault_transfer_allowlist_friend_idx
    on public.vault_transfer_allowlist (friend_user_id);

alter table public.vault_transfer_allowlist enable row level security;

do $$
begin
    -- Owner-only. A friend never sees whether they are on a list; they only
    -- learn it indirectly, by the vault appearing in
    -- nomadix_list_transferable_vaults().
    begin
        create policy "vault_transfer_allowlist_select_owner"
        on public.vault_transfer_allowlist
        for select to authenticated
        using (public.nomadix_owns_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- transfers: the ledger that fixes the orphaned-leg bug. One row per
-- logical money movement; group_id correlates a transfer with its later
-- reversal so the UI can render both as one episode.
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null default gen_random_uuid(),

    kind text not null default 'friend'
        check (kind in ('internal','friend','settlement','reversal')),
    status text not null default 'completed'
        check (status in ('completed','reversed')),

    sender_user_id     uuid not null references auth.users(id) on delete cascade,
    sender_vault_id    uuid not null references public.vaults(id) on delete restrict,
    recipient_user_id  uuid not null references auth.users(id) on delete cascade,
    recipient_vault_id uuid not null references public.vaults(id) on delete restrict,

    -- Unsigned magnitudes; the sign lives only in public.transactions (same
    -- convention as public.subscriptions.amount).
    amount_sent       numeric(14,2) not null check (amount_sent > 0),
    sent_currency     text not null check (sent_currency in ('EUR','USD')),
    fee               numeric(14,2) not null default 0 check (fee >= 0),
    amount_received   numeric(14,2) not null check (amount_received > 0),
    received_currency text not null check (received_currency in ('EUR','USD')),
    exchange_rate     numeric,                -- USD -> EUR, null when same currency
    amount_eur        numeric(14,2) not null, -- frozen canonical value

    note text,

    out_transaction_id uuid references public.transactions(id) on delete set null,
    in_transaction_id  uuid references public.transactions(id) on delete set null,

    reversible_until timestamptz,
    reversed_at      timestamptz,
    reversed_by      uuid references auth.users(id) on delete set null,
    reversal_of_transfer_id uuid references public.transfers(id) on delete set null,

    client_token text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint transfers_distinct_vaults
        check (sender_vault_id <> recipient_vault_id),
    constraint transfers_fx_consistency
        check ((sent_currency =  received_currency and exchange_rate is null)
            or (sent_currency <> received_currency and exchange_rate > 0)),
    constraint transfers_reversal_shape
        check ((kind = 'reversal') = (reversal_of_transfer_id is not null)),
    constraint transfers_reversed_shape
        check ((status = 'reversed') = (reversed_at is not null)),
    constraint transfers_internal_not_reversible
        check (kind <> 'internal' or reversible_until is null)
);

-- Idempotency #1: a transfer can be reversed AT MOST ONCE. Two concurrent
-- "Return" taps -> one succeeds, the other gets a unique violation that
-- nomadix_reverse_transfer turns into a clean message.
create unique index if not exists transfers_reversal_uidx
    on public.transfers (reversal_of_transfer_id)
    where reversal_of_transfer_id is not null;

-- Idempotency #2: client-supplied token minted when the Send modal opens.
-- A retried POST, a double click, or a React double-invoke returns the
-- transfer that already exists instead of moving the money twice.
create unique index if not exists transfers_client_token_uidx
    on public.transfers (sender_user_id, client_token)
    where client_token is not null;

create index if not exists transfers_sender_idx
    on public.transfers (sender_user_id, created_at desc);
create index if not exists transfers_recipient_idx
    on public.transfers (recipient_user_id, created_at desc);
create index if not exists transfers_group_idx
    on public.transfers (group_id);
create index if not exists transfers_reversible_idx
    on public.transfers (recipient_user_id, reversible_until)
    where status = 'completed' and reversible_until is not null;

alter table public.transfers enable row level security;

do $$
begin
    -- Both parties read; nobody writes directly -- every write is one of
    -- the RPCs below.
    begin
        create policy "transfers_select_party" on public.transfers
        for select to authenticated
        using (auth.uid() in (sender_user_id, recipient_user_id));
    exception when duplicate_object then null; end;
end $$;

drop trigger if exists transfers_touch_trg on public.transfers;
create trigger transfers_touch_trg
    before update on public.transfers
    for each row execute function public.nomadix_touch_updated_at();

-- ---------------------------------------------------------------------------
-- transactions: transfer linkage. Both FKs are ON DELETE SET NULL, not
-- CASCADE -- deleting a transfers row (only ever done by the guard trigger
-- below, for an internal transfer) must not delete the money rows out from
-- under the user.
-- ---------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.transactions') is null then
        raise notice 'transactions missing; skipping transfer linkage';
        return;
    end if;

    alter table public.transactions
        add column if not exists transfer_id uuid,
        add column if not exists transfer_leg text,
        add column if not exists transfer_group_id uuid;

    begin
        alter table public.transactions
            add constraint transactions_transfer_leg_check
            check (transfer_leg is null or transfer_leg in ('out','in'));
    exception when duplicate_object then null; end;

    begin
        alter table public.transactions
            add constraint transactions_transfer_leg_pairing
            check ((transfer_id is null) = (transfer_leg is null));
    exception when duplicate_object then null; end;

    begin
        alter table public.transactions
            add constraint transactions_transfer_id_fkey
            foreign key (transfer_id) references public.transfers(id)
            on delete set null;
    exception when duplicate_object then null; end;
end $$;

create index if not exists transactions_transfer_id_idx
    on public.transactions (transfer_id) where transfer_id is not null;
create index if not exists transactions_transfer_group_idx
    on public.transactions (transfer_group_id) where transfer_group_id is not null;

-- NEWLY LOAD-BEARING: shared-vault reads (Phase 3) and the funds check in
-- nomadix_send_transfer both filter transactions by vault_id. Without this
-- index both become sequential scans.
create index if not exists transactions_vault_id_idx
    on public.transactions (vault_id);

-- ---------------------------------------------------------------------------
-- Backfill of legacy two-leg transfers. Best effort and deliberately
-- conservative -- an ambiguous match is left NULL rather than wrongly
-- paired. Populates ONLY transfer_group_id; it never fabricates a
-- `transfers` row, because the historical rate/fee attribution cannot be
-- reconstructed reliably from the old description-prefix convention.
-- ---------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.transactions') is null then return; end if;

    with legs as (
        select t.id, t.user_id, t.created_at,
               case when t.description like '[Transfer → %' then 'out'
                    when t.description like '[Transfer ← %' then 'in'  end as leg
          from public.transactions t
         where t.type = 'transfer'
           and t.transfer_group_id is null
           and t.transfer_id is null
    ),
    candidates as (
        select o.id as out_id, i.id as in_id,
               row_number() over (partition by o.id
                   order by abs(extract(epoch from (i.created_at - o.created_at))), i.id) as rn_out,
               row_number() over (partition by i.id
                   order by abs(extract(epoch from (i.created_at - o.created_at))), o.id) as rn_in
          from legs o
          join legs i
            on i.user_id = o.user_id
           and o.leg = 'out' and i.leg = 'in'
           and abs(extract(epoch from (i.created_at - o.created_at))) <= 5
    ),
    paired as (
        select out_id, in_id, gen_random_uuid() as gid
          from candidates
         where rn_out = 1 and rn_in = 1   -- mutual best match only
    )
    update public.transactions t
       set transfer_group_id = p.gid
      from paired p
     where t.id = p.out_id or t.id = p.in_id;
end $$;

-- Verification (expect 0 rows): every populated group has exactly 2 legs.
--   select transfer_group_id, count(*) from public.transactions
--    where transfer_group_id is not null group by 1 having count(*) <> 2;
-- Orphans left behind on purpose (inspect, do not auto-fix):
--   select count(*) from public.transactions
--    where type = 'transfer' and transfer_group_id is null;

-- ---------------------------------------------------------------------------
-- nomadix_list_transferable_vaults: the ONLY way one user ever sees
-- another user's vaults. Returns a NARROW row type -- no balance, no
-- transaction count, no is_protected, no timestamps. Adding a column to
-- public.vaults cannot widen this; someone must edit this signature on
-- purpose. Denial is uniform: a non-friend, a blocked user, a user who
-- does not exist, and a user with zero open vaults all get the same empty
-- set -- this function is never an existence oracle.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_list_transferable_vaults(
    p_target_user_id uuid
) returns table (
    vault_id uuid,
    name     text,
    currency text,
    vault_type text,
    icon     text,
    color    text,
    accepts_from_me boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select v.id, v.name, v.currency, v.type, v.icon, v.color, true
      from public.vaults v
     where auth.uid() is not null
       and p_target_user_id is not null
       and v.user_id = p_target_user_id
       -- Self-listing is allowed (the "send to my own vault" picker reuses
       -- this), skipping the friendship test.
       and (
            p_target_user_id = auth.uid()
            or (
                public.nomadix_are_friends(auth.uid(), p_target_user_id)
                and (
                     v.accepts_transfers_from = 'friends'
                  or (v.accepts_transfers_from = 'allowlist'
                      and exists (
                          select 1 from public.vault_transfer_allowlist a
                           where a.vault_id = v.id
                             and a.friend_user_id = auth.uid()
                      ))
                )
            )
       )
     order by v.name;
$$;

revoke all on function public.nomadix_list_transferable_vaults(uuid) from public, anon;
grant execute on function public.nomadix_list_transferable_vaults(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_set_vault_transfer_policy: owner-only. Takes the vault row lock,
-- so it serializes correctly against an in-flight nomadix_send_transfer --
-- "removed from the allowlist right as someone sends" resolves to whichever
-- commits first, never to a stale read. Fully idempotent: saving the same
-- settings twice changes nothing.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_set_vault_transfer_policy(
    p_vault_id uuid,
    p_mode text,
    p_friend_ids uuid[] default '{}'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := auth.uid();
    v_ids uuid[] := coalesce(p_friend_ids, '{}'::uuid[]);
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;
    if p_mode not in ('nobody','friends','allowlist') then
        raise exception 'Unknown transfer policy' using errcode = 'invalid_parameter_value';
    end if;

    perform 1 from public.vaults where id = p_vault_id for update;

    if not public.nomadix_owns_vault(p_vault_id, v_uid) then
        raise exception 'Vault not found' using errcode = 'insufficient_privilege';
    end if;

    if p_mode = 'allowlist' and exists (
        select 1 from unnest(v_ids) f(id)
         where not public.nomadix_are_friends(v_uid, f.id)
    ) then
        raise exception 'Every id must be an accepted friend'
            using errcode = 'invalid_parameter_value';
    end if;

    update public.vaults
       set accepts_transfers_from = p_mode, updated_at = now()
     where id = p_vault_id;

    if p_mode = 'allowlist' then
        insert into public.vault_transfer_allowlist (vault_id, friend_user_id)
        select p_vault_id, f from unnest(v_ids) f
        on conflict do nothing;

        delete from public.vault_transfer_allowlist
         where vault_id = p_vault_id
           and friend_user_id <> all (v_ids);
    else
        delete from public.vault_transfer_allowlist where vault_id = p_vault_id;
    end if;
end $$;

revoke all on function public.nomadix_set_vault_transfer_policy(uuid, text, uuid[]) from public, anon;
grant execute on function public.nomadix_set_vault_transfer_policy(uuid, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_send_transfer: the single write path for every transfer, own-vault
-- or friend-vault alike. Also replaces handleTransferSubmit in
-- new-transaction-modal.tsx -- an internal vault-to-vault transfer now
-- produces a transfers row and two linked legs, which is what makes the
-- orphaned-leg bug structurally impossible from here on.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_send_transfer(
    p_from_vault_id uuid,
    p_to_vault_id   uuid,
    p_amount        numeric,
    p_fee           numeric default 0,
    p_note          text    default null,
    p_exchange_rate numeric default null,
    p_client_token  text    default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid        uuid := auth.uid();
    v_from       public.vaults%rowtype;
    v_to         public.vaults%rowtype;
    v_existing   uuid;
    v_kind       text;
    v_rate       numeric := null;
    v_eur_rate   numeric;
    v_amount     numeric;
    v_fee        numeric := round(coalesce(p_fee, 0), 2);
    v_received   numeric;
    v_amount_eur numeric;
    v_balance    numeric;
    v_group      uuid := gen_random_uuid();
    v_transfer   uuid;
    v_out_tx     uuid;
    v_in_tx      uuid;
    v_allowed    boolean := false;
    v_desc_out   text;
    v_desc_in    text;
    v_sender_name text;
begin
    ---------------------------------------------------------------- guards
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;

    v_amount := round(coalesce(p_amount, 0), 2);
    if v_amount <= 0 then
        raise exception 'Amount must be greater than zero'
            using errcode = 'invalid_parameter_value';
    end if;
    if v_fee < 0 then
        raise exception 'Fee cannot be negative'
            using errcode = 'invalid_parameter_value';
    end if;
    if p_from_vault_id is null or p_to_vault_id is null then
        raise exception 'Both vaults are required'
            using errcode = 'invalid_parameter_value';
    end if;
    if p_from_vault_id = p_to_vault_id then
        raise exception 'Source and destination vaults must be different'
            using errcode = 'invalid_parameter_value';
    end if;

    ------------------------------------------------------- idempotency
    if p_client_token is not null then
        select id into v_existing
          from public.transfers
         where sender_user_id = v_uid and client_token = p_client_token;
        if found then
            return v_existing;
        end if;
    end if;

    ------------------------------------------------------------- locking
    -- Lock BOTH vault rows in primary-key order: concurrent transfers
    -- between the same two vaults never deadlock, and a concurrent
    -- nomadix_set_vault_transfer_policy is serialized against us, so the
    -- settings read below are the committed truth at the moment the money
    -- moves -- never a value that was already stale when the client
    -- rendered the picker.
    perform 1
       from public.vaults
      where id in (p_from_vault_id, p_to_vault_id)
      order by id
      for update;

    select * into v_from from public.vaults where id = p_from_vault_id;
    select * into v_to   from public.vaults where id = p_to_vault_id;

    -- Uniform denial: a missing vault, someone else's vault, a closed
    -- vault, a stranger's vault, a block -- all raise the SAME message.
    -- Anything more specific turns this RPC into an existence oracle.
    if v_from.id is null or v_to.id is null then
        raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
    end if;

    ------------------------------------------------- source authorization
    if not public.nomadix_owns_vault(v_from.id, v_uid) then
        raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
    end if;

    -------------------------------------------- destination authorization
    if public.nomadix_owns_vault(v_to.id, v_uid) then
        -- Between two vaults I own: internal, no reversal window, no
        -- friendship needed.
        v_kind := 'internal';
    else
        v_kind := 'friend';

        if not public.nomadix_are_friends(v_uid, v_to.user_id) then
            raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
        end if;

        if v_to.accepts_transfers_from = 'friends' then
            v_allowed := true;
        elsif v_to.accepts_transfers_from = 'allowlist' then
            select exists (
                select 1 from public.vault_transfer_allowlist a
                 where a.vault_id = v_to.id and a.friend_user_id = v_uid
            ) into v_allowed;
        else
            v_allowed := false;   -- 'nobody'
        end if;

        if not v_allowed then
            raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
        end if;
    end if;

    ------------------------------------------------------------------ FX
    -- Single rate, USD -> EUR, same resolver the subscription charger
    -- uses. The SENDER's rate governs and is frozen on the transfer row,
    -- so neither side can re-interpret the deal later by editing their
    -- own user_exchange_rates.
    v_eur_rate := public.nomadix_usd_eur_rate(v_uid);

    if v_from.currency = v_to.currency then
        v_received := v_amount;
        v_rate     := null;
    else
        v_rate := coalesce(nullif(p_exchange_rate, 0), v_eur_rate);
        if v_rate <= 0 then
            raise exception 'Invalid exchange rate'
                using errcode = 'invalid_parameter_value';
        end if;
        if v_from.currency = 'USD' then          -- USD -> EUR
            v_received := round(v_amount * v_rate, 2);
        else                                     -- EUR -> USD
            v_received := round(v_amount / v_rate, 2);
        end if;
    end if;

    if v_received <= 0 then
        raise exception 'Converted amount rounds to zero'
            using errcode = 'invalid_parameter_value';
    end if;

    v_amount_eur := case
        when v_from.currency = 'EUR' then v_amount
        else round(v_amount * coalesce(v_rate, v_eur_rate), 2)
    end;

    -------------------------------------------------------- funds check
    -- Only for cross-user transfers. Runs under the vault row lock taken
    -- above, so two concurrent sends cannot both pass. Internal transfers
    -- keep today's permissive behaviour: moving your own money negative
    -- is your business.
    if v_kind = 'friend' then
        select coalesce(sum(t.amount), 0) into v_balance
          from public.transactions t
         where t.vault_id = v_from.id;

        if v_balance < (v_amount + v_fee) then
            raise exception 'Insufficient funds in the source vault'
                using errcode = 'check_violation';
        end if;
    end if;

    ------------------------------------------------------------- writes
    select coalesce(nullif(trim(p.full_name), ''), '@' || p.username, 'A friend')
      into v_sender_name
      from public.users_profile p where p.id = v_uid;

    v_desc_out := coalesce(nullif(trim(p_note), ''),
                  case when v_kind = 'internal'
                       then 'Transfer to ' || v_to.name
                       else 'Sent to ' || v_to.name end);
    v_desc_in  := coalesce(nullif(trim(p_note), ''),
                  case when v_kind = 'internal'
                       then 'Transfer from ' || v_from.name
                       else 'Received from ' || v_sender_name end);

    insert into public.transfers (
        group_id, kind, status,
        sender_user_id, sender_vault_id, recipient_user_id, recipient_vault_id,
        amount_sent, sent_currency, fee, amount_received, received_currency,
        exchange_rate, amount_eur, note, reversible_until, client_token
    ) values (
        v_group, v_kind, 'completed',
        v_uid, v_from.id, v_to.user_id, v_to.id,
        v_amount, v_from.currency, v_fee, v_received, v_to.currency,
        v_rate, v_amount_eur, nullif(trim(p_note), ''),
        case when v_kind = 'friend' then now() + interval '24 hours' end,
        p_client_token
    )
    returning id into v_transfer;

    -- OUT leg: sender's ledger. category MUST be null: constraint
    -- transactions_transfer_no_category.
    insert into public.transactions (
        user_id, vault_id, amount, type, original_currency,
        exchange_rate_at_time, category, description, date, status, fee,
        transfer_id, transfer_leg, transfer_group_id
    ) values (
        v_uid, v_from.id, -(v_amount + v_fee), 'transfer', v_from.currency,
        v_rate, null, v_desc_out, current_date, 'completed', v_fee,
        v_transfer, 'out', v_group
    )
    returning id into v_out_tx;

    -- IN leg: booked against the destination vault's owner of record.
    insert into public.transactions (
        user_id, vault_id, amount, type, original_currency,
        exchange_rate_at_time, category, description, date, status, fee,
        transfer_id, transfer_leg, transfer_group_id
    ) values (
        v_to.user_id, v_to.id, v_received, 'transfer', v_to.currency,
        v_rate, null, v_desc_in, current_date, 'completed', 0,
        v_transfer, 'in', v_group
    )
    returning id into v_in_tx;

    update public.transfers
       set out_transaction_id = v_out_tx,
           in_transaction_id  = v_in_tx,
           updated_at = now()
     where id = v_transfer;

    return v_transfer;
end $$;

revoke all on function public.nomadix_send_transfer(uuid, uuid, numeric, numeric, text, numeric, text)
    from public, anon;
grant execute on function public.nomadix_send_transfer(uuid, uuid, numeric, numeric, text, numeric, text)
    to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_reverse_transfer: ONLY the recipient can return money -- a sender
-- can never claw funds out of someone else's vault. Replays the original
-- exchange_rate with sent/received swapped so the original sender is made
-- exactly whole; the fee is NOT refunded, it was a real cost already paid.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_reverse_transfer(
    p_transfer_id uuid,
    p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid      uuid := auth.uid();
    v_orig     public.transfers%rowtype;
    v_from     public.vaults%rowtype; -- original recipient vault -> reversal sender
    v_to       public.vaults%rowtype; -- original sender vault -> reversal recipient
    v_balance  numeric;
    v_reversal uuid;
    v_out_tx   uuid;
    v_in_tx    uuid;
    v_desc_out text;
    v_desc_in  text;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;

    select * into v_orig from public.transfers where id = p_transfer_id for update;
    if not found then
        raise exception 'Transfer not found' using errcode = 'no_data_found';
    end if;

    if v_orig.recipient_user_id <> v_uid then
        raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
    end if;
    if v_orig.kind <> 'friend' then
        raise exception 'This transfer cannot be reversed'
            using errcode = 'invalid_parameter_value';
    end if;
    if v_orig.status <> 'completed' then
        raise exception 'This transfer was already returned' using errcode = '23505';
    end if;
    if v_orig.reversible_until is null or v_orig.reversible_until < now() then
        raise exception 'The 24-hour return window has passed'
            using errcode = 'invalid_parameter_value';
    end if;

    perform 1 from public.vaults
     where id in (v_orig.sender_vault_id, v_orig.recipient_vault_id)
     order by id for update;

    select * into v_from from public.vaults where id = v_orig.recipient_vault_id;
    select * into v_to   from public.vaults where id = v_orig.sender_vault_id;

    -- If the recipient already spent it, fail rather than drive their
    -- vault negative.
    select coalesce(sum(t.amount), 0) into v_balance
      from public.transactions t where t.vault_id = v_from.id;
    if v_balance < v_orig.amount_received then
        raise exception 'Insufficient funds to return this transfer'
            using errcode = 'check_violation';
    end if;

    v_desc_out := coalesce(nullif(trim(p_note), ''), 'Returned to ' || v_to.name);
    v_desc_in  := coalesce(nullif(trim(p_note), ''), 'Returned from ' || v_from.name);

    insert into public.transfers (
        group_id, kind, status,
        sender_user_id, sender_vault_id, recipient_user_id, recipient_vault_id,
        amount_sent, sent_currency, fee, amount_received, received_currency,
        exchange_rate, amount_eur, note, reversal_of_transfer_id
    ) values (
        v_orig.group_id, 'reversal', 'completed',
        v_uid, v_from.id, v_orig.sender_user_id, v_to.id,
        v_orig.amount_received, v_orig.received_currency,
        0, v_orig.amount_sent, v_orig.sent_currency,
        v_orig.exchange_rate, v_orig.amount_eur, nullif(trim(p_note), ''),
        p_transfer_id
    )
    returning id into v_reversal;

    insert into public.transactions (
        user_id, vault_id, amount, type, original_currency,
        exchange_rate_at_time, category, description, date, status, fee,
        transfer_id, transfer_leg, transfer_group_id
    ) values (
        v_uid, v_from.id, -v_orig.amount_received, 'transfer', v_from.currency,
        v_orig.exchange_rate, null, v_desc_out, current_date, 'completed', 0,
        v_reversal, 'out', v_orig.group_id
    ) returning id into v_out_tx;

    insert into public.transactions (
        user_id, vault_id, amount, type, original_currency,
        exchange_rate_at_time, category, description, date, status, fee,
        transfer_id, transfer_leg, transfer_group_id
    ) values (
        v_orig.sender_user_id, v_to.id, v_orig.amount_sent, 'transfer', v_to.currency,
        v_orig.exchange_rate, null, v_desc_in, current_date, 'completed', 0,
        v_reversal, 'in', v_orig.group_id
    ) returning id into v_in_tx;

    update public.transfers
       set out_transaction_id = v_out_tx, in_transaction_id = v_in_tx, updated_at = now()
     where id = v_reversal;

    update public.transfers
       set status = 'reversed', reversed_at = now(), reversed_by = v_uid, updated_at = now()
     where id = p_transfer_id;

    return v_reversal;
exception
    when unique_violation then
        raise exception 'This transfer was already returned' using errcode = '23505';
end $$;

revoke all on function public.nomadix_reverse_transfer(uuid, text) from public, anon;
grant execute on function public.nomadix_reverse_transfer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_guard_transfer_leg: makes a transfer leg immutable except through
-- the RPCs above, and makes deleting one leg of a linked transfer either
-- impossible (cross-user -- points at Return instead) or a full cascade
-- (internal -- removes the sibling leg and the transfers row atomically).
-- Legacy rows (transfer_id is null) pass straight through, untouched.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_guard_transfer_leg()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    v_kind text;
begin
    if TG_OP = 'UPDATE' then
        if OLD.transfer_id is null then
            return NEW;
        end if;
        -- A nested update (depth > 1) is never a client edit -- it is
        -- Postgres's own ON DELETE SET NULL action on
        -- transactions_transfer_id_fkey, fired from inside the DELETE
        -- branch below when an internal transfer's `transfers` row is
        -- removed while OLD (about to be deleted itself) still points at
        -- it. Guarding that nested update would deadlock the cascade this
        -- trigger exists to perform, so only a top-level (depth = 1),
        -- client-issued update is checked.
        if pg_trigger_depth() > 1 then
            return NEW;
        end if;
        if NEW.amount        is distinct from OLD.amount
        or NEW.vault_id      is distinct from OLD.vault_id
        or NEW.type          is distinct from OLD.type
        or NEW.fee           is distinct from OLD.fee
        or NEW.date          is distinct from OLD.date
        or NEW.transfer_id   is distinct from OLD.transfer_id
        or NEW.transfer_leg  is distinct from OLD.transfer_leg
        then
            raise exception 'A transfer leg cannot be edited directly -- use Return instead'
                using errcode = 'insufficient_privilege';
        end if;
        return NEW;
    end if;

    if TG_OP = 'DELETE' then
        if OLD.transfer_id is null then
            return OLD;
        end if;

        select kind into v_kind from public.transfers where id = OLD.transfer_id;

        -- v_kind is null when the transfers row is already gone -- the
        -- sibling leg's own cascade (see the AFTER trigger below) got here
        -- first in the same statement. Nothing left to refuse; let it pass.
        if v_kind is not null and v_kind <> 'internal' then
            raise exception 'A transfer between two people cannot be deleted -- use Return instead'
                using errcode = 'insufficient_privilege';
        end if;

        -- Internal transfer: allowed. The AFTER trigger below cascades to
        -- the sibling leg and the transfers row -- it cannot be done here,
        -- in BEFORE, because Postgres refuses a second DML statement that
        -- touches OLD's own row within the same command ("tuple to be
        -- deleted was already modified by an operation triggered by the
        -- current command").
        return OLD;
    end if;

    return null;
end $$;

-- ---------------------------------------------------------------------------
-- nomadix_after_delete_transfer_leg: the actual internal-transfer cascade.
-- Runs AFTER the row is physically gone, so unlike the BEFORE trigger it is
-- free to issue further DELETEs without hitting Postgres's same-row,
-- same-command restriction. Deletes the sibling leg BEFORE the transfers
-- row on purpose -- doing it the other way round would fire this table's
-- own ON DELETE SET NULL on the still-live sibling and trip
-- transactions_transfer_leg_pairing (transfer_id nulled, transfer_leg not).
-- Both DELETEs are naturally idempotent, so whichever leg's trigger runs
-- first finishes the whole cascade and the second one is a clean no-op.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_after_delete_transfer_leg()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    v_kind text;
begin
    if OLD.transfer_id is null then
        return null; -- return value is ignored for AFTER triggers
    end if;

    select kind into v_kind from public.transfers where id = OLD.transfer_id;
    if v_kind is distinct from 'internal' then
        return null; -- friend transfer (blocked above) or already cascaded
    end if;

    delete from public.transactions where transfer_id = OLD.transfer_id;
    delete from public.transfers where id = OLD.transfer_id;

    return null;
end $$;

drop trigger if exists transactions_guard_transfer_leg_del_after on public.transactions;
create trigger transactions_guard_transfer_leg_del_after
    after delete on public.transactions
    for each row execute function public.nomadix_after_delete_transfer_leg();

drop trigger if exists transactions_guard_transfer_leg_upd on public.transactions;
create trigger transactions_guard_transfer_leg_upd
    before update on public.transactions
    for each row execute function public.nomadix_guard_transfer_leg();

drop trigger if exists transactions_guard_transfer_leg_del on public.transactions;
create trigger transactions_guard_transfer_leg_del
    before delete on public.transactions
    for each row execute function public.nomadix_guard_transfer_leg();

-- ---------------------------------------------------------------------------
-- nomadix_guard_vault_delete: a vault with a still-reversible incoming or
-- outgoing friend transfer cannot be deleted out from under the other
-- party. transfers.*_vault_id is ON DELETE RESTRICT as a backstop if this
-- trigger is ever dropped.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_guard_vault_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if exists (
        select 1 from public.transfers t
         where (t.sender_vault_id = OLD.id or t.recipient_vault_id = OLD.id)
           and t.status = 'completed'
           and t.kind = 'friend'
           and t.reversible_until is not null
           and t.reversible_until > now()
    ) then
        raise exception 'This vault has a transfer that can still be returned -- wait 24 hours or resolve it first'
            using errcode = 'foreign_key_violation';
    end if;
    return OLD;
end $$;

drop trigger if exists vaults_guard_delete_trg on public.vaults;
create trigger vaults_guard_delete_trg
    before delete on public.vaults
    for each row execute function public.nomadix_guard_vault_delete();

-- ---------------------------------------------------------------------------
-- Manual verification (run in the SQL editor as two different authenticated
-- test users, A and B, already friends per Phase 1):
--
-- 1) A opens a vault to friends, B sends a transfer into it:
-- select public.nomadix_set_vault_transfer_policy('<A-vault>'::uuid, 'friends');
-- select * from public.nomadix_list_transferable_vaults('<A-uuid>'::uuid); -- run as B
-- select public.nomadix_send_transfer('<B-vault>'::uuid, '<A-vault>'::uuid, 25.00) as tid \gset  -- run as B
--
-- 2) Both legs exist and are linked:
-- select id, vault_id, amount, transfer_leg from public.transactions where transfer_id = :'tid'::uuid;
--
-- 3) A returns it within the window, then tries again (expect the 23505 message):
-- select public.nomadix_reverse_transfer(:'tid'::uuid);   -- run as A
-- select public.nomadix_reverse_transfer(:'tid'::uuid);   -- run as A again -> error
--
-- 4) Deleting one leg of a friend transfer is refused; an internal
--    transfer's legs cascade together:
-- delete from public.transactions where id = '<one-leg-id>'::uuid; -- expect error
-- ============================================================================
