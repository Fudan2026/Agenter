/** Parse / render Supro Model structured JSON answers. */

import type { Locale } from "../../i18n/strings";
import { t } from "../../i18n/strings";
import { esc } from "../util/esc";

export interface SuproStructured {
  role?: string;
  task?: string;
  universe_note?: string;
  factors?: Array<{
    id?: string;
    tilt?: string;
    keep?: boolean;
    reject_reason?: string | null;
    rationale?: string;
  }>;
  eliminations?: Array<{ factor_id?: string; reason?: string }>;
  portfolio?: Array<{ symbol?: string; weight?: number; reason?: string }>;
  signals?: Array<{
    symbol?: string;
    side?: string;
    horizon?: string;
    confidence?: number;
    rationale?: string;
  }>;
  reasoning_chain?: string[];
  attention_view?: {
    heads_note?: string;
    features?: string[];
    limitations?: string[];
  };
  allocation?: {
    weights?: Array<{ symbol?: string; weight?: number }>;
    caps_note?: string;
    rebalance?: string;
  };
  report?: {
    title?: string;
    summary?: string;
    sections?: Array<{ heading?: string; body?: string }>;
    rating?: string;
    quality_score?: number;
    sources?: string[];
  };
  risks?: string[];
  deep_links?: string[];
  narrative?: string;
  disclaimer?: string;
}

export function parseStructuredAnswer(
  answer: string,
): { structured: SuproStructured | null; narrative: string } {
  const raw = String(answer || "");
  const stampIdx = raw.lastIndexOf("\n\n— ");
  const body = stampIdx >= 0 ? raw.slice(0, stampIdx) : raw;
  const stamp = stampIdx >= 0 ? raw.slice(stampIdx) : "";

  const tryParse = (s: string): SuproStructured | null => {
    try {
      return JSON.parse(s) as SuproStructured;
    } catch {
      /* fallthrough */
    }
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim()) as SuproStructured;
      } catch {
        /* fallthrough */
      }
    }
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as SuproStructured;
      } catch {
        return null;
      }
    }
    return null;
  };

  const structured = tryParse(body.trim());
  if (!structured) {
    return { structured: null, narrative: raw };
  }
  const narrative =
    String(structured.narrative || structured.report?.summary || "") + stamp;
  return { structured, narrative: narrative || raw };
}

export function renderStructuredHtml(
  locale: Locale,
  structured: SuproStructured,
): string {
  const parts: string[] = [];

  if (structured.reasoning_chain?.length) {
    parts.push(`<section><h3>${esc(t(locale, "finReasoning"))}</h3><ol>${structured.reasoning_chain
      .map((s) => `<li>${esc(String(s))}</li>`)
      .join("")}</ol></section>`);
  }

  if (structured.eliminations?.length) {
    parts.push(`<section><h3>${esc(t(locale, "finEliminations"))}</h3><ul>${structured.eliminations
      .map(
        (e) =>
          `<li><strong>${esc(String(e.factor_id || ""))}</strong> — ${esc(String(e.reason || ""))}</li>`,
      )
      .join("")}</ul></section>`);
  }

  if (structured.factors?.length) {
    parts.push(`<section><h3>${esc(t(locale, "finModeFactor"))}</h3><ul>${structured.factors
      .map((f) => {
        const keep = f.keep === false ? "✗" : "✓";
        return `<li>${keep} <strong>${esc(String(f.id || ""))}</strong> ${esc(String(f.tilt || ""))} — ${esc(String(f.rationale || f.reject_reason || ""))}</li>`;
      })
      .join("")}</ul></section>`);
  }

  if (structured.portfolio?.length) {
    parts.push(`<section><h3>${esc(t(locale, "finPortfolio"))}</h3><ul>${structured.portfolio
      .map(
        (p) =>
          `<li><strong>${esc(String(p.symbol || ""))}</strong> ${(Number(p.weight) * 100).toFixed(1)}% — ${esc(String(p.reason || ""))}</li>`,
      )
      .join("")}</ul></section>`);
  }

  if (structured.signals?.length) {
    parts.push(`<section><h3>${esc(t(locale, "finSignals"))}</h3><ul>${structured.signals
      .map(
        (s) =>
          `<li><strong>${esc(String(s.symbol || ""))}</strong> ${esc(String(s.side || ""))} @ ${esc(String(s.horizon || "next_open"))} (c=${Number(s.confidence || 0).toFixed(2)}) — ${esc(String(s.rationale || ""))}</li>`,
      )
      .join("")}</ul></section>`);
  }

  if (structured.allocation?.weights?.length || structured.allocation?.caps_note) {
    const w = (structured.allocation.weights || [])
      .map(
        (x) =>
          `<li>${esc(String(x.symbol || ""))}: ${(Number(x.weight) * 100).toFixed(1)}%</li>`,
      )
      .join("");
    parts.push(`<section><h3>${esc(t(locale, "finModeAllocate"))}</h3><ul>${w}</ul>
      <p class="muted tiny">${esc(String(structured.allocation.caps_note || ""))}</p>
      <p class="muted tiny">${esc(String(structured.allocation.rebalance || ""))}</p></section>`);
  }

  if (structured.attention_view) {
    const av = structured.attention_view;
    parts.push(`<section><h3>${esc(t(locale, "finAttention"))}</h3>
      <p>${esc(String(av.heads_note || ""))}</p>
      <p class="muted tiny">features: ${esc((av.features || []).join(", "))}</p>
      <ul>${(av.limitations || []).map((l) => `<li>${esc(String(l))}</li>`).join("")}</ul>
    </section>`);
  }

  if (structured.report?.title || structured.report?.sections?.length) {
    const r = structured.report;
    const sections = (r.sections || [])
      .map(
        (s) =>
          `<h4>${esc(String(s.heading || ""))}</h4><div class="fin-md">${esc(String(s.body || ""))}</div>`,
      )
      .join("");
    parts.push(`<section class="fin-report"><h3>${esc(t(locale, "finReportBody"))}</h3>
      <h4>${esc(String(r.title || ""))}</h4>
      <p>${esc(String(r.summary || ""))}</p>
      ${sections}
      <p class="muted tiny">rating=${esc(String(r.rating || ""))} · quality=${Number(r.quality_score || 0).toFixed(2)}</p>
      <p class="muted tiny">sources: ${esc((r.sources || []).join("; "))}</p>
    </section>`);
  }

  if (structured.risks?.length) {
    parts.push(`<section><h3>Risks</h3><ul>${structured.risks
      .map((r) => `<li>${esc(String(r))}</li>`)
      .join("")}</ul></section>`);
  }

  if (structured.deep_links?.length) {
    parts.push(`<p class="cta-row wrap">${structured.deep_links
      .map((d) => `<a class="btn btn-ghost" href="${esc(String(d))}">${esc(String(d))}</a>`)
      .join("")}</p>`);
  }

  return `<div class="fin-structured">${parts.join("\n")}</div>`;
}
