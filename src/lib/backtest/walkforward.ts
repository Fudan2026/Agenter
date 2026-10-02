/**
 * Expanding walk-forward with purge + embargo (López de Prado Ch.7 spirit).
 */

export interface WfFold {
  trainStart: number;
  trainEnd: number;
  purgeStart: number;
  purgeEnd: number;
  embargoStart: number;
  embargoEnd: number;
  testStart: number;
  testEnd: number;
}

export interface WfConfig {
  nOosFolds: number;
  purgeBars: number;
  embargoBars: number;
  minTrainBars: number;
  mode: "expanding";
}

export const DEFAULT_WF_CONFIG: WfConfig = {
  nOosFolds: 3,
  purgeBars: 5,
  embargoBars: 5,
  minTrainBars: 60,
  mode: "expanding",
};

export function buildExpandingFolds(
  nBars: number,
  cfg: WfConfig = DEFAULT_WF_CONFIG,
): WfFold[] {
  const folds: WfFold[] = [];
  if (nBars < cfg.minTrainBars + cfg.nOosFolds * 10) return folds;

  const usable = nBars - cfg.minTrainBars;
  const foldSpan = Math.max(10, Math.floor(usable / cfg.nOosFolds));

  for (let f = 0; f < cfg.nOosFolds; f++) {
    const testStart = cfg.minTrainBars + f * foldSpan;
    let testEnd = Math.min(nBars, testStart + foldSpan);
    if (f === cfg.nOosFolds - 1) testEnd = nBars;
    if (testStart >= nBars - 2) break;

    const purgeEnd = testStart;
    const purgeStart = Math.max(0, purgeEnd - cfg.purgeBars);
    const trainEnd = purgeStart;
    const trainStart = 0;
    if (trainEnd - trainStart < cfg.minTrainBars * 0.5) continue;

    const embargoStart = testEnd;
    const embargoEnd = Math.min(nBars, testEnd + cfg.embargoBars);

    folds.push({
      trainStart,
      trainEnd,
      purgeStart,
      purgeEnd,
      embargoStart,
      embargoEnd,
      testStart,
      testEnd,
    });
  }
  return folds;
}

/** Assert train does not overlap purge/test/embargo index sets. */
export function foldHasNoLeakage(fold: WfFold): boolean {
  for (let i = fold.trainStart; i < fold.trainEnd; i++) {
    if (i >= fold.purgeStart && i < fold.purgeEnd) return false;
    if (i >= fold.testStart && i < fold.testEnd) return false;
    if (i >= fold.embargoStart && i < fold.embargoEnd) return false;
  }
  return fold.trainEnd <= fold.purgeStart && fold.purgeEnd <= fold.testStart;
}
