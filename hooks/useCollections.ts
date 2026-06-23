import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useSupabaseClient } from './useSupabaseClient';
import type { RecipeRow } from '../lib/api/import';

/**
 * Collections data layer. Unlike imports/AI/payments (which go through Edge
 * Functions + service role), collections are plain owner-scoped CRUD, so the
 * client talks to Postgres directly through the RLS-scoped Supabase client —
 * the `collections_*_own` / `collection_recipes_*_own` policies from
 * 0002_rls_policies.sql gate every row to the signed-in user.
 *
 * INSERTs into `collections` must carry `user_id` (RLS `with check` compares it
 * to current_user_id()); we resolve the caller's internal users.id from the
 * RLS-visible `users` row. Join-table writes need no user_id — their policy
 * checks ownership via the parent collection.
 */

export interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  cover_image_url: string | null;
  created_at: string;
}

/** A collection plus derived display meta (recipe count + up to 4 cover images). */
export interface CollectionWithMeta {
  id: string;
  name: string;
  coverImageUrl: string | null;
  recipeCount: number;
  coverImages: string[];
  createdAt: string;
}

const COLLECTIONS_KEY = 'collections';

/** Shape cached under ['collection', id] (see useCollection) — used by the
 *  optimistic add/remove mutations to update the open collection on tap. */
type CollectionDetail = { name: string; recipes: RecipeRow[] };

