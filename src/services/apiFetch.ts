/**
 * Centralized authenticated fetch for ALL /api/ calls.
 *
 * Features:
 * - Auto-adds Authorization header from Supabase session
 * - Auto-detects FormData (skips Content-Type so browser sets multipart boundary)
 * - 401 → refreshSession → retry once
 * - Drop-in fetch() replacement (same API)
 *
 * ALL /api/ calls MUST use apiFetch(). Direct fetch() to /api/ is forbidden.
 */
import { supabase } from '../utils/supabase/client';

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = await getToken();
  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const { signal, ...restOpts } = options || {};
  const res = await fetch(url, { ...restOpts, headers, ...(signal ? { signal } : {}) });

  if (res.status === 401) {
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
      return fetch(url, { ...restOpts, headers });
    }
  }

  return res;
}
