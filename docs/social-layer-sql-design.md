I have everything I need. Here is the complete SQL/data-layer design.

---

# Nomadix Social Layer — SQL Design Document

Everything below is written to be appended to `/Users/chrizz/Documents/Desarrollo/Nomad/supabase/schema.sql` in four separate, re-runnable increments, following the file's existing conventions exactly (`create table if not exists`, `do $$ … exception when duplicate_object then null; end; … $$`, `to_regclass` guards on dashboard-owned tables, `nomadix_` prefix, `security definer` + `set search_path = public, pg_temp`, `revoke … from public, anon; grant execute … to authenticated`).

---

## 0. Design spine (read this first, the rest follows from it)

Five decisions drive the whole design:

1. **No service role ⇒ every cross-user write is a `security definer` RPC.** The browser never inserts a row that lands in another user's ledger. `transfers`, `vault_members`, `transaction_shares`, `settlements` and `friendships` get **no INSERT/UPDATE/DELETE RLS policies at all** — they are readable by the parties involved and writable only through RPCs. This is the same pattern `user_ai_keys` already uses ("there is deliberately no insert/update RLS policy on the table").
2. **RLS on `vaults`/`transactions` is widened *additively*, never by dropping what we cannot see.** Permissive policies OR together; restrictive policies AND. So shared vaults need only new *permissive* SELECT/UPDATE/DELETE policies, and the pre-existing integrity hole (anyone can insert a `transactions` row pointing at a stranger's `vault_id`) is closed with a new *restrictive* INSERT/UPDATE policy. The drop-and-recreate script exists as a fallback, gated on an audit query.
3. **Friend visibility is a function return type, never an RLS row.** RLS grants the whole row; PostgREST lets the client choose columns and embed related resources. A narrow `returns table(...)` is an explicit allowlist.
4. **Money is frozen in EUR at write time.** Every share and settlement stores `*_eur` computed with the writer's rate at the instant it happened. The net balance is then exact integer-ish arithmetic both parties agree on, instead of a number that changes when either user's `user_exchange_rates` row moves.
5. **A transfer is one `transfers` row + two `transactions` legs bound by `transfer_id`.** The `[Transfer → X]` description hack is replaced; legs become un-deletable and un-editable except through RPCs.

---

## 1. New tables

### 1.1 `friendships` — one row per *pair*, not per request

```sql
create table if not exists public.friendships (
    id uuid primary key default gen_random_uuid(),

    -- Canonical ordering: the pair (A,B) and (B,A) is ONE row.
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
```

**Idempotency key: `unique (user_low_id, user_high_id)` combined with the `user_low_id < user_high_id` check.** This is the whole point of the canonical ordering. Without it, A→B and B→A simultaneously produce two `pending` rows and the accept/decline flow becomes ambiguous forever. With it, the "crossed requests" race is resolved by an `on conflict … do update` inside `nomadix_send_friend_request`: the second request *auto-accepts* the first. It also makes "are these two friends?" a single index probe rather than a two-branch OR.

`blocked_by` is a column rather than a second row because a block is a property of the pair with an attributed actor. If B blocks A, the row is `status='blocked', blocked_by=B` — and A's SELECT policy (below) hides it entirely, so A sees "no relationship", not "you are blocked".

### 1.2 `vault_transfer_allowlist`

```sql
create table if not exists public.vault_transfer_allowlist (
    vault_id uuid not null references public.vaults(id) on delete cascade,
    friend_user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (vault_id, friend_user_id)
);

create index if not exists vault_transfer_allowlist_friend_idx
    on public.vault_transfer_allowlist (friend_user_id);
```

**Idempotency key: the composite PK `(vault_id, friend_user_id)`.** The settings UI sends the whole desired allowlist; the RPC does `insert … on conflict do nothing` + `delete … where friend_user_id <> all(p_allowlist)`, so saving the same list twice is a no-op. `on delete cascade` on `vault_id` is correct — an allowlist entry has no meaning without its vault.

### 1.3 `vault_members` — shared vaults, capped at 2 *declaratively*

```sql
create table if not exists public.vault_members (
    id uuid primary key default gen_random_uuid(),
    vault_id uuid not null references public.vaults(id) on delete cascade,
    user_id  uuid not null references auth.users(id) on delete cascade,

    -- Slot 1 is always the owner. Slot 2 is the single co-owner.
    member_slot smallint not null check (member_slot in (1, 2)),
    role text not null default 'member' check (role in ('owner','member')),
    status text not null default 'invited'
        check (status in ('invited','active','declined','left','removed')),

    invited_by uuid references auth.users(id) on delete set null,
    invited_at timestamptz not null default now(),
    joined_at  timestamptz,
    left_at    timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint vault_members_owner_slot
        check (role <> 'owner' or member_slot = 1),
    constraint vault_members_joined_shape
        check ((status = 'active') = (joined_at is not null))
);

-- Idempotency key #1: the same person cannot be invited twice, and cannot
-- hold two live rows on one vault.
create unique index if not exists vault_members_live_user_uidx
    on public.vault_members (vault_id, user_id)
    where status in ('invited','active');

-- Idempotency key #2: THIS is what enforces "exactly 2 users" without a
-- counting trigger. Only two slots exist and only live rows hold one, so a
-- third invite has nowhere to go and fails at the index, atomically, even
-- under concurrent invites.
create unique index if not exists vault_members_live_slot_uidx
    on public.vault_members (vault_id, member_slot)
    where status in ('invited','active');

create index if not exists vault_members_user_idx
    on public.vault_members (user_id, status);
```

Both uniques are **partial on live statuses**, so `declined`/`left`/`removed` rows stay as an audit trail while freeing the slot — a vault can be re-shared with someone else after a partner leaves, and the history of who was in it is never lost.

### 1.4 `transfers` — the ledger that fixes the orphaned-leg bug

```sql
create table if not exists public.transfers (
    id uuid primary key default gen_random_uuid(),

    -- Correlates every transactions row produced by one logical operation.
    group_id uuid not null default gen_random_uuid(),

    kind text not null default 'friend'
        check (kind in ('internal','friend','settlement','reversal')),
    status text not null default 'completed'
        check (status in ('completed','reversed')),

    sender_user_id     uuid not null references auth.users(id) on delete cascade,
    sender_vault_id    uuid not null references public.vaults(id) on delete restrict,
    recipient_user_id  uuid not null references auth.users(id) on delete cascade,
    recipient_vault_id uuid not null references public.vaults(id) on delete restrict,

    -- Unsigned magnitudes; the sign lives only in public.transactions
    -- (same convention as public.subscriptions.amount).
    amount_sent       numeric(14,2) not null check (amount_sent > 0),
    sent_currency     text not null check (sent_currency in ('EUR','USD')),
    fee               numeric(14,2) not null default 0 check (fee >= 0),
    amount_received   numeric(14,2) not null check (amount_received > 0),
    received_currency text not null check (received_currency in ('EUR','USD')),
    exchange_rate     numeric,                      -- USD->EUR, null when same ccy
    amount_eur        numeric(14,2) not null,       -- frozen canonical value

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

-- Idempotency key #1: a transfer can be reversed AT MOST ONCE, enforced by
-- the index rather than by the read-check inside the RPC. Two concurrent
-- "Return" taps => one succeeds, the other gets a unique violation.
create unique index if not exists transfers_reversal_uidx
    on public.transfers (reversal_of_transfer_id)
    where reversal_of_transfer_id is not null;

-- Idempotency key #2: client-supplied token (a uuid minted in the browser
-- when the Send modal opens). A retry after a network timeout, a double
-- click, or a React StrictMode double-invoke returns the FIRST transfer id
-- instead of moving the money twice.
create unique index if not exists transfers_client_token_uidx
    on public.transfers (sender_user_id, client_token)
    where client_token is not null;

create index if not exists transfers_sender_idx
    on public.transfers (sender_user_id, created_at desc);
create index if not exists transfers_recipient_idx
    on public.transfers (recipient_user_id, created_at desc);
create index if not exists transfers_group_idx
    on public.transfers (group_id);
-- Drives the "you can still return this" badge without a seq scan.
create index if not exists transfers_reversible_idx
    on public.transfers (recipient_user_id, reversible_until)
    where status = 'completed' and reversible_until is not null;
```

`on delete restrict` on both vault FKs is deliberate: deleting a vault must not silently shred the other party's transfer history. A friendly `before delete` trigger on `vaults` (§5.14) turns the raw FK error into a readable message.

### 1.5 `transaction_shares` — the split ledger

```sql
create table if not exists public.transaction_shares (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid not null references public.transactions(id) on delete cascade,

    owner_user_id        uuid not null references auth.users(id) on delete cascade,
    counterparty_user_id uuid not null references auth.users(id) on delete cascade,

    direction text not null
        check (direction in ('owed_to_owner','owed_by_owner')),
    split_mode text not null check (split_mode in ('equal','amount','percent')),
    split_value numeric(14,4),

    total_amount     numeric(14,2) not null check (total_amount > 0),
    share_amount     numeric(14,2) not null check (share_amount >= 0),
    currency         text not null check (currency in ('EUR','USD')),
    exchange_rate    numeric,
    share_amount_eur numeric(14,2) not null check (share_amount_eur >= 0),

    status text not null default 'active'
        check (status in ('active','void','rejected')),
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Stored generated columns: the pair key and the creditor, so the net
    -- balance view is a plain GROUP BY with no CASE in the join keys.
    pair_low  uuid generated always as
        (case when owner_user_id < counterparty_user_id
              then owner_user_id else counterparty_user_id end) stored,
    pair_high uuid generated always as
        (case when owner_user_id < counterparty_user_id
              then counterparty_user_id else owner_user_id end) stored,
    creditor_user_id uuid generated always as
        (case when direction = 'owed_to_owner'
              then owner_user_id else counterparty_user_id end) stored,

    constraint transaction_shares_distinct_parties
        check (owner_user_id <> counterparty_user_id),
    constraint transaction_shares_split_value
        check ((split_mode  = 'equal'  and split_value is null)
            or (split_mode  = 'amount' and split_value > 0)
            or (split_mode  = 'percent' and split_value > 0 and split_value <= 100)),
    constraint transaction_shares_within_total
        check (share_amount <= total_amount),

    -- Idempotency key: ONE share per (transaction, friend). Re-submitting
    -- the split sheet is an upsert, not a duplicate debt.
    unique (transaction_id, counterparty_user_id)
);

create index if not exists transaction_shares_pair_active_idx
    on public.transaction_shares (pair_low, pair_high)
    where status = 'active';
create index if not exists transaction_shares_counterparty_idx
    on public.transaction_shares (counterparty_user_id, status, created_at desc);
create index if not exists transaction_shares_owner_idx
    on public.transaction_shares (owner_user_id, status, created_at desc);
```

`direction` encodes both cases from requirement 6: an **expense** I paid where my friend owes me their portion is `owed_to_owner`; **income** I received where part belongs to my friend is `owed_by_owner`. `creditor_user_id` collapses that into one column so the balance math is a single `CASE`.

`share_amount_eur` is frozen at creation with the owner's rate. Both sides then compute the identical net — critical, because otherwise Alice's settle-up would clear €48.10 of a debt Bob believes is €48.35.

### 1.6 `settlements` + `settlement_allocations`

```sql
create table if not exists public.settlements (
    id uuid primary key default gen_random_uuid(),
    payer_user_id uuid not null references auth.users(id) on delete cascade,
    payee_user_id uuid not null references auth.users(id) on delete cascade,

    amount_eur numeric(14,2) not null check (amount_eur > 0),
    net_eur_at_settlement numeric(14,2) not null,   -- audit snapshot
    transfer_id uuid not null references public.transfers(id) on delete restrict,

    note text,
    created_at timestamptz not null default now(),

    pair_low  uuid generated always as
        (case when payer_user_id < payee_user_id
              then payer_user_id else payee_user_id end) stored,
    pair_high uuid generated always as
        (case when payer_user_id < payee_user_id
              then payee_user_id else payer_user_id end) stored,

    constraint settlements_distinct_parties
        check (payer_user_id <> payee_user_id),

    -- Idempotency key: one settlement per transfer. Combined with
    -- transfers.client_token this makes the whole settle-up call
    -- safely retryable end to end.
    unique (transfer_id)
);

create index if not exists settlements_pair_idx
    on public.settlements (pair_low, pair_high, created_at desc);

create table if not exists public.settlement_allocations (
    settlement_id uuid not null references public.settlements(id) on delete cascade,
    share_id uuid not null references public.transaction_shares(id) on delete cascade,
    amount_eur numeric(14,2) not null check (amount_eur > 0),
    created_at timestamptz not null default now(),
    -- Idempotency key: a settlement can touch a share at most once, so the
    -- allocation loop is safe to re-run.
    primary key (settlement_id, share_id)
);

create index if not exists settlement_allocations_share_idx
    on public.settlement_allocations (share_id);
```

**Why allocations instead of flipping `transaction_shares.status = 'settled'`:** a partial settle-up ("I'll pay €50 of the €127 I owe you") must not require mutating or splitting a share row. With allocations, "settled" is *derived*: `coalesce(sum(allocations.amount_eur),0) >= share_amount_eur`. The share row stays an immutable record of what was agreed, the payment stays an immutable record of what moved, and the net balance is `obligations − payments`. This also means the net is correct even if allocation ever drifts.

### 1.7 `_nomadix_policy_backup` — the reversibility device for §3

```sql
create table if not exists public._nomadix_policy_backup (
    captured_at timestamptz not null default now(),
    schemaname text not null,
    tablename  text not null,
    policyname text not null,
    permissive text,
    roles      text,
    cmd        text,
    qual       text,
    with_check text,
    primary key (tablename, policyname, captured_at)
);

alter table public._nomadix_policy_backup enable row level security;
-- No policies at all: authenticated clients can never read it. Only
-- superuser/postgres (SQL editor) sees it.
```

---

## 2. ALTERs on the three dashboard-owned tables

All guarded with `to_regclass`, all `add column if not exists`, constraints added inside `exception when duplicate_object` blocks (because `add constraint if not exists` does not exist in Postgres).

### 2.1 `users_profile` — username + friend code

```sql
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
-- have not picked a handle yet coexist. Lowercase-only is enforced by the
-- CHECK above, so a plain unique index is already case-insensitive in
-- practice and no citext extension is needed.
create unique index if not exists users_profile_username_uidx
    on public.users_profile (username) where username is not null;
create unique index if not exists users_profile_friend_code_uidx
    on public.users_profile (friend_code) where friend_code is not null;
```

**Friend-code generator + backfill.** Alphabet excludes `I`, `O`, `0`, `1` so `NMDX-1IO0` can never be misread aloud.

```sql
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
```

> **Sizing caveat.** 32⁴ = 1,048,576 codes. The retry loop plus the unique index makes collisions correct, not just unlikely, but at ~1,000 users you already draw a duplicate on roughly half of all new signups (birthday bound), and the 50-try ceiling only becomes a real risk past ~100k users. If the product ever outgrows a few thousand accounts, widen to 6 symbols (`NMDX-4F2K9X`) — the regex and the generator are the only two places to change.

New profiles also need a code. Rather than a trigger on `users_profile` (which the dashboard owns and may already have triggers on), `nomadix_ensure_friend_code()` is called by `nomadix_bootstrap_social()` on first visit to the Friends screen — idempotent, `update … where friend_code is null`.

### 2.2 `vaults` — per-vault privacy + shared flag

```sql
do $$
begin
    if to_regclass('public.vaults') is null then
        raise notice 'vaults missing; skipping social vault columns';
        return;
    end if;

    alter table public.vaults
        -- Privacy-safe default: no backfill needed, every existing vault
        -- starts closed and the owner must opt in per vault.
        add column if not exists accepts_transfers_from text not null default 'nobody',
        add column if not exists is_shared boolean not null default false,
        add column if not exists shared_at timestamptz,
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
```

`is_shared` is denormalized from `vault_members` and maintained by a trigger (§5.13). Justification: the vault list is rendered on every dashboard load; without it, every render needs a `vault_members` join or a second round trip, and a shared badge is pure presentation. The trigger keeps it honest, so it can never disagree with the membership table.

### 2.3 `transactions` — transfer linkage + share linkage

```sql
do $$
begin
    if to_regclass('public.transactions') is null then
        raise notice 'transactions missing; skipping transfer linkage';
        return;
    end if;

    alter table public.transactions
        add column if not exists transfer_id uuid,
        add column if not exists transfer_leg text,
        add column if not exists transfer_group_id uuid,
        add column if not exists share_id uuid;

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

    begin
        alter table public.transactions
            add constraint transactions_share_id_fkey
            foreign key (share_id) references public.transaction_shares(id)
            on delete set null;
    exception when duplicate_object then null; end;
end $$;

create index if not exists transactions_transfer_id_idx
    on public.transactions (transfer_id) where transfer_id is not null;
create index if not exists transactions_transfer_group_idx
    on public.transactions (transfer_group_id) where transfer_group_id is not null;

-- NEWLY LOAD-BEARING: shared-vault reads filter by vault_id instead of
-- user_id, and nomadix_send_transfer sums a vault's balance for the
-- funds check. Without this both become seq scans.
create index if not exists transactions_vault_id_idx
    on public.transactions (vault_id);
```

Both FKs are `on delete set null`, not cascade: deleting a `transfers` row (only ever done by `nomadix_delete_transfer` for an internal transfer) must not delete the money rows out from under the user.

**Backfill of legacy two-leg transfers.** Best effort, and deliberately conservative — an ambiguous match is left `null` rather than wrongly paired. It only populates `transfer_group_id`; it never fabricates `transfers` rows, because the historical rate/fee attribution cannot be reconstructed reliably.

```sql
do $$
begin
    if to_regclass('public.transactions') is null then return; end if;

    with legs as (
        select t.id, t.user_id, t.created_at, abs(t.amount) as mag,
               case when t.description like '[Transfer → %' then 'out'
                    when t.description like '[Transfer ← %' then 'in'  end as leg
          from public.transactions t
         where t.type = 'transfer'
           and t.transfer_group_id is null
           and t.transfer_id is null
    ),
    candidates as (
        select o.id as out_id, i.id as in_id,
               abs(extract(epoch from (i.created_at - o.created_at))) as gap,
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
         where rn_out = 1 and rn_in = 1     -- mutual best match only
    )
    update public.transactions t
       set transfer_group_id = p.gid
      from paired p
     where t.id = p.out_id or t.id = p.in_id;
end $$;

-- Verification (expect 0 rows): every populated group must have exactly 2 legs.
--   select transfer_group_id, count(*) from public.transactions
--    where transfer_group_id is not null group by 1 having count(*) <> 2;
-- Orphans left behind on purpose (inspect, do not auto-fix):
--   select count(*) from public.transactions
--    where type = 'transfer' and transfer_group_id is null;
```

---

## 3. The RLS problem

### 3.1 What we are up against

`vaults` and `transactions` have policies created in the dashboard that we can neither read from this repo nor reproduce from memory. Dropping them blind is the single highest-risk operation in this whole plan: a wrong guess at a policy name silently leaves the old policy in place (with `if exists`) or, worse, a successful drop plus a subtly different recreate locks every user out of their own money or — far worse — opens everyone's rows to everyone.

### 3.2 Step 0, mandatory: audit before touching anything

Run this in the SQL editor and **paste the output into the migration as a comment block** before applying anything in Phase 3:

```sql
select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('vaults','transactions','users_profile')
 order by tablename, policyname;

-- Also confirm the definer-bypass assumption holds:
select relname, relrowsecurity, relforcerowsecurity
  from pg_class
 where relname in ('vaults','transactions','users_profile')
   and relnamespace = 'public'::regnamespace;
```

Two things decide the strategy:

* **`permissive = 'PERMISSIVE'` on every existing policy** (the default, and near-certain for dashboard-created policies) ⇒ take the **additive path** in §3.4. Nothing is dropped, nothing is lost, and the change is reversible with four `drop policy` statements.
* **`relforcerowsecurity = false`** ⇒ the `security definer` helpers actually bypass RLS. If anyone ever ran `alter table … force row level security`, the table owner is subject to its own policies and every helper below breaks. This must be checked, not assumed.

Also snapshot to a table so the old definitions survive even if someone later drops them:

```sql
insert into public._nomadix_policy_backup
    (schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
select schemaname, tablename, policyname, permissive, roles::text, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('vaults','transactions','users_profile');

-- Regenerate the DDL for any captured policy (the undo script):
-- select format(
--          'create policy %I on public.%I as %s for %s to %s%s%s;',
--          policyname, tablename,
--          case when permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
--          lower(cmd), replace(replace(roles,'{',''),'}',''),
--          coalesce(' using (' || qual || ')', ''),
--          coalesce(' with check (' || with_check || ')', ''))
--   from public._nomadix_policy_backup
--  where tablename = 'vaults' order by captured_at desc;
```

### 3.3 The helpers — which table each reads, and why each must bypass RLS

```sql
-- ---------------------------------------------------------------------------
-- nomadix_is_vault_member: reads public.vault_members ONLY. Never touches
-- public.vaults. This is the helper that the vaults SELECT policy calls, and
-- the "never touches vaults" property is what makes that safe: a policy on
-- vaults whose expression re-reads vaults through RLS raises
-- 42P17 "infinite recursion detected in policy for relation vaults".
--
-- SECURITY DEFINER for two reasons:
--   1. It bypasses RLS on vault_members, so it does not depend on
--      vault_members' own policy -- which itself calls this function.
--      That mutual reference is only safe because the definer read is
--      not an RLS-checked scan.
--   2. It gives a single, auditable definition of membership instead of
--      an EXISTS subquery duplicated across five policies.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_is_vault_member(
    p_vault_id uuid,
    p_user_id  uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select p_user_id is not null
       and exists (
           select 1 from public.vault_members m
            where m.vault_id = p_vault_id
              and m.user_id  = p_user_id
              and m.status   = 'active'
       );
$$;

revoke all on function public.nomadix_is_vault_member(uuid, uuid) from public, anon;
grant execute on function public.nomadix_is_vault_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- nomadix_can_access_vault: reads public.vaults AND public.vault_members.
-- True when the caller owns the vault or is an active co-owner.
--
-- Because it reads public.vaults, it MUST NOT be used in any policy ON
-- public.vaults -- that is the recursion the design avoids by splitting the
-- two helpers. It is used in the transactions policies, in
-- vault_transfer_allowlist, and inside every RPC.
--
-- SECURITY DEFINER so the vaults read bypasses RLS: inside a transactions
-- policy the caller frequently cannot see the vaults row under their own
-- policy (a shared vault owned by the partner), and an invoker-rights read
-- would return zero rows and deny legitimate access.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_can_access_vault(
    p_vault_id uuid,
    p_user_id  uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select p_user_id is not null
       and (
           exists (select 1 from public.vaults v
                    where v.id = p_vault_id and v.user_id = p_user_id)
        or exists (select 1 from public.vault_members m
                    where m.vault_id = p_vault_id
                      and m.user_id  = p_user_id
                      and m.status   = 'active')
       );
$$;

revoke all on function public.nomadix_can_access_vault(uuid, uuid) from public, anon;
grant execute on function public.nomadix_can_access_vault(uuid, uuid) to authenticated;

-- Owner-only variant, for settings writes. Reads public.vaults, definer for
-- the same reason (uniform behaviour whether called from a policy, an RPC,
-- or pg_cron).
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

-- Friendship predicate. Reads public.friendships; definer so it works
-- regardless of the friendships SELECT policy (which hides blocked rows
-- from the blocked party -- an invoker read would then wrongly report
-- "not friends OR blocked" as simply "not friends" in some paths and
-- "friends" in others).
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
```

**Why the split into two helpers is the whole trick.** The naive single helper reads `vaults` and gets used in the `vaults` policy → Postgres raises `42P17`. The naive inline `exists (select 1 from vault_members …)` inside the `vault_members` policy → `42P17` on `vault_members`. Splitting into (a) a members-only helper for the `vaults` policy and (b) a full helper for everything else, with both running as definer, breaks every cycle by construction, not by luck.

### 3.4 Primary path — additive policies (nothing dropped)

```sql
alter table public.vaults        enable row level security;
alter table public.transactions  enable row level security;

do $$
begin
    -- ======================= vaults =======================
    -- Widen SELECT: an active co-owner can read the vault row. ORs with the
    -- dashboard's `auth.uid() = user_id`.
    begin
        create policy "vaults_select_shared_member" on public.vaults
        as permissive for select to authenticated
        using (public.nomadix_is_vault_member(id, auth.uid()));
    exception when duplicate_object then null; end;

    -- Deliberately NO update/delete policy for members: renaming, recolouring
    -- and deleting a shared vault stay owner-only (the dashboard policy).
    -- Member-side edits, if ever wanted, go through an RPC.

    -- ===================== transactions ===================
    -- Widen SELECT/UPDATE/DELETE to rows living in a vault the caller
    -- co-owns, including rows whose user_id is the partner.
    begin
        create policy "transactions_select_shared_vault" on public.transactions
        as permissive for select to authenticated
        using (public.nomadix_can_access_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;

    begin
        create policy "transactions_update_shared_vault" on public.transactions
        as permissive for update to authenticated
        using      (public.nomadix_can_access_vault(vault_id, auth.uid()))
        with check (public.nomadix_can_access_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;

    begin
        create policy "transactions_delete_shared_vault" on public.transactions
        as permissive for delete to authenticated
        using (public.nomadix_can_access_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;

    -- TIGHTEN (restrictive => ANDed with every permissive policy):
    -- today `auth.uid() = user_id` is the ONLY check on insert, so any
    -- authenticated user can insert a transactions row pointing at a
    -- stranger's vault_id. Nothing in the app surfaces it, but it is a real
    -- integrity hole and it becomes a live attack once shared vaults exist.
    -- This closes it AND is exactly the guard shared vaults need.
    begin
        create policy "transactions_insert_must_own_vault" on public.transactions
        as restrictive for insert to authenticated
        with check (public.nomadix_can_access_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;

    begin
        create policy "transactions_update_must_own_vault" on public.transactions
        as restrictive for update to authenticated
        with check (public.nomadix_can_access_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;
end $$;
```

Notes on the restrictive policies:

* They apply `to authenticated` only. `pg_cron` runs `nomadix_charge_occurrence` as `postgres` through a definer function, which bypasses RLS entirely — the subscription charger is unaffected.
* They can only ever *deny*. Verify before shipping that `nomadix_can_access_vault` is true for every existing insert path: `create-vault-modal.tsx` (own vault, true), `new-transaction-modal.tsx` (own vault, true), `onboarding/page.tsx` (own vault, true). `transactions.vault_id` is `not null`, so there is no null-slips-through case.
* **Reversal is one statement per policy:** `drop policy "transactions_insert_must_own_vault" on public.transactions;` etc. Nothing pre-existing is disturbed.

### 3.5 Fallback path — full drop-and-recreate (only if the audit shows a RESTRICTIVE dashboard policy)

Use this **only** when `pg_policies.permissive = 'RESTRICTIVE'` for an existing policy, because then additive widening cannot work. Run inside a single transaction so a failure rolls the whole thing back, and run the §3.2 snapshot first.

```sql
begin;

-- Drop EVERY existing policy on both tables, by name, read out of
-- pg_policies -- never guessed.
do $$
declare r record;
begin
    for r in
        select policyname, tablename from pg_policies
         where schemaname = 'public' and tablename in ('vaults','transactions')
    loop
        execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

-- ------------------------------- vaults -------------------------------
create policy "vaults_select" on public.vaults
for select to authenticated
using (auth.uid() = user_id or public.nomadix_is_vault_member(id, auth.uid()));

create policy "vaults_insert_own" on public.vaults
for insert to authenticated
with check (auth.uid() = user_id);

create policy "vaults_update_own" on public.vaults
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "vaults_delete_own" on public.vaults
for delete to authenticated
using (auth.uid() = user_id);

-- ---------------------------- transactions ----------------------------
create policy "transactions_select" on public.transactions
for select to authenticated
using (auth.uid() = user_id
       or public.nomadix_can_access_vault(vault_id, auth.uid()));

create policy "transactions_insert" on public.transactions
for insert to authenticated
with check (auth.uid() = user_id
            and public.nomadix_can_access_vault(vault_id, auth.uid()));

create policy "transactions_update" on public.transactions
for update to authenticated
using (auth.uid() = user_id
       or public.nomadix_can_access_vault(vault_id, auth.uid()))
with check (public.nomadix_can_access_vault(vault_id, auth.uid()));

create policy "transactions_delete" on public.transactions
for delete to authenticated
using (auth.uid() = user_id
       or public.nomadix_can_access_vault(vault_id, auth.uid()));

-- Smoke test INSIDE the open transaction, as a real user, before commit:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
--   select count(*) from public.vaults;        -- must equal their vault count
--   select count(*) from public.transactions;  -- must equal their tx count
--   reset role;
-- If either number is 0 or suspiciously large: ROLLBACK.

commit;
```

**The residual risk, stated plainly.** If the dashboard policies also covered the `anon` role, or a service/edge path, the recreate above (scoped `to authenticated`) silently removes that access. The additive path has no such risk, which is why it is the primary plan and this is the fallback.

### 3.6 RLS on the new tables

```sql
alter table public.friendships               enable row level security;
alter table public.vault_members             enable row level security;
alter table public.vault_transfer_allowlist  enable row level security;
alter table public.transfers                 enable row level security;
alter table public.transaction_shares        enable row level security;
alter table public.settlements               enable row level security;
alter table public.settlement_allocations    enable row level security;

do $$
begin
    -- friendships: readable by both parties, EXCEPT a block is invisible to
    -- the blocked party (they see "no relationship", not "you are blocked").
    -- No write policies: all mutations go through RPCs.
    begin
        create policy "friendships_select_party" on public.friendships
        for select to authenticated
        using (auth.uid() in (user_low_id, user_high_id)
               and (status <> 'blocked' or blocked_by = auth.uid()));
    exception when duplicate_object then null; end;

    -- vault_members: my own membership rows, plus the partner's row on a
    -- vault I am active in (so the UI can render "shared with X").
    -- The second clause uses the DEFINER helper on purpose: an inline
    -- `exists (select 1 from vault_members m2 ...)` here is exactly the
    -- expression that raises 42P17 infinite recursion.
    begin
        create policy "vault_members_select" on public.vault_members
        for select to authenticated
        using (user_id = auth.uid()
               or public.nomadix_is_vault_member(vault_id, auth.uid()));
    exception when duplicate_object then null; end;

    -- vault_transfer_allowlist: owner-only, both read and write. The friend
    -- never sees whether they are on a list; they only learn it by the
    -- vault appearing in nomadix_list_transferable_vaults().
    begin
        create policy "vault_transfer_allowlist_select_owner"
        on public.vault_transfer_allowlist
        for select to authenticated
        using (public.nomadix_owns_vault(vault_id, auth.uid()));
    exception when duplicate_object then null; end;

    -- transfers: both parties read; nobody writes directly.
    begin
        create policy "transfers_select_party" on public.transfers
        for select to authenticated
        using (auth.uid() in (sender_user_id, recipient_user_id));
    exception when duplicate_object then null; end;

    -- transaction_shares: both parties read the share. NOTE this exposes
    -- share_amount and total_amount of THAT transaction to the friend --
    -- which is the point of a split, and is the ONLY amount of mine they
    -- ever see. It does not expose the transaction row itself.
    begin
        create policy "transaction_shares_select_party" on public.transaction_shares
        for select to authenticated
        using (auth.uid() in (owner_user_id, counterparty_user_id));
    exception when duplicate_object then null; end;

    begin
        create policy "settlements_select_party" on public.settlements
        for select to authenticated
        using (auth.uid() in (payer_user_id, payee_user_id));
    exception when duplicate_object then null; end;

    begin
        create policy "settlement_allocations_select_party"
        on public.settlement_allocations
        for select to authenticated
        using (exists (
            select 1 from public.settlements s
             where s.id = settlement_id
               and auth.uid() in (s.payer_user_id, s.payee_user_id)
        ));
    exception when duplicate_object then null; end;
end $$;
```

The `settlement_allocations` policy uses an inline `exists` on `settlements` rather than a helper — `settlements`' own policy does not reference `settlement_allocations`, so there is no cycle and invoker rights give exactly the right answer.

`updated_at` triggers, following the file's existing pattern:

```sql
do $$
declare t text;
begin
    foreach t in array array['friendships','vault_members','transfers','transaction_shares']
    loop
        execute format('drop trigger if exists %I on public.%I', t || '_touch_trg', t);
        execute format(
            'create trigger %I before update on public.%I
             for each row execute function public.nomadix_touch_updated_at()',
            t || '_touch_trg', t);
    end loop;
end $$;
```

---

## 4. The privacy guarantee

### 4.1 The requirement, restated as an invariant

> For any friend F of user U, and any vault V owned by U, F can learn **at most**: `V.id`, `V.name`, `V.currency`, `V.icon`, `V.color`, `V.type`, and the boolean "V accepts transfers from me". F must learn **nothing** about `sum(transactions.amount) where vault_id = V`, nor any individual amount, nor the count of transactions, nor `created_at`, nor `is_protected`.

### 4.2 Why not an RLS SELECT policy on `vaults`

A policy such as `for select using (accepts_transfers_from <> 'nobody' and nomadix_are_friends(auth.uid(), user_id))` would "work" and is a trap:

1. **RLS is row-level, not column-level.** Granting the row grants every column, present and future. `is_protected`, `created_at`, `updated_at`, `transfer_note` all leak today; the *next* column someone adds (`monthly_target`, `last_balance_cache`, …) leaks retroactively with no code change and no review.
2. **PostgREST embedding turns a readable row into a query surface.** With a FK from `transactions` to `vaults`, a friend can issue `GET /vaults?select=*,transactions(count)`. The `transactions` RLS still hides the amounts, but `count` is an aggregate over the *rows the requester can see* — and even when that returns 0, the shape of the response confirms the vault exists and is queryable. More generally, once a row is visible, every current and future relationship, aggregate (`?select=id,transactions(amount.sum())`), and `order by` becomes an oracle that must be independently re-audited. PostgREST's aggregate functions are disabled by default on Supabase today — but "disabled by default in the current config" is not an invariant I want a money-privacy guarantee resting on.
3. **RLS is deny-by-default with holes punched in it; a function is an allowlist.** Auditing "can a friend see a balance?" under RLS means reasoning about the union of every policy on every table plus PostgREST's query surface. Under a function it means reading six column names in a `returns table(...)`.
4. **Filter-predicate leakage.** Even with column-level `GRANT`s layered on top, a friend could `?order=created_at.desc` or `?is_protected=eq.true` and read information out of the *ordering and filtering*, which column grants do not cover.

The cost of the function approach: no PostgREST embedding for friend-visible vaults (the client must call the RPC and join client-side), and one `rpc()` round trip per friend profile view. For a screen that renders at most a handful of vaults, that is free.

### 4.3 The function

```sql
-- ---------------------------------------------------------------------------
-- nomadix_list_transferable_vaults: the ONLY way one user ever sees another
-- user's vaults. Returns a NARROW row type -- no balance, no transaction
-- count, no is_protected, no timestamps. Adding a column to public.vaults
-- cannot widen this; someone must edit this signature on purpose.
--
-- Denial is uniform: a non-friend, a blocked user, a user who does not
-- exist, and a user with zero open vaults all get the same empty set. The
-- function is never an oracle for "does this account exist".
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
       -- this), but then the friendship test is skipped.
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
```

Three properties worth calling out:

* `accepts_from_me` is hard-coded `true` because a vault that does not accept from me is simply absent. There is no "visible but closed" state to enumerate.
* `security definer` is what lets it read `vaults` rows the caller has no RLS access to. Without it, the `vaults` policy would filter everything out.
* The **RPC re-validates independently.** `nomadix_send_transfer` does not trust that the client got the vault id from this function; it re-runs the identical authorization branch under a row lock (§5.5). This function is a *discovery* API, not an authorization token.

Matching narrow profile lookup (never returns email; `auth.users.email` is never referenced anywhere in this design):

```sql
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
       -- Friend code: EXACT match only (a prefix search would let someone
       -- enumerate the code space). Username: exact, or prefix with >= 3 chars.
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
```

Friend-code lookup is exact-match only and the result set is capped at 5, so the 32⁴ space cannot be walked cheaply. (Add a per-user rate limit at the app layer if this ever goes public.)

Friend profiles for the friends list use the same narrow-function principle rather than an RLS policy on `users_profile` — a policy there would expose `emergency_contact`, `timezone`, `social_links`, `base_currency` and the AI-provider preferences to every friend:

```sql
create or replace function public.nomadix_list_friends()
returns table (
    friendship_id uuid,
    friend_id uuid,
    username text,
    full_name text,
    avatar_url text,
    status text,
    direction text,          -- 'incoming' | 'outgoing' | 'mutual'
    since timestamptz
) language sql stable security definer set search_path = public, pg_temp
as $$ /* joins friendships -> users_profile, six columns, nothing else */ $$;
```

---

## 5. The RPC surface

Every one of these ends with the file's standard pair:

```sql
revoke all on function public.<name>(<args>) from public, anon;
grant execute on function public.<name>(<args>) to authenticated;
```

### 5.1 `nomadix_set_username(p_username text) returns text`
Validates `auth.uid()`, lowercases and trims, re-checks `^[a-z0-9_]{3,20}$`, rejects a reserved list (`admin, nomadix, support, api, me, settings, …`), enforces a 30-day cooldown via `username_changed_at`. Writes `users_profile.username` + `username_changed_at`. Translates `unique_violation` into a clean `'Username already taken'` with errcode `23505`. Idempotent: setting the username you already own is a no-op success.

### 5.2 `nomadix_regenerate_friend_code() returns text`
Calls `nomadix_new_friend_code()` and updates the caller's row. Not idempotent by design (each call rotates), which is correct for "my code leaked". The unique index is the safety net.

### 5.3 `nomadix_send_friend_request(p_target_user_id uuid, p_note text default null) returns uuid`
Validates: authenticated, target ≠ self, target profile exists and is `discoverable`, no existing `blocked` row in either direction (raises the same generic `'Cannot send request'` for blocked, non-existent and non-discoverable, so it is not an existence oracle). Writes one `friendships` row with `on conflict (user_low_id, user_high_id) do update`:
* existing `pending` where `requested_by = the other person` → flips to `accepted` (the crossed-request case);
* existing `declined` → back to `pending` with `requested_by = me`;
* existing `accepted` → no-op, returns the id.
Idempotency comes entirely from the ordered-pair unique key: hammering the button produces one row.

### 5.4 `nomadix_respond_friend_request(p_friendship_id uuid, p_action text, p_force boolean default false) returns void`
`p_action in ('accept','decline','block','unblock','remove')`. Locks the row `for update`. `accept`/`decline` require `auth.uid() <> requested_by` and `status = 'pending'`. `block` is allowed from any state and sets `blocked_by = auth.uid()`. `unblock` requires `blocked_by = auth.uid()` and returns the pair to `declined`. `remove` (unfriend) and `block` both **refuse when the net balance with that friend is non-zero** unless `p_force` is true; with `p_force` they set every `active` share in the pair to `void` (writing the debt off) inside the same transaction, so a pair can never be dissolved leaving dangling obligations. `remove` also refuses outright if a shared vault is still live between the two — you must leave the vault first. Idempotent: re-declining a declined request is a no-op.

### 5.5 `nomadix_send_transfer(...) returns uuid` — full body

```sql
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
    -- Self-transfer: same vault in and out is always nonsense, whether the
    -- vault is personal or shared.
    if p_from_vault_id = p_to_vault_id then
        raise exception 'Source and destination vaults must be different'
            using errcode = 'invalid_parameter_value';
    end if;

    ------------------------------------------------------- idempotency
    -- A retried POST, a double click, or a React double-invoke returns the
    -- transfer that already exists instead of moving the money twice.
    if p_client_token is not null then
        select id into v_existing
          from public.transfers
         where sender_user_id = v_uid and client_token = p_client_token;
        if found then
            return v_existing;
        end if;
    end if;

    ------------------------------------------------------------- locking
    -- Lock BOTH vault rows in primary-key order. Two effects:
    --   (a) concurrent transfers between the same two vaults, in either
    --       direction, can never deadlock (every caller takes the locks in
    --       the same order);
    --   (b) a concurrent `update vaults set accepts_transfers_from='nobody'`
    --       is serialized against us, so the settings we read below are the
    --       committed truth at the moment the money moves -- not a value
    --       that was already stale when the client rendered the picker.
    perform 1
       from public.vaults
      where id in (p_from_vault_id, p_to_vault_id)
      order by id
      for update;

    select * into v_from from public.vaults where id = p_from_vault_id;
    select * into v_to   from public.vaults where id = p_to_vault_id;

    -- Uniform denial: a missing vault, someone else's vault, a vault that
    -- closed, a stranger's vault, a block -- all raise the SAME message.
    -- Anything more specific turns this RPC into an existence oracle over
    -- other people's vault ids.
    if v_from.id is null or v_to.id is null then
        raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
    end if;

    ------------------------------------------------- source authorization
    if not public.nomadix_can_access_vault(v_from.id, v_uid) then
        raise exception 'Transfer not allowed' using errcode = 'insufficient_privilege';
    end if;

    -------------------------------------------- destination authorization
    if public.nomadix_can_access_vault(v_to.id, v_uid) then
        -- Between two vaults I control (mine, or a vault I co-own):
        -- internal, no reversal window, no friendship needed.
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
    -- Single rate, USD -> EUR, same resolver the subscription charger uses.
    -- The SENDER's rate governs: they are the one committing the money, and
    -- freezing it on the transfer row means neither side can re-interpret
    -- the deal later by editing their own user_exchange_rates.
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

    -- Canonical EUR value, frozen. Used by settle-up and by every
    -- cross-currency report so nothing has to re-derive a historical rate.
    v_amount_eur := case
        when v_from.currency = 'EUR' then v_amount
        else round(v_amount * coalesce(v_rate, v_eur_rate), 2)
    end;

    -------------------------------------------------------- funds check
    -- Only for cross-user transfers. Balances are summed from transactions
    -- (there is no vaults.balance column), and this runs under the vault
    -- row lock taken above, so two concurrent sends cannot both pass.
    -- Internal transfers keep today's permissive behaviour: moving your own
    -- money negative is your business.
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

    -- OUT leg: sender's ledger. Sign convention matches the rest of the
    -- app -- negative = money leaving -- and the fee rides on the out leg
    -- exactly as the current client-side transfer does.
    -- category MUST be null: constraint transactions_transfer_no_category.
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

    -- IN leg: booked against the DESTINATION VAULT'S OWNER of record, even
    -- when that vault is shared. One vault, one user_id per row; shared
    -- visibility comes from the vault_id policies, not from user_id.
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
```

This single function also **replaces `handleTransferSubmit` in `new-transaction-modal.tsx`**: an internal vault-to-vault transfer now produces a `transfers` row and two linked legs, which is what makes the orphaned-leg bug structurally impossible from here on.

### 5.6 `nomadix_reverse_transfer(p_transfer_id uuid, p_note text default null) returns uuid`
**Caller must be `recipient_user_id`** — only the receiver returns money; a sender cannot claw funds out of someone else's vault. Locks the transfer `for update`, then asserts: `status = 'completed'`, `kind = 'friend'` (settlements and internal transfers are not reversible), `reversible_until >= now()`, and `not exists` a reversal. Writes a new `transfers` row with `kind='reversal'`, `reversal_of_transfer_id = p_transfer_id`, `group_id` copied from the original (so both appear as one episode in the UI), sender/recipient swapped, and **`amount_sent = original.amount_received`, `amount_received = original.amount_sent`, `exchange_rate = original.exchange_rate`** — the original rate is replayed so the sender is made exactly whole even if the rate moved. The fee is *not* refunded (it was a real cost); this is a product call worth confirming. Then two compensating `transactions` legs, and `update transfers set status='reversed', reversed_at=now(), reversed_by=auth.uid()` on the original. **Idempotency: the partial unique index `transfers_reversal_uidx`** — two simultaneous taps, one wins, the other gets `23505` which the function catches and turns into `'This transfer was already returned'`. A funds check applies: if the recipient already spent it, the reversal fails rather than driving their vault negative.

### 5.7 `nomadix_set_vault_transfer_policy(p_vault_id uuid, p_mode text, p_friend_ids uuid[] default '{}') returns void`
Owner-only (`nomadix_owns_vault`). Validates `p_mode in ('nobody','friends','allowlist')` and that every id in `p_friend_ids` is an accepted friend. Updates `vaults.accepts_transfers_from`, then reconciles the allowlist (`insert … on conflict do nothing` + `delete … where friend_user_id <> all(p_friend_ids)`) in one statement pair. Fully idempotent — saving the same settings twice changes nothing. Takes the `vaults` row lock, so it serializes correctly against an in-flight `nomadix_send_transfer`.

### 5.8 `nomadix_share_vault(p_vault_id uuid, p_friend_id uuid) returns uuid`
Owner-only. Validates accepted friendship, that the vault is not already shared, and that the friend is not already a live member. Inserts the owner's own `slot 1 / role='owner' / status='active'` row if it does not exist (backfilling membership for a vault created before this feature), then the invitee's `slot 2 / status='invited'` row. Returns the invite `vault_members.id`. **Idempotency: `vault_members_live_slot_uidx` and `vault_members_live_user_uidx`** — a second invite hits the index and is caught and returned as the existing invite id. Concurrency is handled entirely at the index, not by a read-then-write check.

### 5.9 `nomadix_respond_vault_share(p_member_id uuid, p_action text) returns void`
`p_action in ('accept','decline')`, caller must be `vault_members.user_id`, row must be `status='invited'`. `accept` → `status='active', joined_at=now()`, which fires the `is_shared` sync trigger. `decline` → `status='declined'`, freeing slot 2. Idempotent per state: accepting an already-active membership is a no-op.

### 5.10 `nomadix_leave_shared_vault(p_vault_id uuid) returns void`
Caller must be a live member. **The non-owner leaving** sets `status='left', left_at=now()`; the vault reverts to the owner alone, `is_shared` flips false, and — critically — **the leaver's `transactions` rows in that vault stay in the vault, reassigned to the owner** (`update transactions set user_id = <owner> where vault_id = p_vault_id and user_id = <leaver>`), because the money is in the owner's vault and deleting it would corrupt the balance. **The owner leaving** is a transfer of ownership: `vaults.user_id` moves to the co-owner, the co-owner's membership becomes `role='owner', member_slot=1`, the old owner becomes `status='left'`, and all `transactions` in the vault are reassigned to the new owner. Both branches refuse while any transfer into or out of the vault is still inside its reversal window.

### 5.11 `nomadix_create_share(p_transaction_id uuid, p_friend_id uuid, p_split_mode text, p_split_value numeric default null, p_note text default null) returns uuid`
Validates: caller owns the transaction (`transactions.user_id = auth.uid()`), the transaction's vault is **not shared** (splitting a co-owned vault's expense with a third party is out of scope and would double-count), `type in ('expense','income')` (never `transfer` or `adjustment`), friendship accepted. Computes `share_amount` from the mode — `equal` → `round(abs(amount)/2, 2)`; `amount` → `p_split_value` (must be ≤ total); `percent` → `round(abs(amount) * p_split_value / 100, 2)`. Sets `direction = 'owed_to_owner'` for an expense and `'owed_by_owner'` for income. Freezes `share_amount_eur` using `nomadix_usd_eur_rate(auth.uid())` and stores the rate. Writes the `transaction_shares` row with `on conflict (transaction_id, counterparty_user_id) do update` — **that unique pair is the idempotency key**, so editing the split updates in place and can never create a second debt for the same expense. Also stamps `transactions.share_id`.

