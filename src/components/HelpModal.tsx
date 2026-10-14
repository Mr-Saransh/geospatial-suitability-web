import { useEffect, useRef, useState } from "react";
import { Modal, Mono } from "../ui";
import type { ModelDetail } from "../lib/api/types";
import {
  IconSearch,
  IconMap,
  IconLayers,
  IconChart,
  IconLocate,
  IconAnalyze,
  IconBot,
  IconExport,
  IconChevronD,
  IconInfo,
} from "../icons";

interface Props {
  onClose: () => void;
  modelDetail?: ModelDetail | null;
  activeModelId?: string;
  activeModelName?: string;
}

interface HelpItem {
  icon: (p: { size?: number; style?: React.CSSProperties }) => React.ReactNode;
  iconColor: string;
  title: string;
  tag: string;
  description: string;
  hint: string;
}

const HELP_TOPICS: HelpItem[] = [
  {
    icon: IconSearch,
    iconColor: "var(--c-accent)",
    title: "Find Places or Coordinates",
    tag: "Search",
    description:
      "Type a Himachal district or town name (e.g. Shimla, Kullu, Dharamshala) or enter coordinates in decimal degrees (e.g. 31.1048, 77.1734).",
    hint: "Press Enter or click a suggestion to pan and inspect that location.",
  },
  {
    icon: IconMap,
    iconColor: "var(--c-sand)",
    title: "Select Study Area & Model",
    tag: "Hazard Model",
    description:
      "Choose between Flood (11-factor AHP) or Landslide (14-factor MCDA) multi-criteria hazard models from the top bar or left sidebar.",
    hint: "Each model evaluates tailored physical determinants and weights.",
  },
  {
    icon: IconLayers,
    iconColor: "var(--c-accent)",
    title: "Toggle & Inspect Map Layers",
    tag: "Map Layers",
    description:
      "Click the 'Layers' button in the top toolbar to open the floating Map Layers panel. Toggle classified susceptibility, continuous indices, or factor rasters.",
    hint: "Click any layer row to focus it, or expand to adjust opacity.",
  },
  {
    icon: IconLocate,
    iconColor: "var(--c-sand)",
    title: "Map Legend & Relative Risk",
    tag: "1–5 Scale",
    description:
      "Susceptibility ranges from Very Low (1, Green) to Very High (5, Red). Scores reflect multi-criteria environmental combinations.",
    hint: "Note: Model scores indicate relative susceptibility, not an event guarantee.",
  },
  {
    icon: IconAnalyze,
    iconColor: "var(--c-accent)",
    title: "Inspect Any Location",
    tag: "Point Inspection",
    description:
      "Click anywhere on the Himachal Pradesh map to inspect local susceptibility, canonical 1–5 score, and analysis data coverage.",
    hint: "Coverage badges indicate Complete, Partial, or Unavailable evidence.",
  },
  {
    icon: IconChart,
    iconColor: "var(--c-sand)",
    title: "Contributing Factors & Area Summary",
    tag: "Analytics",
    description:
      "View the leading environmental determinants driving local hazard scores, alongside statewide class distributions and km² area coverage.",
    hint: "Switch between Location Details and Area Summary in the right panel.",
  },
  {
    icon: IconBot,
    iconColor: "var(--c-accent)",
    title: "Consult the AI Assistant",
    tag: "AI Copilot",
    description:
      "Click AI Assistant in the top toolbar to ask natural language questions about local susceptibility factors, criteria weights, or model methodology.",
    hint: "The assistant opens independently without resetting your map view.",
  },
  {
    icon: IconExport,
    iconColor: "var(--c-sand)",
    title: "Export Results & GIS Data",
    tag: "Export",
    description:
      "Download summary tables (CSV), GeoTIFF rasters, high-resolution map views, or formatted scientific reports.",
    hint: "Available through the Export button in the top navigation.",
  },
];

