-- 0006_play_billing.sql
-- Google Play Billing replaces Razorpay. This table is the idempotency ledger for
-- verified Play purchases: the `play-verify-purchase` Edge Function inserts a row
-- (keyed on the Play purchaseToken) BEFORE granting, so a re-delivered or replayed
-- purchase can never grant twice.
--
-- Writes happen only via the service-role Edge Function. RLS is enabled with NO
-- policies, so owners can't read or write it directly (same posture as the credit
-- RPCs) — the service role bypasses RLS.

create table if not exists public.play_purchases (
  purchase_token text primary key,
  user_id        uuid not null references public.users(id) on delete cascade,
  product        text not null,
  order_id       text,
  status         text not null default 'granted',
  created_at     timestamptz not null default now()
);

create index if not exists play_purchases_user_idx
  on public.play_purchases (user_id);

alter table public.play_purchases enable row level security;
-- (intentionally no policies — service-role only)