### 5.12 `nomadix_void_share(p_share_id uuid) returns void` / `nomadix_reject_share(p_share_id uuid) returns void`
`void` is owner-side ("never mind"); `reject` is counterparty-side ("that wasn't mine"). Both refuse if the share already has any `settlement_allocations` rows — a paid debt cannot be un-agreed, it must be settled in the other direction. Both are idempotent (`where status = 'active'`).

### 5.13 `nomadix_settle_up(...) returns uuid` — full body

```sql
-- Authoritative net, caller's perspective, in frozen EUR.
-- Positive  => the friend owes the caller.
-- Negative  => the caller owes the friend.
create or replace function public.nomadix_friend_net_eur(p_friend_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with pair as (
        select case when auth.uid() < p_friend_id then auth.uid() else p_friend_id end as lo,
               case when auth.uid() < p_friend_id then p_friend_id else auth.uid() end as hi
    ),
    obligations as (
        select coalesce(sum(
                   case when s.creditor_user_id = auth.uid()
                        then  s.share_amount_eur
                        else -s.share_amount_eur end), 0) as net
          from public.transaction_shares s, pair
         where s.pair_low = pair.lo and s.pair_high = pair.hi
           and s.status = 'active'
    ),
    payments as (
        -- A payment I make reduces what I owe (moves my net UP toward 0);
        -- a payment they make reduces what they owe (moves my net DOWN).
        select coalesce(sum(
                   case when st.payer_user_id = auth.uid()
                        then  st.amount_eur
                        else -st.amount_eur end), 0) as net
          from public.settlements st, pair
         where st.pair_low = pair.lo and st.pair_high = pair.hi
    )
    select round((select net from obligations) + (select net from payments), 2)
     where auth.uid() is not null and p_friend_id is not null;
$$;

revoke all on function public.nomadix_friend_net_eur(uuid) from public, anon;
grant execute on function public.nomadix_friend_net_eur(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- nomadix_settle_up: converts what I OWE a friend into a real transfer, then
-- allocates the payment across their outstanding claims oldest-first.
--
-- Deliberately one-directional: you can only settle a debt you owe. There is
-- no branch that debits the friend's vault -- a "settle up" that pulled money
-- out of someone else's account is a bug class this design refuses to have.
-- To collect, the UI sends a nudge; the friend calls this function.
-- ---------------------------------------------------------------------------
create or replace function public.nomadix_settle_up(
    p_friend_id     uuid,
    p_from_vault_id uuid,
    p_to_vault_id   uuid,
    p_amount_eur    numeric default null,
    p_client_token  text    default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid        uuid := auth.uid();
    v_lo         uuid;
    v_hi         uuid;
    v_net        numeric;
    v_pay_eur    numeric;
    v_from_cur   text;
    v_to_owner   uuid;
    v_rate       numeric;
    v_send_amt   numeric;
    v_transfer   uuid;
    v_settlement uuid;
    v_moved_eur  numeric;
    v_remaining  numeric;
    v_take       numeric;
    r            record;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
    end if;
    if p_friend_id is null or p_friend_id = v_uid then
        raise exception 'Invalid friend' using errcode = 'invalid_parameter_value';
    end if;
    if not public.nomadix_are_friends(v_uid, p_friend_id) then
        raise exception 'Not friends' using errcode = 'insufficient_privilege';
    end if;

    v_lo := case when v_uid < p_friend_id then v_uid else p_friend_id end;
    v_hi := case when v_uid < p_friend_id then p_friend_id else v_uid end;

    -- Serialize the whole pair for this transaction. Row locks on
    -- transaction_shares alone are not enough: two concurrent settle-ups
    -- could both see "I owe 100" when there are zero share rows and only
    -- settlements (the prepayment case). The advisory lock is released
    -- automatically at commit/rollback.
    perform pg_advisory_xact_lock(
        hashtextextended(v_lo::text || ':' || v_hi::text, 42)
    );

    -- Lock the outstanding obligations so nobody voids or adds one while we
    -- allocate against them.
    perform 1
       from public.transaction_shares s
      where s.pair_low = v_lo and s.pair_high = v_hi
        and s.status = 'active'
      order by s.id
      for update;

    v_net := public.nomadix_friend_net_eur(p_friend_id);

    if v_net is null or v_net >= -0.005 then
        raise exception 'Nothing to settle with this friend'
            using errcode = 'invalid_parameter_value';
    end if;

    -- Partial settlement allowed; never more than what is owed.
    v_pay_eur := round(least(coalesce(p_amount_eur, -v_net), -v_net), 2);
    if v_pay_eur <= 0 then
        raise exception 'Settlement amount must be greater than zero'
            using errcode = 'invalid_parameter_value';
    end if;

    -- The destination MUST belong to the friend. nomadix_send_transfer would
    -- also reject a stranger's vault, but checking here gives a precise
    -- error for the one case that is not privacy-sensitive.
    select v.user_id, v.currency into v_to_owner, v_from_cur
      from public.vaults v where v.id = p_to_vault_id;
    if v_to_owner is distinct from p_friend_id then
        raise exception 'Destination vault does not belong to this friend'
            using errcode = 'invalid_parameter_value';
    end if;

    -- The net lives in EUR. Convert it into the SOURCE vault's currency so
    -- the right amount leaves my account; the send function then handles
    -- the source -> destination conversion independently. This is the
    -- currency-mismatch case: net EUR -> USD source -> EUR destination all
    -- resolve through the single USD->EUR rate.
    select v.currency into v_from_cur from public.vaults v where v.id = p_from_vault_id;
    if v_from_cur is null then
        raise exception 'Source vault not found' using errcode = 'no_data_found';
    end if;

    v_rate := public.nomadix_usd_eur_rate(v_uid);
    v_send_amt := case
        when v_from_cur = 'EUR' then v_pay_eur
        else round(v_pay_eur / v_rate, 2)      -- EUR value -> USD magnitude
    end;
    if v_send_amt <= 0 then
        raise exception 'Settlement amount rounds to zero'
            using errcode = 'invalid_parameter_value';
    end if;

    -- Reuse the one code path that knows how to authorize and book a
    -- transfer. It re-validates friendship, the destination vault's
    -- accepts_transfers_from policy, funds, and FX -- settling up gets no
    -- privileged bypass of the recipient's privacy settings.
    v_transfer := public.nomadix_send_transfer(
        p_from_vault_id,
        p_to_vault_id,
        v_send_amt,
        0,
        'Settle up',
        null,
        p_client_token
    );

    -- Retry short-circuit: if send_transfer returned a pre-existing transfer
    -- (same client_token), the settlement for it already exists. Return it
    -- instead of double-allocating.
    select id into v_settlement
      from public.settlements where transfer_id = v_transfer;
    if found then
        return v_settlement;
    end if;

    -- A settlement is never reversible: a "return" would un-pay debts whose
    -- allocations have already been written.
    update public.transfers
       set kind = 'settlement',
           reversible_until = null,
           updated_at = now()
     where id = v_transfer;

    -- Book the payment at the EUR value the transfer actually moved, not the
    -- requested value, so rounding can never drift the ledger.
    select amount_eur into v_moved_eur from public.transfers where id = v_transfer;

    insert into public.settlements (
        payer_user_id, payee_user_id, amount_eur,
        net_eur_at_settlement, transfer_id, note
    ) values (
        v_uid, p_friend_id, v_moved_eur, v_net, v_transfer, 'Settle up'
    )
    returning id into v_settlement;

    ---------------------------------------------------------------------
    -- Allocate the payment across the friend's outstanding claims,
    -- oldest first. "Settled" is DERIVED: a share is settled once its
    -- allocations sum to share_amount_eur. Nothing mutates the share row,
    -- so a partial settle-up needs no row splitting and the audit trail
    -- stays immutable.
    ---------------------------------------------------------------------
    v_remaining := v_moved_eur;

    for r in
        select s.id,
               s.share_amount_eur
             - coalesce((select sum(a.amount_eur)
                           from public.settlement_allocations a
                          where a.share_id = s.id), 0) as outstanding
          from public.transaction_shares s
         where s.pair_low = v_lo and s.pair_high = v_hi
           and s.status = 'active'
           and s.creditor_user_id = p_friend_id     -- claims AGAINST me
         order by s.created_at asc, s.id asc
    loop
        exit when v_remaining <= 0;
        continue when r.outstanding <= 0;

        v_take := least(v_remaining, r.outstanding);

        insert into public.settlement_allocations (settlement_id, share_id, amount_eur)
        values (v_settlement, r.id, round(v_take, 2))
        on conflict (settlement_id, share_id) do nothing;

        v_remaining := round(v_remaining - v_take, 2);
    end loop;

    -- v_remaining > 0 here means I overpaid relative to the itemized
    -- claims (possible when the net was moved by a prior direct transfer).
    -- That is fine and intentional: the leftover shows up as a positive
    -- net in friend_net_balances -- a credit -- rather than being lost.

    return v_settlement;
end $$;

revoke all on function public.nomadix_settle_up(uuid, uuid, uuid, numeric, text)
    from public, anon;
grant execute on function public.nomadix_settle_up(uuid, uuid, uuid, numeric, text)
    to authenticated;
```