export function useCollections() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();

  const query = useQuery<CollectionWithMeta[], Error>({
    queryKey: [COLLECTIONS_KEY, userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('id, name, cover_image_url, created_at, collection_recipes(recipe:recipes(id, image_url))')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[useCollections] read failed', { code: (error as any).code, message: error.message });
        throw new Error(error.message);
      }
      return (data ?? []).map((c: any): CollectionWithMeta => {
        const joins = (c.collection_recipes ?? []) as { recipe: { id: string; image_url: string | null } | null }[];
        const coverImages = joins
          .map((j) => j.recipe?.image_url)
          .filter((u): u is string => !!u)
          .slice(0, 4);
        return {
          id: c.id,
          name: c.name,
          coverImageUrl: c.cover_image_url ?? null,
          recipeCount: joins.length,
          coverImages,
          createdAt: c.created_at,
        };
      });
    },
  });

  return {
    collections: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useCollection(id: string | undefined) {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();

  const query = useQuery<{ name: string; recipes: RecipeRow[] } | null, Error>({
    queryKey: ['collection', id],
    enabled: !!userId && !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('id, name, collection_recipes(added_at, recipe:recipes(*))')
        .eq('id', id as string)
        .maybeSingle();
      if (error) {
        console.error('[useCollection] read failed', { id, code: (error as any).code, message: error.message });
        throw new Error(error.message);
      }
      if (!data) return null;
      const joins = ((data as any).collection_recipes ?? []) as { added_at: string; recipe: RecipeRow | null }[];
      const recipes = joins
        .filter((j) => !!j.recipe)
        .sort((a, b) => (a.added_at < b.added_at ? 1 : -1))
        .map((j) => j.recipe as RecipeRow);
      return { name: (data as any).name as string, recipes };
    },
  });

  return {
    collection: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Resolve the caller's internal public.users.id (RLS exposes only their row). */
async function resolveInternalUserId(supabase: ReturnType<typeof useSupabaseClient>): Promise<string> {
  const { data, error } = await supabase.from('users').select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('user_not_provisioned');
  return (data as { id: string }).id;
}

export function useCreateCollection() {
  const supabase = useSupabaseClient();
  const qc = useQueryClient();

  return useMutation<CollectionRow, Error, string>({
    mutationFn: async (name: string) => {
      const internalId = await resolveInternalUserId(supabase);
      const { data, error } = await supabase
        .from('collections')
        .insert({ user_id: internalId, name: name.trim() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as CollectionRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [COLLECTIONS_KEY] }),
  });
}

export function useDeleteCollection() {
  const supabase = useSupabaseClient();
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (collectionId: string) => {
      // `.select()` makes PostgREST return the deleted rows. Without it,
      // supabase-js reports success even when RLS silently deletes 0 rows —
      // which is exactly how a "delete that does nothing" slips through. If we
      // get an empty result, the row wasn't owned/visible under the current
      // auth, so surface that as a real error instead of a phantom success.
      const { data, error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId)
        .select('id');
      if (error) {
        console.error('[useDeleteCollection] delete failed', { collectionId, code: (error as any).code, message: error.message });
        throw new Error(error.message);
      }
      if (!data || data.length === 0) {
        throw new Error(
          'The collection was not deleted (0 rows). The Clerk ↔ Supabase auth bridge may not be resolving your user under RLS.',
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [COLLECTIONS_KEY] }),
  });
}

export function useAddRecipeToCollection() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const qc = useQueryClient();

  return useMutation<
    void,
    Error,
    { collectionId: string; recipeId: string },
    { prev?: CollectionDetail | null; collectionId: string }
  >({
    mutationFn: async ({ collectionId, recipeId }) => {
      const { error } = await supabase
        .from('collection_recipes')
        .upsert(
          { collection_id: collectionId, recipe_id: recipeId },
          { onConflict: 'collection_id,recipe_id', ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    },
    // Optimistically drop the recipe into the open collection so the picker check
    // and the grid update on tap — not after two sequential network round-trips
    // (upsert + refetch), which is what made adding feel stuck for 2–3s. The
    // recipe row is pulled from the warm ['recipes'] cache.
    onMutate: async ({ collectionId, recipeId }) => {
      await qc.cancelQueries({ queryKey: ['collection', collectionId] });
      const prev = qc.getQueryData<CollectionDetail | null>(['collection', collectionId]);
      const recipe = qc
        .getQueryData<RecipeRow[]>(['recipes', userId])
        ?.find((r) => r.id === recipeId);
      qc.setQueryData<CollectionDetail | null>(['collection', collectionId], (old) => {
        if (!old || !recipe || old.recipes.some((r) => r.id === recipeId)) return old;
        // The query sorts newest-added first, so a fresh add goes to the front.
        return { ...old, recipes: [recipe, ...old.recipes] };
      });
      return { prev, collectionId };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(['collection', ctx.collectionId], ctx.prev);
    },
    // Reconcile with the server in the background once the write settles; the
    // optimistic data already matches, so there's no visible flicker.
    onSettled: (_d, _e, { collectionId }) => {
      qc.invalidateQueries({ queryKey: [COLLECTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });
}

export function useRemoveRecipeFromCollection() {
  const supabase = useSupabaseClient();
  const qc = useQueryClient();

  return useMutation<
    void,
    Error,
    { collectionId: string; recipeId: string },
    { prev?: CollectionDetail | null; collectionId: string }
  >({
    mutationFn: async ({ collectionId, recipeId }) => {
      const { data, error } = await supabase
        .from('collection_recipes')
        .delete()
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId)
        .select('recipe_id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error('The recipe was not removed (0 rows) — check the Clerk ↔ Supabase auth bridge.');
      }
    },
    // Drop the card from the open collection immediately; roll back if the delete
    // fails (e.g. RLS removed 0 rows).
    onMutate: async ({ collectionId, recipeId }) => {
      await qc.cancelQueries({ queryKey: ['collection', collectionId] });
      const prev = qc.getQueryData<CollectionDetail | null>(['collection', collectionId]);
      qc.setQueryData<CollectionDetail | null>(['collection', collectionId], (old) =>
        old ? { ...old, recipes: old.recipes.filter((r) => r.id !== recipeId) } : old,
      );
      return { prev, collectionId };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(['collection', ctx.collectionId], ctx.prev);
    },
    onSettled: (_d, _e, { collectionId }) => {
      qc.invalidateQueries({ queryKey: [COLLECTIONS_KEY] });
      qc.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });
}
