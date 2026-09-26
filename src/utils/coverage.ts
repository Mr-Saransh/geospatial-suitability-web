/**
 * Coverage utility functions for public-facing dashboard presentation.
 * Maps technical criteria counts into user-friendly Analysis Coverage states:
 * COMPLETE, PARTIAL, UNAVAILABLE.
 */

export type CoverageStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

export interface CoverageInfo {
  status: CoverageStatus;
  label: string;
  badgeColor: string;
  tooltip: string;
}

export interface CoverageDistributionItem {
  status: CoverageStatus;
  label: string;
  percentage: number;
  color: string;
}

/**
 * Maps point inspection evidence states into friendly public coverage representation.
 * - 11/11 valid -> COMPLETE
 * - 8/11 through 10/11 valid -> PARTIAL
 * - <8 valid, NODATA, or outside boundary -> UNAVAILABLE
 */
export function getCoverageInfo(
  finalStatus?: string | null,
  evidenceCount?: number | null,
  evidenceTotal: number = 11
): CoverageInfo {
  // Check unavailable conditions first
  if (
    finalStatus === 'OUTSIDE_ANALYSIS_AREA' ||
    finalStatus === 'NODATA' ||
    (evidenceCount !== undefined && evidenceCount !== null && evidenceCount < 8)
  ) {
    return {
      status: 'UNAVAILABLE',
      label: 'Unavailable',
      badgeColor: '#ef4444',
      tooltip: 'Unavailable: insufficient validated evidence is available for this location.',
    };
  }

  // Complete (full 11 criteria)
  if (
    finalStatus === 'VALID' ||
    (evidenceCount !== undefined && evidenceCount !== null && evidenceCount >= evidenceTotal)
  ) {
    return {
      status: 'COMPLETE',
      label: 'Complete',
      badgeColor: '#00c896',
      tooltip: 'Complete: sufficient validated evidence is available for this location.',
    };
  }

  // Partial (8 to 10 criteria)
  return {
    status: 'PARTIAL',
    label: 'Partial',
    badgeColor: '#f97316',
    tooltip: 'Partial: the result is calculated using the valid available evidence for this location.',
  };
}

/**
 * Rolls up the criteria count distribution from backend into the 3 canonical public coverage categories:
 * - 11/11 -> Complete
 * - 8/11–10/11 -> Partial
 * - <8/11 -> Unavailable
 * Percentages are calculated dynamically from data.
 */
export function deriveCoverageDistribution(
  evidenceDist?: Array<{ criteria_count: number; percentage: number }> | null
): CoverageDistributionItem[] {
  if (!evidenceDist || evidenceDist.length === 0) {
    return [];
  }

  let completePct = 0;
  let partialPct = 0;
  let unavailablePct = 0;

  for (const item of evidenceDist) {
    if (item.criteria_count >= 11) {
      completePct += item.percentage;
    } else if (item.criteria_count >= 8) {
      partialPct += item.percentage;
    } else {
      unavailablePct += item.percentage;
    }
  }

  // Unavailable is any explicitly reported <8 items, or residual difference if defined on evaluated pixels
  const evaluatedSum = completePct + partialPct + unavailablePct;
  const residual = Math.max(0, 100 - evaluatedSum);
  const finalUnavailable = unavailablePct > 0 ? unavailablePct : (residual > 0.05 ? residual : 0);

  return [
    {
      status: 'COMPLETE',
      label: 'Complete',
      percentage: Number(completePct.toFixed(2)),
      color: '#00c896',
    },
    {
      status: 'PARTIAL',
      label: 'Partial',
      percentage: Number(partialPct.toFixed(2)),
      color: '#00b4d8',
    },
    {
      status: 'UNAVAILABLE',
      label: 'Unavailable',
      percentage: Number(finalUnavailable.toFixed(2)),
      color: '#ef4444',
    },
  ];
}
