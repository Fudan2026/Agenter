/** Economy client helpers — Supro hard gold (GOLD_PER_USD = 100). */

import { accessToken, isLoggedIn } from "./session";
import { GOLD_PER_USD, MIN_GOLD_FLOOR } from "./config";

export { GOLD_PER_USD, MIN_GOLD_FLOOR };

export type FinMode =
  | "pick"
  | "factor"
  | "strategy"
  | "review"
  | "multifactor"
  | "e2e"
  | "transformer"
  | "report"
  | "allocate";

export interface EconomyBalance {
  gold: number;
  total_earned: number;
  email?: string | null;
  gold_per_usd?: number;
  shared_wallet?: boolean;
  min_gold_floor?: number;
  is_admin?: boolean;
  usage?: Array<{
    id?: number;
    feature?: string;
    tokens?: number;
    gold?: number;
    created_at?: string;
  }>;
}

function flattenErr(err: unknown, fallback: string): string {
  if (err == null || err === "") return fallback;
  if (typeof err === "string") return err;
  if (typeof err === "number" || typeof err === "boolean") return String(err);
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const k of ["message", "error", "msg", "code", "hint"]) {
      if (typeof o[k] === "string" && o[k]) return String(o[k]);
    }
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return String(err);
}

export async function fetchBalance(): Promise<EconomyBalance | null> {
  if (!isLoggedIn()) return null;
  try {
    const res = await fetch("/api/economy-balance", {
      headers: { Authorization: `Bearer ${accessToken()}` },
      cache: "no-cache",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      gold?: number;
      total_earned?: number;
      email?: string | null;
      gold_per_usd?: number;
      shared_wallet?: boolean;
      min_gold_floor?: number;
      is_admin?: boolean;
      usage?: EconomyBalance["usage"];
      error?: unknown;
      code?: string;
      hint?: string;
    };
    if (!res.ok || !data.ok) return null;
    return {
      gold: Number(data.gold ?? 0),
      total_earned: Number(data.total_earned ?? 0),
      email: data.email,
      gold_per_usd: Number(data.gold_per_usd ?? GOLD_PER_USD),
      shared_wallet: Boolean(data.shared_wallet),
      min_gold_floor: Number(data.min_gold_floor ?? MIN_GOLD_FLOOR),
      is_admin: Boolean(data.is_admin),
      usage: Array.isArray(data.usage) ? data.usage : [],
    };
  } catch {
    return null;
  }
}

export async function redeemCode(
  code: string,
): Promise<{ ok: true; gold: number; granted: number } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/economy-grant-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken()}`,
      },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      gold?: number;
      granted?: number;
      error?: string;
      code?: string;
    };
    if (!data.ok) {
      return {
        ok: false,
        error: flattenErr(data.error || data.code, "redeem_failed"),
      };
    }
    return {
      ok: true,
      gold: Number(data.gold ?? 0),
      granted: Number(data.granted ?? 0),
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function callFinDesk(input: {
  mode: FinMode;
  prompt: string;
  locale: "zh" | "en";
  context?: string;
}): Promise<
  | {
      ok: true;
      answer: string;
      gold_spent: number;
      gold_remaining: number | null;
      meta?: unknown;
    }
  | { ok: false; error: string; gold_needed?: number; code?: string }
> {
  try {
    const res = await fetch("/api/fin-desk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken()}`,
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      answer?: string;
      gold_spent?: number;
      gold_remaining?: number | null;
      meta?: unknown;
      error?: string;
      code?: string;
      gold_needed?: number;
    };
    if (!data.ok || !data.answer) {
      const base = flattenErr(data.error || data.code, "fin_desk_failed");
      const hint =
        typeof (data as { hint?: unknown }).hint === "string"
          ? String((data as { hint?: string }).hint)
          : "";
      return {
        ok: false,
        error: hint ? `${base} — ${hint}` : base,
        gold_needed: data.gold_needed,
        code: data.code,
      };
    }
    return {
      ok: true,
      answer: data.answer,
      gold_spent: Number(data.gold_spent ?? 0),
      gold_remaining:
        data.gold_remaining == null ? null : Number(data.gold_remaining),
      meta: data.meta,
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
