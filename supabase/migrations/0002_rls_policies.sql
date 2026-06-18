-- Row Level Security policies for Rasoi.
--
-- Trust model:
--   * Clerk issues a JWT (template "supabase") with claim "user_id" = Clerk user ID.
--   * public.users.clerk_user_id is the join key into our internal users table.
--   * Every per-user table is gated on public.current_user_id() which resolves
--     the Clerk claim -> internal UUID via the users table.
--   * Service role (used by Edge Functions) bypasses RLS entirely — that's how
--     the Clerk webhook can insert into public.users and how payment / import
--     functions can update subscriptions and recipe_count.

-- Resolves the current request's JWT claim to the internal users.id.
-- `security definer` lets the function read users regardless of the caller's
-- RLS context; `search_path = ''` prevents search-path injection by forcing
-- every reference inside the body to be fully schema-qualified.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users where clerk_user_id = auth.jwt() ->> 'user_id'
$$;

-- ── Enable RLS on every table ──────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.recipes enable row level security;
alter table public.collections enable row level security;
alter table public.collection_recipes enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.subscriptions enable row level security;

-- ── users ──────────────────────────────────────────────────────────────────
-- INSERT / DELETE happen via Clerk webhook (service role) — no client policy.
-- A user may read and update only their own row.
create policy "users_select_self" on public.users
  for select
  using (clerk_user_id = auth.jwt() ->> 'user_id');

create policy "users_update_self" on public.users
  for update
  using (clerk_user_id = auth.jwt() ->> 'user_id')
  with check (clerk_user_id = auth.jwt() ->> 'user_id');

-- ── recipes ────────────────────────────────────────────────────────────────
create policy "recipes_select_own" on public.recipes
  for select
  using (user_id = public.current_user_id());

create policy "recipes_insert_own" on public.recipes
  for insert
  with check (user_id = public.current_user_id());

create policy "recipes_update_own" on public.recipes
  for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy "recipes_delete_own" on public.recipes
  for delete
  using (user_id = public.current_user_id());

-- ── collections ────────────────────────────────────────────────────────────
create policy "collections_select_own" on public.collections
  for select
  using (user_id = public.current_user_id());

create policy "collections_insert_own" on public.collections
  for insert
  with check (user_id = public.current_user_id());

create policy "collections_update_own" on public.collections
  for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy "collections_delete_own" on public.collections
  for delete
  using (user_id = public.current_user_id());

-- ── collection_recipes ─────────────────────────────────────────────────────
-- Join-table access is gated via the parent collection's ownership.
create policy "collection_recipes_select_own" on public.collection_recipes
  for select
  using (
    collection_id in (
      select id from public.collections where user_id = public.current_user_id()
    )
  );

create policy "collection_recipes_insert_own" on public.collection_recipes
  for insert
  with check (
    collection_id in (
      select id from public.collections where user_id = public.current_user_id()
    )
  );

create policy "collection_recipes_update_own" on public.collection_recipes
  for update
  using (
    collection_id in (
      select id from public.collections where user_id = public.current_user_id()
    )
  )
  with check (
    collection_id in (
      select id from public.collections where user_id = public.current_user_id()
    )
  );

create policy "collection_recipes_delete_own" on public.collection_recipes
  for delete
  using (
    collection_id in (
      select id from public.collections where user_id = public.current_user_id()
    )
  );

-- ── shopping_list_items ────────────────────────────────────────────────────
create policy "shopping_list_items_select_own" on public.shopping_list_items
  for select
  using (user_id = public.current_user_id());

create policy "shopping_list_items_insert_own" on public.shopping_list_items
  for insert
  with check (user_id = public.current_user_id());

create policy "shopping_list_items_update_own" on public.shopping_list_items
  for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy "shopping_list_items_delete_own" on public.shopping_list_items
  for delete
  using (user_id = public.current_user_id());

-- ── subscriptions ──────────────────────────────────────────────────────────
-- Read-only from the client. All writes (plan changes, status updates,
-- recipe_count increments) come from Edge Functions with the service role.
create policy "subscriptions_select_own" on public.subscriptions
  for select
  using (user_id = public.current_user_id());