### 5.14 Guard triggers (the orphaned-leg fix, enforced)

```sql
-- Deleting or editing ONE leg of a linked transfer is the bug we are here to
-- kill. This trigger is SECURITY DEFINER because the sibling leg may belong
-- to the other user, whose rows the invoker cannot touch under RLS.
create or replace function public.nomadix_guard_transfer_leg()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_transfer public.transfers%rowtype;
begin
    -- Recursion guard: when we delete the sibling below, this trigger fires
    -- again at depth 2 and must pass straight through.
    if pg_trigger_depth() > 1 then
        return coalesce(new, old);
    end if;

    if tg_op = 'DELETE' then
        if old.transfer_id is null then return old; end if;

        select * into v_transfer from public.transfers
         where id = old.transfer_id for update;
        if not found then return old; end if;

        if v_transfer.kind <> 'internal' then
            raise exception
                'This is one leg of a transfer with another person. Use the Return action instead.'
                using errcode = 'insufficient_privilege';
        end if;
        if v_transfer.sender_user_id <> auth.uid() then
            raise exception 'Not authorized' using errcode = 'insufficient_privilege';
        end if;

        -- Internal transfer: delete BOTH legs and the transfer row together.
        delete from public.transactions
         where transfer_id = v_transfer.id and id <> old.id;
        delete from public.transfers where id = v_transfer.id;
        return old;
    end if;

    -- UPDATE: the money-bearing fields of a leg are immutable. Description
    -- and category stay editable (category is already forced null for
    -- transfers by transactions_transfer_no_category).
    if new.transfer_id is not null then
        if new.amount is distinct from old.amount
           or new.vault_id is distinct from old.vault_id
           or new.type    is distinct from old.type
           or new.fee     is distinct from old.fee
           or new.date    is distinct from old.date
           or new.transfer_id is distinct from old.transfer_id
           or new.transfer_leg is distinct from old.transfer_leg then
            raise exception
                'Transfer legs cannot be edited directly. Use nomadix_edit_internal_transfer or delete the transfer.'
                using errcode = 'insufficient_privilege';
        end if;
    end if;

    return new;
end $$;

do $$
begin
    if to_regclass('public.transactions') is not null then
        drop trigger if exists transactions_transfer_leg_guard on public.transactions;
        create trigger transactions_transfer_leg_guard
            before update or delete on public.transactions
            for each row execute function public.nomadix_guard_transfer_leg();
    end if;
end $$;


-- Keep vaults.is_shared honest.
create or replace function public.nomadix_sync_vault_is_shared()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_vault uuid := coalesce(new.vault_id, old.vault_id);
begin
    update public.vaults v
       set is_shared = (select count(*) from public.vault_members m
                         where m.vault_id = v_vault and m.status = 'active') > 1,
           shared_at = case
               when (select count(*) from public.vault_members m
                      where m.vault_id = v_vault and m.status = 'active') > 1
                    and v.shared_at is null then now()
               when (select count(*) from public.vault_members m
                      where m.vault_id = v_vault and m.status = 'active') <= 1
                    then null
               else v.shared_at end,
           updated_at = now()
     where v.id = v_vault;
    return coalesce(new, old);
end $$;

drop trigger if exists vault_members_sync_shared_trg on public.vault_members;
create trigger vault_members_sync_shared_trg
    after insert or update or delete on public.vault_members
    for each row execute function public.nomadix_sync_vault_is_shared();


-- Readable errors instead of raw FK violations when deleting a vault.
create or replace function public.nomadix_guard_vault_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if exists (select 1 from public.vault_members m
                where m.vault_id = old.id and m.status in ('active','invited')
                  and m.user_id <> old.user_id) then
        raise exception 'This vault is shared. Ask the co-owner to leave (or dissolve it) first.'
            using errcode = 'foreign_key_violation';
    end if;

    if exists (select 1 from public.transfers t
                where (t.sender_vault_id = old.id or t.recipient_vault_id = old.id)
                  and t.status = 'completed'
                  and t.reversible_until is not null
                  and t.reversible_until > now()) then
        raise exception 'A transfer involving this vault can still be returned. Try again after the 24-hour window.'
            using errcode = 'foreign_key_violation';
    end if;

    if exists (
        select 1 from public.transaction_shares s
          join public.transactions t on t.id = s.transaction_id
         where t.vault_id = old.id and s.status = 'active'
    ) then
        raise exception 'This vault has unsettled shared expenses. Settle or void them first.'
            using errcode = 'foreign_key_violation';
    end if;

    return old;
end $$;

do $$
begin
    if to_regclass('public.vaults') is not null then
        drop trigger if exists vaults_social_delete_guard on public.vaults;
        create trigger vaults_social_delete_guard
            before delete on public.vaults
            for each row execute function public.nomadix_guard_vault_delete();
    end if;
end $$;
```

