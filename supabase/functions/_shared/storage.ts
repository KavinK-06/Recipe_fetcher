import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'recipe-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
// List/search/collection cards read recipes.image_url directly (only the detail
// screen resolves storage_path → a fresh signed URL via get-recipe-image). A
// scanned photo has no public origin URL, so we stamp a long-lived signed URL
// into image_url too, and keep storage_path for the detail screen's fresh sign.
const LONG_SIGNED_TTL = 60 * 60 * 24 * 365; // 1 year

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

/**
 * Stores a user-supplied photo (a `data:image/...;base64,...` data URL) as a
 * recipe's image at `<userId>/<recipeId>.<ext>` in the private bucket. Returns
 * both the storage path (for `recipes.storage_path`) and a long-lived signed URL
 * (for `recipes.image_url`, which the list/card screens read directly).
 *
 * Best-effort: returns `null` and logs — never throws — on any failure. Used by
 * `import-photo`; a storage hiccup must never fail an otherwise-good import.
 */
export async function storeRecipePhotoFromDataUrl(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  dataUrl: string,
): Promise<{ path: string; signedUrl: string | null } | null> {
  try {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(dataUrl.trim());
    if (!match) {
      console.error('[storage] storeRecipePhotoFromDataUrl: not a base64 image data URL');
      return null;
    }
    const contentType = match[1].toLowerCase();
    const bytes = base64ToBytes(match[2]);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      console.error(`[storage] photo size ${bytes.byteLength}B out of range (max ${MAX_BYTES})`);
      return null;
    }

    const ext = EXT_BY_TYPE[contentType] ?? 'jpg';
    const path = `${userId}/${recipeId}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.error(`[storage] photo upload failed for ${path}:`, error);
      return null;
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, LONG_SIGNED_TTL);
    if (signError) console.error(`[storage] sign failed for ${path}:`, signError);

    return { path, signedUrl: signed?.signedUrl ?? null };
  } catch (err) {
    console.error('[storage] storeRecipePhotoFromDataUrl threw:', err);
    return null;
  }
}

/** Decode a base64 string to bytes (Deno globals: atob). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
