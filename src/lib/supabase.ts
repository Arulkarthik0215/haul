import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// We export the client. It might not function properly without valid env vars, 
// so the service layer will handle graceful fallbacks or errors.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Store provider token (Google access token) when it arrives from OAuth callback.
// Supabase only exposes provider_token once — on the initial SIGNED_IN event after
// the OAuth redirect — so we capture it here for later use (e.g. Gmail sync).
let _providerToken: string | null = null;

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.provider_token) {
      _providerToken = session.provider_token;
    }
  });
}

export function getProviderToken(): string | null {
  return _providerToken;
}