### 5.15 `nomadix_edit_internal_transfer(...)` / `nomadix_delete_transfer(uuid)`
The escape hatches the guard trigger points at. `edit` rewrites both legs and the `transfers` row atomically (amount, fee, note, date, rate) and refuses on any `kind <> 'internal'`. `delete` deletes both legs plus the `transfers` row for an internal transfer only. Together they replace the current `transaction-edit-modal.tsx` / `transaction-detail-modal.tsx` direct writes for transfer rows.

### 5.16 `nomadix_wipe_account() returns void`
Replaces the parallel `Promise.all` deletes in `settings/data/page.tsx`, which will now fail (FK `restrict` on `transfers`, plus the leg guard). Runs in order inside one transaction: dissolve shared vaults (transfer ownership to the co-owner, or clear membership), void all `active` shares in both directions, refuse if any transfer is still inside its reversal window, null out `users_profile.username`/`friend_code` so the handle is released, delete `friendships`, then the user's own vaults/transactions/subscriptions. Money already transferred to friends is never clawed back.

---

## 6. Net balance per friend: a view

```sql
create or replace view public.friend_net_balances
with (security_invoker = true) as
with obligations as (
    select s.pair_low, s.pair_high,
           sum(case when s.creditor_user_id = s.pair_low
                    then  s.share_amount_eur
                    else -s.share_amount_eur end) as net_low,
           count(*) filter (where true) as share_count,
           max(s.created_at) as last_activity
      from public.transaction_shares s
     where s.status = 'active'
     group by s.pair_low, s.pair_high
),
payments as (
    select st.pair_low, st.pair_high,
           sum(case when st.payer_user_id = st.pair_low
                    then  st.amount_eur
                    else -st.amount_eur end) as net_low,
           0::bigint as share_count,
           max(st.created_at) as last_activity
      from public.settlements st
     group by st.pair_low, st.pair_high
),
merged as (
    select pair_low, pair_high,
           sum(net_low) as net_low,
           sum(share_count) as share_count,
           max(last_activity) as last_activity
      from (select * from obligations
            union all
            select * from payments) z
     group by pair_low, pair_high
)
-- Two rows per pair, one per perspective, so the client filters on
-- viewer_id = auth.uid() and reads a signed number with no CASE.
-- net_eur > 0 => the friend owes the viewer.
select m.pair_low  as viewer_id,
       m.pair_high as friend_id,
       round(m.net_low, 2) as net_eur,
       m.share_count,
       m.last_activity
  from merged m
union all
select m.pair_high,
       m.pair_low,
       round(-m.net_low, 2),
       m.share_count,
       m.last_activity
  from merged m;

revoke all on public.friend_net_balances from public, anon;
grant select on public.friend_net_balances to authenticated;
```

