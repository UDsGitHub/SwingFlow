import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey    = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY in environment');
}

// Admin client — used in the scheduler and server-side ops.
// Has full DB access, bypasses RLS. Never expose to the browser.
export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Returns a client scoped to the authenticated user (respects RLS).
// Used in API routes after verifying the user's JWT.
export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
