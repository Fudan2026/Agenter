/**
 * Public runtime config for Supabase (anon only).
 * Shared Letus project — override via Vite env.
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

/** Shared hard-gold USD peg (parity with Letus). 100 gold = $1. */
export const GOLD_PER_USD = 100;

export const AUTH_CONFIG = {
  supabaseUrl:
    envGet("VITE_SUPABASE_URL") ||
    "https://jrnabzfvdcmcoxyadmax.supabase.co",
  supabaseAnonKey: envGet("VITE_SUPABASE_ANON_KEY"),
  loginEnabled: true,
  goldPerUsd: GOLD_PER_USD,
};

export function authCloudConfigured(): boolean {
  return Boolean(AUTH_CONFIG.supabaseUrl && AUTH_CONFIG.supabaseAnonKey);
}
