/**
 * Public runtime config for Supabase (anon only).
 * NEW Supro org/project — override via Vite env (no Letus default).
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

/** Hard-gold USD peg. 100 gold = $1. */
export const GOLD_PER_USD = 100;

/** Non-admin must hold at least this many gold before 苏坡大模型 runs. */
export const MIN_GOLD_FLOOR = 20;

/** Station-master admin email (also bootstrapped in SQL). */
export const SUPRO_ADMIN_EMAIL = "seanfudan@163.com";

/** Production confirm / login landing. */
export const SUPRO_CONFIRM_REDIRECT = "https://supro.si/#/login";

export const AUTH_CONFIG = {
  supabaseUrl: envGet("VITE_SUPABASE_URL"),
  supabaseAnonKey: envGet("VITE_SUPABASE_ANON_KEY"),
  loginEnabled: true,
  goldPerUsd: GOLD_PER_USD,
  minGoldFloor: MIN_GOLD_FLOOR,
  adminEmail: SUPRO_ADMIN_EMAIL,
  confirmRedirect: SUPRO_CONFIRM_REDIRECT,
};

export function authCloudConfigured(): boolean {
  return Boolean(AUTH_CONFIG.supabaseUrl && AUTH_CONFIG.supabaseAnonKey);
}

export function signupRedirectTo(): string {
  try {
    const { origin, hostname } = window.location;
    if (
      hostname === "supro.si" ||
      hostname === "www.supro.si" ||
      hostname.endsWith(".pages.dev") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    ) {
      return `${origin}/#/login`;
    }
  } catch {
    /* ignore */
  }
  return SUPRO_CONFIRM_REDIRECT;
}
