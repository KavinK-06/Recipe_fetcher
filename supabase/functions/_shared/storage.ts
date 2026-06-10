import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'recipe-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Common image content-types → file extension. Anything not listed (or any
// non-image type) is rejected before upload.
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Best-effort: download a remote recipe image and store it in the private
 * `recipe-images` bucket at `<userId>/<recipeId>.<ext>`, returning the storage
 * path (the value to persist in `recipes.storage_path`).
 *
 * Returns `null` and logs — never throws — on ANY failure (bad fetch, wrong
 * content-type, oversized, upload error). Image storage is best-effort: the
 * caller falls back to the origin `image_url`, so a storage hiccup must never
 * fail an import.
 */
export async function uploadRecipeImageFromUrl(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error(`[storage] fetch image failed: ${res.status} ${imageUrl}`);
      return null;
    }

    const contentType = (res.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith('image/')) {
      console.error(`[storage] not an image (content-type="${contentType}"): ${imageUrl}`);
      return null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      console.error(`[storage] image size ${bytes.byteLength}B out of range (max ${MAX_BYTES}): ${imageUrl}`);
      return null;
    }

    const ext = EXT_BY_TYPE[contentType] ?? 'jpg';
    const path = `${userId}/${recipeId}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true, // re-importing the same recipe id overwrites instead of 409-ing
    });
    if (error) {
      console.error(`[storage] upload failed for ${path}:`, error);
      return null;
    }

    return path;
  } catch (err) {
    console.error('[storage] uploadRecipeImageFromUrl threw:', err);
    return null;
  }
}
