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

/** Non-admin must hold at least this many gold before 苏坡大模型 runs. */
export const MIN_GOLD_FLOOR = 20;

/** Station-master admin email (also bootstrapped in SQL). */
export const SUPRO_ADMIN_EMAIL = "seanfudan@163.com";

export const AUTH_CONFIG = {
  supabaseUrl:
    envGet("VITE_SUPABASE_URL") ||
    "https://jrnabzfvdcmcoxyadmax.supabase.co",
  supabaseAnonKey: envGet("VITE_SUPABASE_ANON_KEY"),
  loginEnabled: true,
  goldPerUsd: GOLD_PER_USD,
  minGoldFloor: MIN_GOLD_FLOOR,
  adminEmail: SUPRO_ADMIN_EMAIL,
};

export function authCloudConfigured(): boolean {
  return Boolean(AUTH_CONFIG.supabaseUrl && AUTH_CONFIG.supabaseAnonKey);
}
