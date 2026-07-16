import { supabase } from '../services/supabase';
import { withTimeout } from './promiseTimeout';

const DEFAULT_UPLOAD_TIMEOUT_MS = 45_000;

export interface UploadPublicFileOptions {
  upsert?: boolean;
  timeoutMs?: number;
  label?: string;
}

/**
 * Upload a file to a public Supabase Storage bucket and return its public URL.
 * Rejects with a clear Error on storage failure or timeout (prevents infinite spinners).
 */
export async function uploadPublicFile(
  bucket: string,
  path: string,
  file: File,
  options: UploadPublicFileOptions = {}
): Promise<string> {
  const label = options.label || 'Upload';
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;

  const uploadPromise = (async () => {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: options.upsert ?? false });

    if (error) {
      throw new Error(error.message || `${label} failed`);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!urlData?.publicUrl) {
      throw new Error(`${label} succeeded but no public URL was returned`);
    }
    return urlData.publicUrl;
  })();

  return withTimeout(uploadPromise, timeoutMs, label);
}

/**
 * Upload to a private bucket. Returns the storage path (not a usable public URL).
 * Callers that need a preview should use createSignedUrl separately.
 */
export async function uploadPrivateFile(
  bucket: string,
  path: string,
  file: File,
  options: UploadPublicFileOptions = {}
): Promise<string> {
  const label = options.label || 'Upload';
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;

  const uploadPromise = (async () => {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: options.upsert ?? false });

    if (error) {
      throw new Error(error.message || `${label} failed`);
    }
    return path;
  })();

  return withTimeout(uploadPromise, timeoutMs, label);
}
