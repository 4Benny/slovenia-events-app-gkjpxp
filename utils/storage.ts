import { supabase } from "@/app/integrations/supabase/client";

type ResolveOptions = {
  bucket: string;
  value: string | null | undefined;
  expiresIn?: number;
};

const DEFAULT_EXPIRES_IN = 60 * 60; // 1h

type StorageUrlCacheEntry = {
  url: string;
  expiresAtMs: number;
};

const storageUrlCache = new Map<string, StorageUrlCacheEntry>();

function cacheKey({ bucket, path, exp }: { bucket: string; path: string; exp: number }): string {
  return `${bucket}|${exp}|${path}`;
}

function tryExtractBucketPath(bucket: string, value: string): string | null {
  // Already a plain path
  if (!value.startsWith("http")) {
    return value.replace(/^\/+/, "");
  }

  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  const signedIndex = value.indexOf(signedMarker);
  if (signedIndex >= 0) {
    return value.slice(signedIndex + signedMarker.length).split("?")[0];
  }

  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = value.indexOf(publicMarker);
  if (markerIndex >= 0) {
    return value.slice(markerIndex + publicMarker.length).split("?")[0];
  }

  // Sometimes URLs can be in the form .../storage/v1/object/${bucket}/...
  const genericMarker = `/storage/v1/object/${bucket}/`;
  const genericIndex = value.indexOf(genericMarker);
  if (genericIndex >= 0) {
    return value.slice(genericIndex + genericMarker.length).split("?")[0];
  }

  return null;
}

export function extractStoragePath({ bucket, value }: { bucket: string; value: string | null | undefined }): string | null {
  if (!value) return null;
  return tryExtractBucketPath(bucket, value);
}

export async function resolveStorageUrl({ bucket, value, expiresIn }: ResolveOptions): Promise<string | null> {
  if (!value) return null;

  // Keep signed URLs
  if (value.startsWith("http") && value.includes(`/storage/v1/object/sign/${bucket}/`)) {
    return value;
  }

  const path = tryExtractBucketPath(bucket, value);
  const exp = expiresIn ?? DEFAULT_EXPIRES_IN;

  if (path) {
    const key = cacheKey({ bucket, path, exp });
    const cached = storageUrlCache.get(key);
    if (cached && cached.expiresAtMs > Date.now() + 30_000) {
      return cached.url;
    }
  }

  if (path) {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, exp);
      if (!error && data?.signedUrl) {
        storageUrlCache.set(cacheKey({ bucket, path, exp }), {
          url: data.signedUrl,
          expiresAtMs: Date.now() + exp * 1000,
        });
        return data.signedUrl;
      }
    } catch {
      // fall back below
    }

    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) {
        storageUrlCache.set(cacheKey({ bucket, path, exp }), {
          url: data.publicUrl,
          expiresAtMs: Date.now() + exp * 1000,
        });
        return data.publicUrl;
      }
    } catch {
      // fall back below
    }
  }

  return value;
}