**Why a view and not a materialized view or a stored aggregate column:**

* **A materialized view has no RLS.** Postgres does not apply row security to matviews, so `select * from friend_net_balances_mv` would hand every authenticated user every user's debts. Making it safe requires wrapping it in a definer function anyway, at which point the matview bought nothing but staleness.
* **Staleness here is a money bug, not a UX wrinkle.** Settle-up sizes a real transfer from the net. A matview refreshed on a cron would let someone settle €127 of a debt that is now €40 — and the leftover would sit as a phantom credit. The one place that must be exact (`nomadix_settle_up`) recomputes under an advisory lock regardless, so a matview would exist purely to serve a number the write path deliberately ignores.
* **Volume is trivial.** A user has tens of friends and hundreds of shares over the app's lifetime. `transaction_shares_pair_active_idx` makes each pair's aggregate an index scan over a handful of rows.
* **`security_invoker = true`** (PG15+; Supabase runs 15/17) makes the underlying RLS apply as the caller, so the view leaks nothing that `transaction_shares` and `settlements` don't already permit. The two-row-per-pair shape is safe precisely because RLS already restricted the input rows to the viewer's own pairs. *If the project is ever on PG14, replace the view with `nomadix_list_friend_balances()` returning the same columns as a definer function filtered on `auth.uid()`.*

