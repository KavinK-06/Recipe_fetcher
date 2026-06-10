-- 0004_storage_buckets.sql
--
-- Phase 6 (Storage). Creates the private `recipe-images` bucket. Recipe images
-- are written by Edge Functions (service role, which bypasses RLS) and read by
-- the client via short-lived signed URLs minted in `get-recipe-image` (also
-- service role) — so no client ever touches Storage directly.
--
-- ⚠️ Numbered 0004, NOT 0003: `0003_pricing_model.sql` is already applied to the
--    live DB. A second `0003_*` file would make migration ordering ambiguous and
--    break `supabase db push`. 0001/0002/0003 must NOT be edited.
--
-- Idempotent: bucket insert is ON CONFLICT DO NOTHING; the policy is dropped
-- before being (re)created.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

-- Defense-in-depth. Reads in this app go through service-role signed URLs (which
-- bypass RLS entirely), so this policy isn't on the hot path — but if a client
-- ever reads Storage directly with its `supabase` template token, scope it to
-- the owner's own folder. Object keys are `<userId>/<recipeId>.<ext>`, so the
-- first path segment is the internal public.users.id, matched against
-- current_user_id() (the Clerk→user mapper from 0002).
--
-- NOTE: this is intentionally NARROWER than the roadmap's draft
-- `recipe_images_authenticated_read`, which granted EVERY authenticated user
-- read access to EVERY object (contradicting its own "their own images" comment).
drop policy if exists "recipe_images_owner_read" on storage.objects;
create policy "recipe_images_owner_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = public.current_user_id()::text
);
