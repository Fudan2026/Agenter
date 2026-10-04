/**
 * Catch-all for unknown /api/* — return JSON, never the SPA "Continue to Agenter" HTML.
 * Named handlers (fin-desk.js, economy-balance.js, fin-health.js, …) take precedence.
 */

import { json } from "../_shared/http.js";

export async function onRequest({ params }) {
  const path = params?.path;
  const joined = Array.isArray(path) ? path.join("/") : String(path || "");
  return json(
    {
      ok: false,
      code: "api_not_found",
      error: "api_not_found",
      path: `/api/${joined}`,
      hint:
        "No Pages Function for this path. If you expected /api/fin-health, deploy the branch that includes functions/api/fin-health.js to Production.",
    },
    404,
  );
}