export default function HelpModal({
  onClose,
  modelDetail,
  activeModelId,
  activeModelName = "Flood",
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [showDataModels, setShowDataModels] = useState(false);
  const [showTechnicalAudit, setShowTechnicalAudit] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isLandslide =
    (activeModelId?.includes("landslide") || activeModelName.toLowerCase().includes("landslide")) ??
    false;
  const hazardName = isLandslide ? "Landslide" : activeModelName || "Flood";

  const publicMetadataRows: [string, string][] = [
    ["Hazard Model", `${hazardName} Multi-Criteria Susceptibility Evaluation`],
    ["Analysis Area", "Himachal Pradesh, India (Statewide Boundary)"],
    ["Spatial Resolution", "30 m ground pixel resolution"],
    ["Coordinate Reference System", String(isLandslide ? "EPSG:32643 (UTM 43N)" : "EPSG:4326 (WGS84)")],
    ["Factor Count", `${modelDetail?.criterion_count || (isLandslide ? 14 : 11)} physical criteria`],
    ["Methodology", isLandslide ? "Multi-Criteria Decision Analysis (MCDA)" : "Analytical Hierarchy Process (AHP Saaty)"],
    ["Published Date", "September 2026 (Canonical Spatial Package v1.0)"],
  ];

  const weights = modelDetail?.weights || (isLandslide ? [
    { criterion_id: "slope", weight: 0.23 },
    { criterion_id: "lithology", weight: 0.15 },
    { criterion_id: "lineament_density", weight: 0.15 },
    { criterion_id: "drainage_density", weight: 0.09 },
    { criterion_id: "rainfall_10_year", weight: 0.08 },
    { criterion_id: "relative_relief", weight: 0.07 },
    { criterion_id: "twi", weight: 0.05 },
    { criterion_id: "geomorphology", weight: 0.04 },
    { criterion_id: "soil", weight: 0.04 },
    { criterion_id: "distance_to_faults", weight: 0.03 },
    { criterion_id: "distance_to_roads", weight: 0.03 },
    { criterion_id: "lulc", weight: 0.02 },
    { criterion_id: "aspect", weight: 0.01 },
    { criterion_id: "ndvi", weight: 0.01 },
  ] : [
    { criterion_id: "slope", weight: 0.230588 },
    { criterion_id: "distance_to_rivers", weight: 0.148021 },
    { criterion_id: "twi", weight: 0.142168 },
    { criterion_id: "rainfall", weight: 0.132592 },
    { criterion_id: "flow_accumulation", weight: 0.111538 },
    { criterion_id: "drainage_density", weight: 0.066758 },
    { criterion_id: "lulc", weight: 0.057282 },
    { criterion_id: "elevation", weight: 0.034521 },
    { criterion_id: "soil", weight: 0.03173 },
    { criterion_id: "curvature", weight: 0.028179 },
    { criterion_id: "ndvi", weight: 0.016624 },
  ]);

  return (
    <Modal title="Help & Documentation" onClose={onClose} width={760}>
      <div className="p-4 sm:p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto" ref={modalRef}>
        {/* Intro */}
        <div
          className="p-3.5 rounded-lg flex items-start gap-3"
          style={{
            background: "var(--c-accent-dim)",
            border: "1px solid var(--c-accent)",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--c-accent)",
              color: "var(--c-base)",
            }}
          >
            <IconMap size={16} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[13px] font-semibold text-[var(--c-text)]">
              Himachal Pradesh Multi-Criteria Spatial Evaluation Platform
            </div>
            <div className="text-xs text-[var(--c-text2)] leading-relaxed">
              MCGSE combines high-resolution environmental datasets (terrain, hydrology, geology,
              precipitation) to evaluate relative hazard susceptibility across Himachal Pradesh at
              30-meter resolution.
            </div>
          </div>
        </div>

        {/* 2-column grid of user guide topics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {HELP_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <div
                key={topic.title}
                className="p-3 rounded-lg flex flex-col justify-between transition-colors"
                style={{
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          background: "var(--c-accent-dim)",
                          color: topic.iconColor,
                        }}
                      >
                        <Icon size={13} />
                      </div>
                      <span className="text-[12.5px] font-semibold text-[var(--c-text)]">
                        {topic.title}
                      </span>
                    </div>
                    <span
                      className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--c-text3)",
                        border: "1px solid var(--c-border)",
                      }}
                    >
                      {topic.tag}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--c-text2)] leading-relaxed mb-2">
                    {topic.description}
                  </p>
                </div>
                <div
                  className="text-[10.5px] pt-1.5 border-t flex items-center gap-1.5"
                  style={{
                    borderColor: "var(--c-border)",
                    color: "var(--c-text3)",
                  }}
                >
                  <span style={{ color: "var(--c-accent)" }} className="font-bold">›</span>
                  <span className="truncate">{topic.hint}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Collapsible Section: About the Data & Models ─── */}
        <div
          className="rounded-lg overflow-hidden border"
          style={{
            background: "var(--c-panel)",
            borderColor: "var(--c-border)",
          }}
        >
          <button
            onClick={() => setShowDataModels(!showDataModels)}
            className="w-full flex items-center justify-between p-3.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)] cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <IconInfo size={15} style={{ color: "var(--c-accent)" }} />
              <div>
                <span className="text-xs font-semibold text-[var(--c-text)]">
                  About the Data & Models
                </span>
                <span className="text-[11px] text-[var(--c-text3)] block">
                  Technical specifications, spatial CRS, methodology, factor weights & data provenance
                </span>
              </div>
            </div>
            <span
              className="text-xs transition-transform duration-200"
              style={{
                color: "var(--c-text3)",
                transform: showDataModels ? "rotate(180deg)" : "rotate(0)",
              }}
            >
              <IconChevronD size={13} />
            </span>
          </button>

          {showDataModels && (
            <div className="p-4 border-t border-[var(--c-border)] flex flex-col gap-4">
              {/* Dataset & Model Provenance Table */}
              <div
                className="p-3 rounded-lg flex flex-col gap-1.5"
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                }}
              >
                <span className="text-xs font-semibold text-[var(--c-text)] mb-1">
                  Model Specifications & Coordinate Systems
                </span>
                {publicMetadataRows.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-xs py-1 border-b border-[var(--c-border)] last:border-0"
                  >
                    <span className="text-[var(--c-text3)]">{k}</span>
                    <span className="font-mono text-[var(--c-text)] text-[11px]">{v}</span>
                  </div>
                ))}
              </div>

              {/* Synthesized Factor Weights */}
              <div
                className="p-3 rounded-lg flex flex-col gap-2"
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--c-text)]">
                    Synthesized Factor Weights ({hazardName} Model)
                  </span>
                  <span className="text-[10px] font-mono text-[var(--c-text3)]">
                    Total: 100.0%
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {weights.map((w) => (
                    <div
                      key={w.criterion_id}
                      className="flex items-center justify-between text-xs py-0.5 border-b border-[var(--c-border)] last:border-0"
                    >
                      <span className="text-[var(--c-text2)] capitalize">
                        {w.criterion_id.replace(/_/g, " ")}
                      </span>
                      <Mono color="var(--c-accent)">{(w.weight * 100).toFixed(2)}%</Mono>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expandable Technical Pipeline Audit */}
              <div className="pt-1">
                <button
                  onClick={() => setShowTechnicalAudit(!showTechnicalAudit)}
                  className="text-xs text-[var(--c-accent)] font-mono hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{showTechnicalAudit ? "▾" : "▸"}</span>
                  <span>{showTechnicalAudit ? "Hide Technical Pipeline Audit" : "View Technical Pipeline Audit (Saaty Consistency)"}</span>
                </button>

                {showTechnicalAudit && (
                  <div
                    className="mt-2 p-3 rounded text-[11px] font-mono flex flex-col gap-1.5"
                    style={{
                      background: "var(--c-surface)",
                      border: "1px solid var(--c-border)",
                    }}
                  >
                    <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                      <span className="text-[var(--c-text3)]">Model ID</span>
                      <span className="text-[var(--c-text)]">
                        {modelDetail?.model_id || activeModelId || "flood_11_factor_v1"}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                      <span className="text-[var(--c-text3)]">AHP Consistency Ratio (CR)</span>
                      <span style={{ color: "var(--c-accent)" }}>
                        {modelDetail?.consistency_ratio !== undefined
                          ? modelDetail.consistency_ratio.toFixed(4)
                          : "0.0158"}{" "}
                        (&lt; 0.10 Saaty Consistent)
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                      <span className="text-[var(--c-text3)]">Data Sources</span>
                      <span className="text-[var(--c-text2)]">
                        SRTM DEM (NASA), CHIRPS v2.0, Copernicus Sentinel-2 LULC, GSI
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-[var(--c-text3)]">Scoring Engine</span>
                      <span className="text-[var(--c-text2)]">
                        MCGSE Spatial Engine · Renormalized Available Evidence
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border)] text-xs text-[var(--c-text3)]">
          <span>
            Keyboard shortcut: Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--c-panel)] border border-[var(--c-border)] text-[var(--c-text)] font-mono text-[10px]">
              ESC
            </kbd>{" "}
            to close
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded text-xs font-semibold transition-colors cursor-pointer"
            style={{
              background: "var(--c-accent)",
              color: "var(--c-base)",
            }}
          >
            Got it, explore map
          </button>
        </div>
      </div>
    </Modal>
  );
}
