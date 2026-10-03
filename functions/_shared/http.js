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
