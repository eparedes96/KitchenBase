import { createClient } from "@supabase/supabase-js";

/**
 * Singleton Supabase client.
 *
 * Reads:
 *  - REACT_APP_SUPABASE_URL
 *  - REACT_APP_SUPABASE_ANON_KEY (publishable key in the new Supabase format)
 *
 * NOTE: never expose the service-role/secret key in the frontend.
 */
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // We log instead of throwing so the app still renders a helpful error in UI.
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in /app/frontend/.env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "kitchenbase.auth",
  },
});
