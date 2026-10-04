/** JSON helpers for Cloudflare Pages Functions. */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function bearerToken(request) {
  const header =
    request.headers.get("Authorization") ||
    request.headers.get("authorization") ||
    "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

/** Flatten PostgREST / nested errors so clients never show [object Object]. */
export function errText(err, fallback = "error") {
  if (err == null || err === "") return fallback;
  if (typeof err === "string") return err;
  if (typeof err === "number" || typeof err === "boolean") return String(err);
  if (typeof err === "object") {
    const msg =
      err.message ||
      err.error_description ||
      err.error ||
      err.msg ||
      err.code ||
      err.hint;
    if (typeof msg === "string" && msg) return msg;
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return String(err);
}
