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
  | "allocate"
  | "edge_infer"
  | "agent";

export type ChatMessage = { role: "user" | "assistant"; content: string };

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

export interface FinConversationMeta {
  id: string;
  title: string;
  mode: string;
  created_at?: string;
  updated_at?: string;
}

/** Mode gold tier multipliers (must match functions/_shared/gold-tiers.js). */
export function modeGoldMultiplier(mode: FinMode | string): number {
  if (mode === "agent") return 6;
  if (mode === "edge_infer") return 5;
  if (mode === "e2e") return 4;
  if (mode === "report") return 3;
  if (
    mode === "multifactor" ||
    mode === "allocate" ||
    mode === "transformer"
  ) {
    return 2;
  }
  return 1;
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

export async function listFinConversations(): Promise<FinConversationMeta[]> {
  if (!isLoggedIn()) return [];
  try {
    const res = await fetch("/api/fin-conversations", {
      headers: { Authorization: `Bearer ${accessToken()}` },
      cache: "no-cache",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      conversations?: FinConversationMeta[];
    };
    if (!data.ok || !Array.isArray(data.conversations)) return [];
    return data.conversations;
  } catch {
    return [];
  }
}

export async function loadFinConversation(id: string): Promise<{
  conversation: FinConversationMeta | null;
  messages: ChatMessage[];
}> {
  if (!isLoggedIn() || !id) return { conversation: null, messages: [] };
  try {
    const res = await fetch(
      `/api/fin-conversations?id=${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${accessToken()}` },
        cache: "no-cache",
      },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      conversation?: FinConversationMeta;
      messages?: Array<{ role?: string; content?: string }>;
    };
    if (!data.ok) return { conversation: null, messages: [] };
    const messages: ChatMessage[] = (data.messages || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content || ""),
      }));
    return { conversation: data.conversation || null, messages };
  } catch {
    return { conversation: null, messages: [] };
  }
}

export async function deleteFinConversation(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/fin-conversations?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken()}` },
      },
    );
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function callFinDesk(input: {
  mode: FinMode;
  prompt: string;
  locale: "zh" | "en";
  context?: string;
  messages?: ChatMessage[];
  conversation_id?: string | null;
  image?: string | null;
  inference?: unknown;
}): Promise<
  | {
      ok: true;
      answer: string;
      gold_spent: number;
      gold_remaining: number | null;
      conversation_id?: string | null;
      mode_multiplier?: number;
      meta?: unknown;
      structured?: unknown;
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
      conversation_id?: string;
      mode_multiplier?: number;
      meta?: unknown;
      structured?: unknown;
      error?: string;
      code?: string;
      gold_needed?: number;
      hint?: string;
    };
    if (!data.ok || !data.answer) {
      const base = flattenErr(data.error || data.code, "fin_desk_failed");
      const hint = typeof data.hint === "string" ? data.hint : "";
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
      conversation_id: data.conversation_id ?? null,
      mode_multiplier: data.mode_multiplier,
      meta: data.meta,
      structured: data.structured,
    };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

/** Compress image file to a data URL suitable for DeepSeek vision (≤ ~1.2MB). */
export async function fileToVisionDataUrl(file: File): Promise<string | null> {
  if (!file || !file.type.startsWith("image/")) return null;
  if (file.size > 12 * 1024 * 1024) return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Fallback: raw FileReader (may exceed limit)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = String(reader.result || "");
        resolve(r.startsWith("data:image/") ? r : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
  const maxSide = 1280;
  let w = bitmap.width;
  let h = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
