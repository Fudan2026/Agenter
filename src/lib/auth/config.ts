/**
 * Public runtime config for Supabase (anon only).
 * Override via Vite env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 */

function envGet(key: string): string {
  try {
    const meta = import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    };
    return meta.env?.[key] || "";
  } catch {
    return "";
  }
}

export const AUTH_CONFIG = {
  supabaseUrl: envGet("VITE_SUPABASE_URL"),
  supabaseAnonKey: envGet("VITE_SUPABASE_ANON_KEY"),
  loginEnabled: true,
  welcomeGold: 100,
};

export function authCloudConfigured(): boolean {
  return Boolean(AUTH_CONFIG.supabaseUrl && AUTH_CONFIG.supabaseAnonKey);
}
