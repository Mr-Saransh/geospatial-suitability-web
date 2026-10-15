import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { SUIT_META, INITIAL_STATS } from "../data";
import type { Zone, RightTab } from "../types";
import type { AnalysisStatistics, ModelDetail } from "../lib/api/types";
import { SuitBadge, ScoreBar, TabBar, EmptyState } from "../ui";
import { IconAnalyze, IconChart, IconChevronD, IconInfo } from "../icons";
import { getCoverageInfo } from "../utils/coverage";

interface Props {
  zone: Zone | null;
  onLayerEvidence: (id: string) => void;
  statistics?: AnalysisStatistics | null;
  modelDetail?: ModelDetail | null;
  activeModelId?: string;
  activeModelName?: string;
  activeTab?: RightTab;
  onTabChange?: (t: RightTab) => void;
  onClose?: () => void;
  onSelectLayer?: (id: string) => void;
  onOpenHelp?: (section?: "guide" | "data-models") => void;
}

// Plain-language user-friendly tab definitions (Location Details only)
const TABS = [
  { id: "overview", label: "Location" },
  { id: "statistics", label: "Area Summary" },
  { id: "criteria", label: "Factors" },
  { id: "evidence", label: "Coverage" },
];

export default function RightPanel({
  zone,
  onLayerEvidence,
  statistics,
  modelDetail,
  activeModelId,
  activeModelName,
  activeTab,
  onTabChange,
  onClose,
  onSelectLayer: _onSelectLayer,
  onOpenHelp,
}: Props) {
  const [internalTab, setInternalTab] = useState<RightTab>(
    activeTab || (zone ? "overview" : "statistics"),
  );

  const isPlaceholder =
    (modelDetail?.model_id || activeModelId || "").toLowerCase() === "cyclone" ||
    (modelDetail?.model_id || activeModelId || "").toLowerCase() === "drought" ||
    (modelDetail?.name || activeModelName || "").toLowerCase() === "cyclone" ||
    (modelDetail?.name || activeModelName || "").toLowerCase() === "drought";

  const isLandslide =
    (modelDetail?.model_id || activeModelId || "").toLowerCase().includes("landslide") ||
    (modelDetail?.name || activeModelName || "").toLowerCase().includes("landslide");
  const hazardName = isLandslide ? "Landslide" : activeModelName || "Flood";
  const hazardLower = isLandslide ? "landslide" : activeModelName?.toLowerCase() || "flood";

  useEffect(() => {
    if (activeTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab]);

  const tab = activeTab || internalTab;
  const setTab = (t: RightTab) => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  const stats = statistics || (INITIAL_STATS as unknown as AnalysisStatistics);
  const coverage = zone
    ? getCoverageInfo(zone.finalStatus, zone.evidenceCount, zone.evidenceTotal)
    : null;

  return (
    <div
      className="flex flex-col overflow-hidden z-20 w-full md:w-96 flex-1 min-h-0 h-full transition-all"
      style={{
        background: "var(--c-surface)",
      }}
    >
      {/* Workspace Header */}
      <div
        className="px-4 py-2.5 flex-shrink-0"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconAnalyze size={14} style={{ color: "var(--c-accent)" }} />
            <span
              className="text-xs font-semibold uppercase tracking-wider text-[var(--c-text)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {tab === "overview"
                ? "Location Details"
                : tab === "statistics"
                  ? "Area Summary"
                  : tab === "criteria"
                    ? "Contributing Factors"
                    : "Data Coverage"}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.06)] text-xs text-[var(--c-text2)] transition-colors"
              title="Close panel"
              aria-label="Close panel"
            >
              ✕
            </button>
          )}
        </div>

        {/* Concise Location Subtitle when point selected */}
        {zone && !isPlaceholder && tab !== "statistics" && (
          <div className="flex items-center justify-between mt-1 text-xs text-[var(--c-text2)]">
            <span className="truncate">
              {zone.label || `${zone.lat.toFixed(4)}°N, ${zone.lng.toFixed(4)}°E`}
            </span>
            <span className="font-mono text-[11px] text-[var(--c-text3)]">{zone.district}</span>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      {!isPlaceholder && (
        <TabBar tabs={TABS} active={tab} onChange={(t) => setTab(t as RightTab)} />
      )}

      {/* Main Tab Content */}
      {isPlaceholder ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,180,216,0.1)", color: "#00b4d8" }}
          >
            <IconAnalyze size={20} />
          </div>
          <div className="text-sm font-semibold text-[var(--c-text)]">
            {activeModelName} Susceptibility Model
          </div>
          <div className="text-xs leading-relaxed max-w-xs text-[var(--c-text2)]">
            The {activeModelName} hazard multi-criteria dataset is currently in development for this
            geospatial domain. No simulated values are displayed.
          </div>
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {tab === "overview" &&
            (zone ? (
              <LocationTab
                zone={zone}
                hazardName={hazardName}
                hazardLower={hazardLower}
                isLandslide={isLandslide}
                coverage={coverage}
                onLayerEvidence={onLayerEvidence}
              />
            ) : (
              <EmptyState
                icon={<IconAnalyze size={20} />}
                title="No location selected"
                body="Click anywhere on the map or search a place above to inspect local susceptibility scores and contributing factors."
              />
            ))}

          {tab === "statistics" && <StatisticsTab stats={stats} hazardName={hazardName} />}

          {tab === "criteria" &&
            (zone ? (
              <FactorsTab zone={zone} onEvidence={onLayerEvidence} />
            ) : (
              <EmptyState
                icon={<IconChart size={20} />}
                title="Select a location"
                body="Click a location on the map to inspect its full criterion factor scores and weights."
              />
            ))}

          {tab === "evidence" &&
            (zone ? (
              <CoverageTab
                zone={zone}
                onEvidence={onLayerEvidence}
                isLandslide={isLandslide}
                onOpenHelp={onOpenHelp}
              />
            ) : (
              <EmptyState
                icon={<IconInfo size={20} />}
                title="Select a location"
                body="Click a location to view data integrity and valid evidence coverage."
              />
            ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   1. LOCATION TAB (Clean progressive disclosure)
───────────────────────────────────────────────────────────── */
function LocationTab({
  zone,
  hazardName,
  hazardLower: _hazardLower,
  isLandslide: _isLandslide,
  coverage,
  onLayerEvidence,
}: {
  zone: Zone;
  hazardName: string;
  hazardLower: string;
  isLandslide: boolean;
  coverage: ReturnType<typeof getCoverageInfo> | null;
  onLayerEvidence: (id: string) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const m = SUIT_META[zone.cls] || SUIT_META["low"];
  const criteria = zone.criteria || [];

  const validFactors = criteria.filter((c) => c.status === "VALID" || !c.status);
  const topContributors = [...validFactors]
    .filter((c) => c.contribution !== null)
    .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
    .slice(0, 4)
    .map((c) => ({
      name: c.name
        .replace("Terrain ", "")
        .replace("Distance to ", "Dist. ")
        .replace("Topographic ", "")
        .replace("Annual ", ""),
      fullName: c.name,
      pct: +((c.contribution ?? 0) * 100).toFixed(1),
      cls: c.cls,
      rawScore: c.rawScore,
      unit: c.unit,
      rating: c.rating,
      weight: c.weight,
      layerId: c.layerId,
    }));

  const isOutside = zone.finalStatus === "OUTSIDE_ANALYSIS_AREA";

  return (
    <div className="p-4 flex flex-col gap-4 pb-16">
      {/* Outside boundary alert if applicable */}
      {isOutside ? (
        <div
          className="p-3 rounded-lg"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <div className="text-xs font-semibold text-[#ef4444] mb-1">Outside Analysis Boundary</div>
          <p className="text-xs text-[var(--c-text2)] leading-relaxed">
            The selected point ({zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E) is outside the
            active spatial analysis boundary.
          </p>
        </div>
      ) : (
        /* Primary Section: Susceptibility Level & Canonical Score */
        <div
          className="p-3.5 rounded-lg flex flex-col gap-3"
          style={{
            background: "var(--c-panel)",
            border: "1px solid var(--c-border)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--c-text3)]">
                {hazardName} Susceptibility
              </span>
              <div className="flex items-center gap-2">
                <SuitBadge cls={zone.cls} />
                <span className="text-xs font-mono text-[var(--c-text2)]">
                  Class {zone.classifiedValue || 1} / 5
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-[var(--c-text3)] block">Model Score</span>
              <span
                className="text-2xl font-bold font-mono leading-none"
                style={{ color: m.color }}
              >
                {zone.score !== null && zone.score !== undefined ? zone.score.toFixed(2) : "N/A"}
              </span>
              <span className="text-[10px] text-[var(--c-text3)] font-mono ml-0.5">/ 5.00</span>
            </div>
          </div>

          {/* Clean Score Bar */}
          <ScoreBar value={(zone.score ?? 0) / 5.0} color={m.color} height={4} />

          {/* One concise coverage badge & concise explanation */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--c-border)]">
            <span className="text-[var(--c-text2)]">Data Coverage:</span>
            {coverage && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-mono font-medium"
                style={{
                  background: `${coverage.badgeColor}18`,
                  color: coverage.badgeColor,
                  border: `1px solid ${coverage.badgeColor}35`,
                }}
                title={coverage.tooltip}
              >
                {coverage.label} ({zone.evidenceCount ?? validFactors.length} of{" "}
                {zone.evidenceTotal || 11})
              </span>
            )}
          </div>

          <p className="text-xs text-[var(--c-text2)] leading-relaxed m-0">
            {m.label} indicates how local environmental conditions combine under the standardized{" "}
            {hazardName} model.
          </p>
        </div>
      )}

      {/* Secondary Section: Leading Contributing Factors */}
      {!isOutside && topContributors.length > 0 && (
        <div
          className="p-3.5 rounded-lg flex flex-col gap-2.5"
          style={{
            background: "var(--c-panel)",
            border: "1px solid var(--c-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--c-text)]">
              Leading Contributing Factors
            </span>
            <span className="text-[10px] text-[var(--c-text3)] font-mono">Weight Impact</span>
          </div>

          {/* Mini horizontal bar representation */}
          <div className="flex flex-col gap-2">
            {topContributors.map((factor) => (
              <div key={factor.fullName} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--c-text)] font-medium truncate max-w-[200px]">
                    {factor.fullName}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--c-text2)]">
                    {factor.pct}% contribution
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--c-track)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(factor.pct * 2.5, 100)}%`,
                      background: factor.cls === "positive" ? "#00b4d8" : "#f97316",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Technical Details Section */}
      {!isOutside && (
        <div className="border border-[var(--c-border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-3 text-xs font-medium text-[var(--c-text2)] hover:bg-[rgba(255,255,255,0.02)] transition-colors select-none"
          >
            <span>Advanced Technical Details</span>
            <span
              className="transition-transform duration-200"
              style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0)" }}
            >
              <IconChevronD size={11} />
            </span>
          </button>

          {showAdvanced && (
            <div className="p-3 pt-0 border-t border-[var(--c-border)] flex flex-col gap-2.5">
              <div className="text-[11px] text-[var(--c-text3)] pt-2">
                All Evaluated Factors & Ratings:
              </div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {criteria.map((c) => {
                  const isNoData = c.status === "NODATA" || c.rawScore === null;
                  return (
                    <div
                      key={c.name}
                      className="p-2 rounded text-xs flex items-center justify-between gap-2"
                      style={{
                        background: isNoData ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)",
                        border: "1px solid var(--c-border)",
                      }}
                    >
                      <div className="flex flex-col truncate">
                        <span className="font-medium text-[var(--c-text)] truncate">{c.name}</span>
                        <span className="text-[10px] text-[var(--c-text3)] font-mono">
                          w={(c.weight * 100).toFixed(1)}% · Rating: {c.rating ?? "N/A"}/5
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-mono text-[11px] text-[var(--c-text2)]">
                          {!isNoData && c.rawScore !== null
                            ? `${c.rawScore.toFixed(1)}${c.unit ? ` ${c.unit}` : ""}`
                            : "NoData"}
                        </span>
                        <button
                          onClick={() => onLayerEvidence(c.layerId)}
                          className="text-[10px] px-1.5 py-0.5 rounded text-[#00b4d8] border border-[rgba(0,180,216,0.25)] hover:bg-[rgba(0,180,216,0.1)]"
                          title="Show factor layer on map"
                        >
                          Map
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[10px] text-[var(--c-text3)] font-mono pt-1">
                Coordinates: {zone.lat.toFixed(5)}°N, {zone.lng.toFixed(5)}°E · 30m Grid Pixel
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. AREA SUMMARY TAB (Clear statewide aggregates)
───────────────────────────────────────────────────────────── */
function StatisticsTab({ stats, hazardName }: { stats: AnalysisStatistics; hazardName: string }) {
  const classDist = stats.class_distribution || [];
  const distChartData = classDist.map((d) => ({
    name: d.label,
    value: d.percentage,
    area: d.area_km2,
    color:
      d.class_value === 1
        ? "#00c896"
        : d.class_value === 2
          ? "#4ade80"
          : d.class_value === 3
            ? "#fbbf24"
            : d.class_value === 4
              ? "#f97316"
              : "#ef4444",
  }));

  const maxArea = Math.max(...classDist.map((d) => d.area_km2), 1);

  return (
    <div className="p-4 flex flex-col gap-4 pb-16">
      {/* Statewide Overview Box */}
      <div
        className="p-3.5 rounded-lg flex flex-col gap-2"
        style={{
          background: "var(--c-panel)",
          border: "1px solid var(--c-border)",
        }}
      >
        <div className="text-xs font-semibold text-[var(--c-text)]">
          Geospatial Domain Overview ({hazardName})
        </div>
        <p className="text-xs text-[var(--c-text2)] leading-relaxed m-0">
          Composite evaluation across 55,673 km² of mountainous terrain based on standardized
          30-meter resolution physical criteria.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="p-2 rounded bg-[var(--c-surface)] border border-[var(--c-border)]">
            <span className="text-[10px] text-[var(--c-text3)] block uppercase font-mono">
              Mean Score
            </span>
            <span className="text-base font-bold font-mono text-[#00b4d8]">
              {stats.score_mean?.toFixed(2) || "1.74"}
            </span>
            <span className="text-[10px] text-[var(--c-text3)] font-mono ml-1">/ 5.00</span>
          </div>

          <div className="p-2 rounded bg-[var(--c-surface)] border border-[var(--c-border)]">
            <span className="text-[10px] text-[var(--c-text3)] block uppercase font-mono">
              Data Coverage
            </span>
            <span className="text-base font-bold font-mono text-[#00c896]">
              {stats.valid_coverage_pct?.toFixed(1) || "98.4"}%
            </span>
            <span className="text-[10px] text-[var(--c-text3)] font-mono ml-1">HP boundary</span>
          </div>
        </div>
      </div>

      {/* Susceptibility Distribution (Donut & percentages) */}
      <div
        className="p-3.5 rounded-lg flex flex-col gap-2.5"
        style={{
          background: "var(--c-panel)",
          border: "1px solid var(--c-border)",
        }}
      >
        <span className="text-xs font-semibold text-[var(--c-text)]">
          Susceptibility Class Breakdown
        </span>

        <div className="flex items-center gap-3">
          <div className="flex-shrink-0" style={{ width: 100, height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={distChartData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={38}
                  paddingAngle={1}
                  stroke="none"
                >
                  {distChartData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {distChartData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: d.color }}
                  />
                  <span className="text-[var(--c-text2)] truncate">{d.name}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--c-text)] font-semibold">
                  {d.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area by Class (km²) */}
      <div
        className="p-3.5 rounded-lg flex flex-col gap-2.5"
        style={{
          background: "var(--c-panel)",
          border: "1px solid var(--c-border)",
        }}
      >
        <span className="text-xs font-semibold text-[var(--c-text)]">
          Area Coverage by Class (km²)
        </span>

        <div className="flex flex-col gap-2">
          {distChartData.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-16 truncate text-[var(--c-text2)]">{d.name}</span>
              <div
                className="flex-1 h-2 rounded-sm overflow-hidden"
                style={{ background: "var(--c-track)" }}
              >
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(d.area / maxArea) * 100}%`,
                    background: d.color,
                  }}
                />
              </div>
              <span className="w-16 text-right font-mono text-[11px] text-[var(--c-text)]">
                {d.area.toFixed(0)} km²
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   3. CONTRIBUTING FACTORS TAB (All factors & weights)
───────────────────────────────────────────────────────────── */
function FactorsTab({ zone, onEvidence }: { zone: Zone; onEvidence: (id: string) => void }) {
  const criteria = zone.criteria || [];

  return (
    <div className="p-4 flex flex-col gap-3 pb-16">
      <div className="text-xs text-[var(--c-text2)] leading-relaxed">
        Normalized criteria ratings (1–5) and relative AHP weights for the selected location:
      </div>

      <div className="flex flex-col gap-2">
        {criteria.map((c) => {
          const isNoData = c.status === "NODATA" || c.rawScore === null;
          return (
            <div
              key={c.name}
              className="p-3 rounded-lg flex flex-col gap-1.5"
              style={{
                background: isNoData ? "rgba(239,68,68,0.03)" : "var(--c-panel)",
                border: isNoData ? "1px dashed rgba(239,68,68,0.3)" : "1px solid var(--c-border)",
              }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--c-text)] truncate">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color: isNoData ? "#ef4444" : c.cls === "positive" ? "#00c896" : "#f97316",
                    }}
                  >
                    {!isNoData && c.rawScore !== null
                      ? `${c.rawScore.toFixed(1)}${c.unit ? ` ${c.unit}` : ""}`
                      : "NoData"}
                  </span>
                  <button
                    onClick={() => onEvidence(c.layerId)}
                    className="text-[10px] px-1.5 py-0.5 rounded text-[#00b4d8] border border-[rgba(0,180,216,0.25)] hover:bg-[rgba(0,180,216,0.1)]"
                  >
                    Show Layer
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ScoreBar
                    value={!isNoData && c.rating !== null ? c.rating / 5.0 : 0}
                    color={isNoData ? "#374f6a" : c.cls === "positive" ? "#00b4d8" : "#f97316"}
                    height={3}
                  />
                </div>
                <span className="text-[10px] font-mono text-[var(--c-text3)]">
                  Weight: {(c.weight * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. COVERAGE TAB (Data Integrity & Missing Criteria)
───────────────────────────────────────────────────────────── */
function CoverageTab({
  zone,
  onEvidence: _onEvidence,
  isLandslide = false,
  onOpenHelp,
}: {
  zone: Zone;
  onEvidence: (id: string) => void;
  isLandslide?: boolean;
  onOpenHelp?: (section?: "guide" | "data-models") => void;
}) {
  const coverage = getCoverageInfo(zone.finalStatus, zone.evidenceCount, zone.evidenceTotal);
  const criteria = zone.criteria || [];

  const missingNames = (zone.missingCriteria || []).map((cId) => {
    const row = criteria.find((c) => c.criterionId === cId || c.layerId === cId);
    return row ? row.name : cId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  });

  return (
    <div className="p-4 flex flex-col gap-4 pb-16">
      {/* Coverage Status Summary */}
      <div
        className="p-3.5 rounded-lg flex flex-col gap-2"
        style={{
          background: "var(--c-panel)",
          border: `1px solid ${coverage.badgeColor}35`,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: coverage.badgeColor }}>
            Analysis Coverage Status
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
            style={{
              background: `${coverage.badgeColor}20`,
              color: coverage.badgeColor,
            }}
          >
            {coverage.status}
          </span>
        </div>
        <p className="text-xs text-[var(--c-text2)] leading-relaxed m-0">
          {coverage.status === "COMPLETE" &&
            `Complete coverage: All ${zone.evidenceTotal || (isLandslide ? 14 : 11)} physical criteria are validated and present for this coordinate.`}
          {coverage.status === "PARTIAL" &&
            `Partial coverage: Evaluated using ${zone.evidenceCount ?? (isLandslide ? 12 : 10)} of ${zone.evidenceTotal || (isLandslide ? 14 : 11)} criteria. Missing factor weights are dynamically renormalized.`}
          {coverage.status === "UNAVAILABLE" &&
            "Analysis unavailable: Insufficient validated physical criteria are present for this location."}
        </p>
      </div>

      {/* Missing evidence details if any */}
      {missingNames.length > 0 && (
        <div
          className="p-3.5 rounded-lg flex flex-col gap-1.5"
          style={{
            background: "rgba(249,115,22,0.06)",
            border: "1px solid rgba(249,115,22,0.25)",
          }}
        >
          <span className="text-xs font-semibold text-[#f97316]">
            Missing Factors at this Location ({missingNames.length})
          </span>
          <p className="text-xs text-[var(--c-text2)] m-0">
            The following factors have localized NoData:
          </p>
          <ul className="text-xs text-[var(--c-text)] list-disc list-inside space-y-0.5 mt-1">
            {missingNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Data provenance info */}
      <div
        className="p-3.5 rounded-lg flex flex-col gap-2"
        style={{
          background: "var(--c-panel)",
          border: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--c-text)]">Data Sources & Integrity</span>
          {onOpenHelp && (
            <button
              onClick={() => onOpenHelp("data-models")}
              className="text-[11px] font-medium text-[var(--c-accent)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Specifications</span>
              <span>→</span>
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--c-text2)] leading-relaxed m-0">
          Evaluated criteria are derived from verified spatial products including SRTM DEM, CHIRPS
          precipitation, ESA WorldCover, and SoilGrids at 30-meter ground resolution.
        </p>
      </div>
    </div>
  );
}