A stored `friend_balances.net_eur` column updated by triggers was rejected outright: it introduces a second source of truth that can silently drift from the ledger, and reconciling it needs the exact same query as the view.

---

## 7. Phasing — four increments, none of which breaks the running app

Each phase is appended to `supabase/schema.sql`, applied through the Supabase SQL editor, and is independently re-runnable.

### Phase 1 — Identity + friends (zero risk)
`users_profile` ALTERs, `nomadix_new_friend_code` + backfill, `friendships` + RLS, `nomadix_are_friends`, `nomadix_set_username`, `nomadix_regenerate_friend_code`, `nomadix_find_user`, `nomadix_send_friend_request`, `nomadix_respond_friend_request`, `nomadix_list_friends`.
No policy touches `vaults`/`transactions`. Nothing existing changes behaviour. **PostgREST reload REQUIRED** — new columns on `users_profile` (otherwise `PGRST204 column "username" not found in schema cache` on the profile update) and five new RPCs (otherwise `PGRST202`).

### Phase 2 — Transfers ledger + vault privacy (fixes the orphaned-leg bug)
`transfers` table + RLS, `vaults` privacy ALTERs, `vault_transfer_allowlist`, `transactions` ALTERs + legacy backfill, `nomadix_owns_vault`, `nomadix_is_vault_member`, `nomadix_can_access_vault` (defined here even though `vault_members` arrives in Phase 3 — so create an empty `vault_members` in Phase 2 or define the helpers in Phase 3; **create `vault_members` in Phase 2** so the helper compiles and always returns owner-only results until Phase 3), `nomadix_list_transferable_vaults`, `nomadix_send_transfer`, `nomadix_reverse_transfer`, `nomadix_set_vault_transfer_policy`, `nomadix_edit_internal_transfer`, `nomadix_delete_transfer`, the leg-guard trigger, the vault-delete guard.
Still **no RLS change on `vaults`/`transactions`** — everything works because the RPCs are definer. Deploy the client change that routes transfers through `nomadix_send_transfer` in the *same* release as this phase, because the leg guard starts rejecting direct edits of any *new* transfer leg the moment it exists (legacy legs have `transfer_id is null` and stay editable). **PostgREST reload REQUIRED** — new `transactions`/`vaults` columns, the new `transactions → transfers` FK (needed for `?select=*,transfers(*)` embedding), and the new RPCs.

