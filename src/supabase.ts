import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

type BrowserSupabaseClient = SupabaseClient<any>;

let browserClient: BrowserSupabaseClient | null = null;

export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (!isSupabaseAuthConfigured || !supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to your .env file.',
    );
  }

  browserClient ??= createClient<any>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}

export async function signInWithGoogle() {
  const supabase = getSupabaseBrowserClient();
  const {error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOutFromSupabase() {
  const supabase = getSupabaseBrowserClient();
  const {error} = await supabase.auth.signOut({scope: 'local'});

  if (error) {
    throw error;
  }
}
