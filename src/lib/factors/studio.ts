/**
 * Factor Studio — interactive weights + saved recipes (localStorage).
 * Distill of multi-factor selection skills / factor-model repos.
 */

import {
  compositeFromWeights,
  type FactorScores,
  type FactorWeights,
} from "./cross-section";
import { FACTOR_TILTS, icWeightVector, type FactorsIcPayload } from "./ic";

export const FACTOR_RECIPES_KEY = "agenter.factor.recipes.v1";

export interface FactorRecipe {
  id: string;
  name: string;
  topN: number;
  useIc: boolean;
  weights: FactorWeights;
  savedAt: string;
}

export function normalizeWeights(w: FactorWeights): FactorWeights {
  const keys: Array<keyof FactorWeights> = [
    "momentum",
    "lowVol",
    "sizeAdv",
    "quality",
    "peProxy",
    "pbProxy",
  ];
  let sum = 0;
  for (const k of keys) sum += Math.max(0, w[k] ?? 0);
  if (!(sum > 0)) {
    return { momentum: 0.25, lowVol: 0.25, sizeAdv: 0.25, quality: 0.25 };
  }
  const out: FactorWeights = {
    momentum: 0,
    lowVol: 0,
    sizeAdv: 0,
    quality: 0,
  };
  for (const k of keys) {
    const v = Math.max(0, w[k] ?? 0) / sum;
    if (k === "peProxy" || k === "pbProxy") {
      if (v > 0) out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function resolveStudioWeights(
  base: FactorWeights,
  useIc: boolean,
  ic: FactorsIcPayload | null,
): FactorWeights {
  if (!useIc) return normalizeWeights(base);
  const icw = icWeightVector(ic);
  return normalizeWeights({
    ...base,
    momentum: icw.momentum,
    lowVol: icw.lowVol,
    sizeAdv: icw.sizeAdv,
    quality: icw.quality,
  });
}

export function rankWithWeights(
  factors: FactorScores[],
  weights: FactorWeights,
  topN: number,
): FactorScores[] {
  const scored = factors.map((f) => ({
    ...f,
    composite: compositeFromWeights(f, weights),
    rank: null as number | null,
  }));
  scored.sort((a, b) => (b.composite ?? -999) - (a.composite ?? -999));
  scored.forEach((s, i) => {
    s.rank = s.composite == null ? null : i + 1;
  });
  return scored.filter((s) => s.composite != null).slice(0, topN);
}

export function loadRecipes(): FactorRecipe[] {
  try {
    const raw = localStorage.getItem(FACTOR_RECIPES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FactorRecipe[];
    return Array.isArray(arr) ? arr.slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function saveRecipes(recipes: FactorRecipe[]): void {
  try {
    localStorage.setItem(
      FACTOR_RECIPES_KEY,
      JSON.stringify(recipes.slice(0, 24)),
    );
  } catch {
    /* ignore */
  }
}

export function defaultStudioWeights(): FactorWeights {
  return { ...FACTOR_TILTS.equal };
}
