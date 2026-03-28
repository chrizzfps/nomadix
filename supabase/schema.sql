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
