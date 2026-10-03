/** Economy client helpers. */

import { accessToken, isLoggedIn } from "./session";

export interface EconomyBalance {
  gold: number;
  total_earned: number;
  email?: string | null;
}

export async function fetchBalance(): Promise<EconomyBalance | null> {
  if (!isLoggedIn()) return null;
  try {
    const res = await fetch("/api/economy-balance", {
      headers: { Authorization: `Bearer ${accessToken()}` },
      cache: "no-cache",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      gold?: number;
      total_earned?: number;
      email?: string | null;
    };
    if (!data.ok) return null;
    return {
      gold: Number(data.gold ?? 0),
      total_earned: Number(data.total_earned ?? 0),
      email: data.email,
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
      return { ok: false, error: String(data.error || data.code || "redeem_failed") };
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

export type FinMode = "pick" | "factor" | "strategy" | "review";

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
  | { ok: false; error: string; gold_needed?: number }
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
      return {
        ok: false,
        error: String(data.error || data.code || "fin_desk_failed"),
        gold_needed: data.gold_needed,
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
