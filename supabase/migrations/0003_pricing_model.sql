-- 0003_pricing_model.sql
--
-- Migrates the live monetization model from a recurring Razorpay *subscription*
-- to a one-time "Lifetime Unlock" (Razorpay Order) plus consumable credit packs.
--
-- ┌─ TABLE RENAME ──────────────────────────────────────────────────────────┐
-- │ public.subscriptions is RENAMED to public.entitlements. It no longer     │
-- │ models a recurring subscription — it holds a one-time `plan`, consumable  │
-- │ credit balances, and a monthly YouTube counter. The data is preserved    │
-- │ (ALTER ... RENAME), nothing is dropped that holds user data.             │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ⚠️ THIS FILE IS THE ONLY PLACE THE LIVE SCHEMA CHANGES. 0001/0002 are already
--    applied to the live DB and must NOT be edited. Everything here is an
--    ALTER/CREATE against the running schema.
--
-- ⚠️ DEPLOY ORDER — apply this migration AND redeploy these functions together:
--      import-url, import-youtube, ai-nutrition, razorpay-create-order,
--      razorpay-webhook
--    The currently-deployed functions reference the old `subscriptions` table
--    and `plan_id`/`status` columns; in the window between this migration and
--    their redeploy they will error. (Pre-launch / test-mode → negligible.)
--
-- Idempotent where it matters: renames are guarded by DO blocks, and
-- policies/triggers/constraints are dropped before being (re)created.

begin;

-- ── 1. Rename subscriptions → entitlements ─────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'subscriptions'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'entitlements'
  ) then
    alter table public.subscriptions rename to entitlements;
  end if;
end $$;

alter index if exists public.idx_subscriptions_user_id
  rename to idx_entitlements_user_id;

-- updated_at trigger: rename for clarity (reuses the existing set_updated_at fn).
drop trigger if exists trg_subscriptions_updated_at on public.entitlements;
drop trigger if exists trg_entitlements_updated_at on public.entitlements;
create trigger trg_entitlements_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- ── 2. Repurpose plan_id (free|premium_*) → plan (free|lifetime) ────────────
-- Drop the old inline CHECK (auto-named subscriptions_plan_id_check) first so
-- the value remap below isn't rejected.
alter table public.entitlements drop constraint if exists subscriptions_plan_id_check;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entitlements'
      and column_name = 'plan_id'
  ) then
    alter table public.entitlements rename column plan_id to plan;
  end if;
end $$;

-- Remap legacy tiers. Written so a re-run is harmless (lifetime/free stay put).
update public.entitlements set plan = 'lifetime'
  where plan in ('premium_monthly', 'premium_yearly');
update public.entitlements set plan = 'free'
  where plan is null or plan not in ('free', 'lifetime');

alter table public.entitlements alter column plan set default 'free';
alter table public.entitlements alter column plan set not null;
alter table public.entitlements drop constraint if exists entitlements_plan_check;
alter table public.entitlements
  add constraint entitlements_plan_check check (plan in ('free', 'lifetime'));

-- ── 3. New entitlement / credit columns ────────────────────────────────────
alter table public.entitlements
  add column if not exists lifetime_purchased_at      timestamptz,
  add column if not exists youtube_credits            integer not null default 0,
  add column if not exists ai_credits                 integer not null default 0,
  add column if not exists youtube_imports_this_month integer not null default 0,
  add column if not exists youtube_month_anchor       date;

-- ── 4. Drop subscription-only columns ──────────────────────────────────────
-- These modelled a recurring subscription state machine that no longer exists.
-- KEEP recipe_count (the free-tier saved-recipe counter) and razorpay_customer_id
-- (still used to associate a Razorpay customer with the user).
alter table public.entitlements drop column if exists razorpay_subscription_id;
alter table public.entitlements drop column if exists current_period_end;
alter table public.entitlements drop column if exists status;

-- ── 5. Default-row trigger: seed free plan with zeroed credits ─────────────
-- Same trigger wiring (trg_users_default_sub on public.users still calls this
-- function) — only the body changes to target entitlements with the new shape.
create or replace function public.create_default_subscription()
returns trigger language plpgsql as $$
begin
  insert into public.entitlements (user_id, plan) values (new.id, 'free');
  return new;
end; $$;

-- ── 6. payments: one row per Razorpay order ────────────────────────────────
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  razorpay_order_id   text unique,
  razorpay_payment_id text,
  product             text not null check (product in ('lifetime', 'yt_credits', 'ai_credits')),
  amount_paise        integer not null,
  status              text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_payments_user_id  on public.payments(user_id);
create index if not exists idx_payments_order_id on public.payments(razorpay_order_id);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ── 7. Atomic credit mutators (service-role ONLY) ──────────────────────────
-- Consumed by the gating code (deduct) and the Razorpay webhook (add). These
-- run with the service-role key from Edge Functions (which bypasses RLS).
--
-- SECURITY: a client JWT (the `authenticated` role) must NEVER be able to call
-- these — that would let a user mint themselves credits. EXECUTE is revoked
-- from public/anon/authenticated and granted only to service_role below.

-- Conditionally deduct AI credits; returns the new balance, or NULL if the user
-- didn't have enough (the WHERE guard makes the check + decrement atomic).
create or replace function public.deduct_ai_credits(p_user_id uuid, p_amount integer)
returns integer language sql as $$
  update public.entitlements
     set ai_credits = ai_credits - p_amount
   where user_id = p_user_id and ai_credits >= p_amount
  returning ai_credits;
$$;

-- Add credits (used by the webhook after a captured payment).
create or replace function public.add_credits(p_user_id uuid, p_yt_delta integer, p_ai_delta integer)
returns void language sql as $$
  update public.entitlements
     set youtube_credits = youtube_credits + p_yt_delta,
         ai_credits       = ai_credits + p_ai_delta
   where user_id = p_user_id;
$$;

revoke execute on function public.deduct_ai_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.add_credits(uuid, integer, integer) from public, anon, authenticated;
grant  execute on function public.deduct_ai_credits(uuid, integer) to service_role;
grant  execute on function public.add_credits(uuid, integer, integer) to service_role;

-- ── 8. RLS ─────────────────────────────────────────────────────────────────
-- entitlements: the old "subscriptions_select_own" policy auto-followed the
-- table rename but kept its old name — replace it with a correctly-named one
-- (identical rule: owner-only SELECT; all writes via service role).
drop policy if exists "subscriptions_select_own" on public.entitlements;
drop policy if exists "entitlements_select_own"  on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using (user_id = public.current_user_id());

-- payments: read-only for the owner; all writes via service role (Edge Functions).
alter table public.payments enable row level security;
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (user_id = public.current_user_id());

commit;