### Phase 3 — Shared vaults (the RLS phase — do the §3.2 audit first)
Run the policy audit and the snapshot insert. Then `vault_members` invite/accept RPCs, `is_shared` sync trigger, and the additive `vaults`/`transactions` policies from §3.4.
Verify immediately, as a real user, before announcing the feature:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
select count(*) from public.vaults;                      -- unchanged
select count(*) from public.transactions;                -- unchanged
insert into public.transactions (user_id, vault_id, amount, type, original_currency)
values (auth.uid(), '<a stranger''s vault id>', -1, 'expense', 'EUR');  -- must FAIL
reset role;
```
This is the only phase with a rollback plan worth rehearsing: four `drop policy` statements. **PostgREST reload REQUIRED** — new `vault_members` table and RPCs. Policy changes alone do *not* need a reload, but the table does.

### Phase 4 — Splits + settle up
`transaction_shares`, `settlements`, `settlement_allocations` + RLS, the `friend_net_balances` view + grant, `nomadix_friend_net_eur`, `nomadix_create_share`, `nomadix_void_share`, `nomadix_reject_share`, `nomadix_settle_up`, `nomadix_wipe_account`. Extend `nomadix_respond_friend_request` with the non-zero-balance guard (it is a `create or replace`, so it lands cleanly on Phase 1's version). **PostgREST reload REQUIRED** — new tables, a new view (PostgREST will not expose `/friend_net_balances` until reloaded), and new RPCs.

Reload, after every phase:
```sql
notify pgrst, 'reload schema';
-- or: Supabase Dashboard -> Settings -> API -> Reload schema
```
Matching the note already at the top of the subscriptions block in `schema.sql`.

**One cross-cutting client consequence to hand to the UI half:** every existing read is `.eq("user_id", user.id)`. That is *why* Phase 3 is safe — the partner's rows in a shared vault do not suddenly appear on existing screens. It is also why shared-vault balances will be *wrong* until the vault/transaction reads switch from `user_id` filtering to `.in("vault_id", accessibleVaultIds)`. That is a UI change, not a SQL one, but it is a hard dependency of Phase 3 being useful.

---

## 8. TypeScript interfaces to add to `src/types/index.ts`

Unions first, matching the file's existing style (`TransactionType`, `SubscriptionStatus`, …):

```
FriendshipStatus      = "pending" | "accepted" | "declined" | "blocked"
FriendshipDirection   = "incoming" | "outgoing" | "mutual"
VaultTransferPolicy   = "nobody" | "friends" | "allowlist"
VaultMemberStatus     = "invited" | "active" | "declined" | "left" | "removed"
VaultMemberRole       = "owner" | "member"
TransferKind          = "internal" | "friend" | "settlement" | "reversal"
TransferStatus        = "completed" | "reversed"
TransferLeg           = "out" | "in"
SplitMode             = "equal" | "amount" | "percent"
ShareDirection        = "owed_to_owner" | "owed_by_owner"
ShareStatus           = "active" | "void" | "rejected"
```

New row interfaces (one per table, column-for-column, `numeric → number`, `timestamptz/date → string`, nullable columns as `| null`):

* `Friendship` — mirrors `public.friendships`
* `VaultMember` — mirrors `public.vault_members`
* `VaultTransferAllowlistEntry` — mirrors `public.vault_transfer_allowlist`
* `Transfer` — mirrors `public.transfers`
* `TransactionShare` — mirrors `public.transaction_shares` (include the three generated columns `pair_low`, `pair_high`, `creditor_user_id` as readonly)
* `Settlement` — mirrors `public.settlements`
* `SettlementAllocation` — mirrors `public.settlement_allocations`

RPC / view return shapes (these are *not* tables — keep them visibly distinct so nobody tries to `.from()` them):

* `FriendNetBalance` — `{ viewer_id, friend_id, net_eur, share_count, last_activity }`, the `friend_net_balances` view
* `TransferableVault` — `{ vault_id, name, currency: Currency, vault_type: VaultType, icon, color, accepts_from_me: boolean }`, exactly `nomadix_list_transferable_vaults`. **Deliberately has no `balance` field — this is the type that encodes the privacy guarantee in the type system.**
* `UserSearchResult` — `{ user_id, username, full_name, avatar_url, friendship_status: FriendshipStatus | "none" }`
* `FriendSummary` — `{ friendship_id, friend_id, username, full_name, avatar_url, status, direction, since }`

Extensions to the three existing interfaces:

* `UserProfile` += `username: string | null`, `friend_code: string | null`, `username_changed_at: string | null`, `discoverable: boolean`
* `Vault` += `accepts_transfers_from: VaultTransferPolicy`, `is_shared: boolean`, `shared_at: string | null`, `transfer_note: string | null`
* `Transaction` += `transfer_id: string | null`, `transfer_leg: TransferLeg | null`, `transfer_group_id: string | null`, `share_id: string | null`

Composed types, following the existing `SubscriptionWithVault` pattern:

* `TransferWithVaults extends Transfer` += `sender_vault: Pick<Vault,"name"|"currency"|"icon">`, `recipient_vault: …`, `counterparty: Pick<FriendSummary,"username"|"full_name"|"avatar_url">`
* `SharedVault extends VaultWithBalance` += `members: VaultMember[]`, `partner: FriendSummary`
* `TransactionWithShare extends Transaction` += `share: TransactionShare | null`

---

## 9. Edge cases and failure modes

| # | Case | Mechanism |
|---|---|---|
| 1 | **Self-transfer, same vault** | `transfers_distinct_vaults` check + an explicit early raise in `nomadix_send_transfer` so the user gets a readable message instead of a constraint name. |
| 2 | **Transfer to my own other vault via the friend flow** | Not an error. `nomadix_can_access_vault(to)` is true → `kind='internal'`, no friendship check, no reversal window, `transfers_internal_not_reversible` enforces it. |
| 3 | **Destination stopped accepting transfers mid-flight** | The `for update` on both `vaults` rows serializes against the owner's `nomadix_set_vault_transfer_policy` (which also takes the row lock). Whichever commits first wins; the settings read happens strictly after the lock is held, so we never authorize on a stale value. |
| 4 | **Friend removed me from the allowlist between the picker rendering and Send** | Same lock. The allowlist read is inside the locked section, and `nomadix_set_vault_transfer_policy` holds the vault row lock while it rewrites the list. |
| 5 | **Reversing an already-reversed transfer** | `transfers_reversal_uidx` (partial unique on `reversal_of_transfer_id`). Belt: `status='completed'` re-read under `for update`. Two simultaneous taps → one wins, the loser's `23505` is caught and rethrown as `'Already returned'`. |
| 6 | **Reversing after the 24-hour window** | `reversible_until >= now()` checked under the row lock. There is deliberately no cron job expiring transfers — the timestamp *is* the state, so there is nothing to fall behind. |
| 7 | **Recipient already spent the money, then reverses** | The reversal calls the same funds check as a friend transfer; it fails with `'Insufficient funds'` rather than driving their vault negative and creating a debt nobody agreed to. |
| 8 | **Reversal at a different exchange rate** | The reversal replays `original.exchange_rate` and swaps `amount_sent`/`amount_received`, so the sender is returned the exact figure that left their vault. FX drift is absorbed by the returner, which is the correct place for it. |
| 9 | **Deleting one leg of a linked transfer** | `nomadix_guard_transfer_leg` BEFORE DELETE: cross-user → hard raise pointing at the Return action; internal → cascades to the sibling leg and the `transfers` row inside one transaction, with `pg_trigger_depth()` breaking the recursion. |
| 10 | **Editing the amount on one leg** | Same trigger, BEFORE UPDATE: `amount`, `vault_id`, `type`, `fee`, `date`, `transfer_id`, `transfer_leg` are immutable on any leg. Description stays editable. Route: `nomadix_edit_internal_transfer`. |
| 11 | **Legacy `[Transfer → X]` rows** | `transfer_id is null` → the guard passes them straight through, so old data stays exactly as editable as it is today. Only `transfer_group_id` is backfilled, and only for mutually-unambiguous pairs. |
| 12 | **Deleting a vault that has pending shares / a co-owner / a reversible transfer** | `nomadix_guard_vault_delete` BEFORE DELETE raises one of three specific messages. `transfers.*_vault_id` is `on delete restrict` as the last-resort backstop if the trigger is ever dropped. `vault-card.tsx`'s bare `.delete().eq("id", id)` will now surface a real error, which the UI must render. |
| 13 | **Unfriending / blocking with a non-zero net balance** | `nomadix_respond_friend_request('remove'\|'block')` computes `nomadix_friend_net_eur` and refuses unless `p_force`. With `p_force` it voids every `active` share in the pair in the same transaction — a write-off, never a silent orphan. |
| 14 | **Unfriending while a shared vault is live** | Refused unconditionally (no force). The vault must be left/dissolved first, otherwise `nomadix_is_vault_member` would keep granting the ex-friend full read/write on the vault — friendship and membership are independent grants and membership is the stronger one. |
| 15 | **Currency mismatch on settle-up** | The net is canonical EUR. `nomadix_settle_up` converts EUR → source-vault currency with `nomadix_usd_eur_rate(payer)`, then `nomadix_send_transfer` independently converts source → destination. The settlement is booked at `transfers.amount_eur` (what actually moved), never at the requested figure, so double-rounding cannot drift the ledger. |
| 16 | **Both sides settle up simultaneously** | `pg_advisory_xact_lock` on the ordered pair hash serializes the entire settle-up for that pair. The second caller recomputes the net after the first commits and finds nothing (or less) to settle. |
| 17 | **Settle-up retried after a network timeout** | `p_client_token` → `nomadix_send_transfer` returns the existing transfer; `settle_up` then finds the existing `settlements` row via `unique (transfer_id)` and returns it without re-allocating. End-to-end idempotent. |
| 18 | **Overpaying (net moved by a direct transfer since the share was created)** | `least(requested, -net)` caps the payment; any unallocated remainder surfaces as a positive net (a credit) rather than being dropped. |
| 19 | **"Settle up" when the friend owes *me*** | Not supported by design — the RPC raises. A function that could debit a vault the caller does not control is a class of bug this design refuses to have. The UI sends a nudge; the debtor settles. |
| 20 | **Splitting a transfer or an adjustment** | `nomadix_create_share` rejects `type not in ('expense','income')`. Splitting a transfer would double-count (it is already someone else's income leg), and an adjustment is a correction, not spending. |
| 21 | **Splitting an expense in a shared vault** | Rejected. The co-owner already sees the full amount; a three-way obligation across a co-owned vault is out of scope and would double-count against the co-owner. |
| 22 | **Deleting a transaction that has an active share** | `transaction_shares.transaction_id` is `on delete cascade` — the debt dies with the expense. But if the share already has allocations (it was partly paid), the cascade would destroy a paid obligation. Add a BEFORE DELETE branch to `nomadix_guard_transfer_leg` that raises when `exists(settlement_allocations for this transaction's shares)`. **This is the one thing in this design that needs explicit attention during Phase 4 implementation.** |
| 23 | **Shared vault where one member deletes their account** | `auth.users` deletion cascades to `vaults.user_id` → the co-owner loses the vault *and their own transactions inside it*. There is no service role and no way to hook `auth.users` deletion from the client. Mitigation: `nomadix_wipe_account()` is called *before* sign-out/deletion and dissolves shared vaults first (ownership transfers to the co-owner, transactions reassigned). Optional hardening for the SQL editor: a `before delete on auth.users` trigger calling the same dissolve logic, which catches the "deleted from the Supabase dashboard" path too — flagged as optional because it touches an Auth-owned table. |
| 24 | **Existing parallel account-wipe in `settings/data/page.tsx`** | It deletes `transactions` and `vaults` in a `Promise.all` (unordered) and will now fail on the leg guard and the `transfers` FK. It must be replaced by `nomadix_wipe_account()` in the same release as Phase 4. |
| 25 | **Username / friend-code collisions under concurrency** | Partial unique indexes are the arbiter; the RPCs catch `unique_violation` and return a clean message. The friend-code generator retries 50× and then raises rather than looping forever. |
| 26 | **Error messages as an existence oracle** | Every denial in `nomadix_send_transfer` uses the identical `'Transfer not allowed' / insufficient_privilege`. `nomadix_find_user` treats non-existent, non-discoverable and blocking users identically (empty set). `nomadix_list_transferable_vaults` returns an empty set for a stranger and for a friend with no open vaults. |
| 27 | **`transactions_transfer_no_category` violation** | Every transfer leg this design writes sets `category = null` explicitly. Any future RPC that writes a `type='transfer'` row must too. |
| 28 | **`force row level security` on `vaults`/`transactions`** | Would break every `security definer` helper silently (they'd start returning false, denying legitimate access rather than leaking). The §3.2 audit checks `pg_class.relforcerowsecurity` before Phase 3 for exactly this reason. |
| 29 | **A share created against a friend who later blocks me** | The share row survives (both parties keep the SELECT policy — the `friendships` visibility rule hides the block, not the debt). The net balance stays visible so it can be settled or written off. Only the *creation* of new shares is gated on `nomadix_are_friends`. |
| 30 | **Zero-amount split (`percent` rounds to 0.00)** | `share_amount >= 0` permits it and the net view contributes 0 — harmless, but `nomadix_create_share` should reject `share_amount = 0` with `'Split rounds to zero'` rather than creating a meaningless obligation. |

---

### Critical Files for Implementation
- `/Users/chrizz/Documents/Desarrollo/Nomad/supabase/schema.sql` — all four phases append here
- `/Users/chrizz/Documents/Desarrollo/Nomad/src/types/index.ts` — §8 interfaces
- `/Users/chrizz/Documents/Desarrollo/Nomad/src/components/vaults/new-transaction-modal.tsx` — `handleTransferSubmit` must move to `nomadix_send_transfer` in the Phase 2 release
- `/Users/chrizz/Documents/Desarrollo/Nomad/src/app/dashboard/settings/data/page.tsx` — the parallel account-wipe breaks under the new FKs and guards; must call `nomadix_wipe_account()`
- `/Users/chrizz/Documents/Desarrollo/Nomad/src/app/dashboard/vaults/page.tsx` — the `.eq("user_id", …)` reads must become `vault_id`-scoped for shared-vault balances to be correct