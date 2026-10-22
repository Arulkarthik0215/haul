import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// We export the client. It might not function properly without valid env vars, 
// so the service layer will handle graceful fallbacks or errors.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Supabase only exposes the Google provider tokens once — on the SIGNED_IN event after
// the OAuth redirect. The access token is kept in memory as a fast path for sync; the
// refresh token is persisted so the sync-gmail function can mint new access tokens
// after reloads or once the 1-hour Google token expires.
let _providerToken: string | null = null;

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.provider_token) {
      _providerToken = session.provider_token;
    }
    if (event === "SIGNED_OUT") {
      _providerToken = null;
    }

    const refreshToken = session?.provider_refresh_token;
    const userId = session?.user?.id;
    if (refreshToken && userId) {
      // Deferred: awaiting Supabase calls inside onAuthStateChange can deadlock the auth client
      setTimeout(async () => {
        const { error } = await supabase
          .from("gmail_sync_state")
          .upsert({ user_id: userId, google_refresh_token: refreshToken });
        if (error) console.error("Failed to store Google refresh token:", error);
      }, 0);
    }
  });
}

export function getProviderToken(): string | null {
  return _providerToken;
}
