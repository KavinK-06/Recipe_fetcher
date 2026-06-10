-- 0005_auth_claim_compat.sql
--
-- Fixes the silent "no rows returned" on direct DB reads (home feed, recipe
-- detail) when the Clerk `supabase` HS256 JWT template isn't the token in play.
--
-- RLS previously resolved the user ONLY from the template token's custom
-- `user_id` claim. The default Clerk session token (the one the Edge Functions
-- already verify, and the one used when Clerk is registered as a Third-Party
-- Auth provider in Supabase) carries the Clerk user id in the standard `sub`
-- claim instead — so every policy returned zero rows with no error.
--
-- This migration makes the claim resolution accept BOTH shapes:
--   * `user_id` — the HS256 `supabase` template (legacy-secret path)
--   * `sub`     — the default Clerk session token (Third-Party Auth path; also
--                 present on template tokens, Clerk always includes it)
--
-- Everything else (recipes/collections/shopping/entitlements/payments/storage
-- policies) goes through current_user_id(), so updating it fixes all tables at
-- once. Only the two `users` self-policies read the claim directly.
--
-- Idempotent: function is CREATE OR REPLACE; policies are dropped first.

begin;

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users
  where clerk_user_id = coalesce(auth.jwt() ->> 'user_id', auth.jwt() ->> 'sub')
$$;

drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
  for select
  using (clerk_user_id = coalesce(auth.jwt() ->> 'user_id', auth.jwt() ->> 'sub'));

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update
  using (clerk_user_id = coalesce(auth.jwt() ->> 'user_id', auth.jwt() ->> 'sub'))
  with check (clerk_user_id = coalesce(auth.jwt() ->> 'user_id', auth.jwt() ->> 'sub'));

commit;
