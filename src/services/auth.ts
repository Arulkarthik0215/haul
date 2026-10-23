import { supabase } from "@/lib/supabase";

export async function signInWithGoogle() {
  if (!supabase) {
    return { data: null, error: new Error("Sign-in isn't configured (missing Supabase keys).") };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: "https://www.googleapis.com/auth/gmail.readonly",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
      redirectTo: window.location.origin,
    },
  });

  return { data, error };
}

export async function signOut() {
  if (!supabase) return { error: null };
  return await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return { data: { session: null }, error: null };
  return await supabase.auth.getSession();
}
