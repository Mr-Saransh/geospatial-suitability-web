import { useEffect, useRef, useState } from "react";
import { Modal, Mono } from "../ui";
import type { ModelDetail } from "../lib/api/types";
import { CRITERIA_INFO } from "../data";
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
  IconHelp,
  IconDatabase,
} from "../icons";

interface Props {
  onClose: () => void;
  modelDetail?: ModelDetail | null;
  activeModelId?: string;
  activeModelName?: string;
  defaultSection?: "guide" | "data-models";
  backendStatus?: "connected" | "connecting" | "offline";
  onReconnect?: () => void;
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
      "Choose between Flood or Landslide multi-criteria hazard models from the top bar or left sidebar.",
    hint: "Each model evaluates tailored physical determinants and weights.",
  },
  {
    icon: IconLayers,
    iconColor: "var(--c-accent)",
    title: "Toggle & Inspect Map Layers",
    tag: "Map Layers",
    description:
      "Click the 'Layers' button in the top toolbar or right map controls to open the floating Map Layers panel. Toggle classified susceptibility, continuous indices, or factor rasters.",
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
  defaultSection = "guide",
  backendStatus = "connecting",
  onReconnect,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<"guide" | "data-models">(defaultSection);
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
    ["Evaluation Methodology", isLandslide ? "Multi-Criteria Decision Analysis (MCDA)" : "Analytical Hierarchy Process (AHP Saaty)"],
    ["Canonical Scale", "1 to 5 Relative Susceptibility (Very Low to Very High)"],
    ["Scoring Normalization", "Renormalized Available Evidence + Strict Verification"],
    ["Spatial Package Release", "September 2026 · Canonical Package v1.0"],
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
    <Modal title="Help & Documentation" onClose={onClose} width={800}>
      <div className="p-4 sm:p-6 flex flex-col gap-4" ref={modalRef}>
        {/* ─── Top Section Navigation Tabs (Sticky) ─── */}
        <div
          className="sticky top-0 z-10 -mt-4 sm:-mt-6 pt-4 sm:pt-6 pb-2.5 flex items-center flex-shrink-0"
          style={{
            background: "var(--c-surface)",
            borderBottom: "1px solid var(--c-border)",
          }}
        >
          <div
            className="flex items-center gap-1.5 p-1 rounded-lg w-full"
            style={{
              background: "var(--c-panel)",
              border: "1px solid var(--c-border)",
            }}
          >
            <button
              onClick={() => setActiveSection("guide")}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: activeSection === "guide" ? "var(--c-surface)" : "transparent",
                color: activeSection === "guide" ? "var(--c-text)" : "var(--c-text3)",
                boxShadow: activeSection === "guide" ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
                border: activeSection === "guide" ? "1px solid var(--c-border2)" : "1px solid transparent",
              }}
            >
              <IconHelp size={14} style={{ color: activeSection === "guide" ? "var(--c-accent)" : "currentColor" }} />
              <span>Platform Guide</span>
            </button>

            <button
              onClick={() => setActiveSection("data-models")}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: activeSection === "data-models" ? "var(--c-surface)" : "transparent",
                color: activeSection === "data-models" ? "var(--c-text)" : "var(--c-text3)",
                boxShadow: activeSection === "data-models" ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
                border: activeSection === "data-models" ? "1px solid var(--c-border2)" : "1px solid transparent",
              }}
            >
              <IconDatabase size={14} style={{ color: activeSection === "data-models" ? "var(--c-accent)" : "currentColor" }} />
              <span>About the Data & Models</span>
              <span
                className="hidden sm:inline-block text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium"
                style={{
                  background: activeSection === "data-models" ? "var(--c-accent-dim)" : "rgba(255,255,255,0.05)",
                  color: activeSection === "data-models" ? "var(--c-accent)" : "var(--c-text3)",
                  border: "1px solid var(--c-border)",
                }}
              >
                Technical Specs
              </span>
            </button>
          </div>
        </div>

        {/* Backend & Spatial Engine Status Banner */}
        <div
          className="p-3.5 rounded-lg flex items-center justify-between gap-3 mb-4"
          style={{
            background: "var(--c-panel)",
            border: `1px solid ${
              backendStatus === "connected"
                ? "rgba(16, 185, 129, 0.3)"
                : backendStatus === "connecting"
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  backendStatus === "connected"
                    ? "rgba(16, 185, 129, 0.15)"
                    : backendStatus === "connecting"
                      ? "rgba(245, 158, 11, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                color:
                  backendStatus === "connected"
                    ? "#10b981"
                    : backendStatus === "connecting"
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${backendStatus === "connecting" ? "animate-ping" : ""}`}
                style={{
                  background:
                    backendStatus === "connected"
                      ? "#10b981"
                      : backendStatus === "connecting"
                        ? "#f59e0b"
                        : "#ef4444",
                }}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--c-text)]">
                  MCGSE Spatial Engine & API
                </span>
                <span
                  className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    background:
                      backendStatus === "connected"
                        ? "rgba(16, 185, 129, 0.12)"
                        : backendStatus === "connecting"
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                    color:
                      backendStatus === "connected"
                        ? "#10b981"
                        : backendStatus === "connecting"
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                >
                  {backendStatus === "connected"
                    ? "Live & Synchronized"
                    : backendStatus === "connecting"
                      ? "Connecting..."
                      : "Offline"}
                </span>
              </div>
              <span className="text-[11px] text-[var(--c-text3)]">
                {backendStatus === "connected"
                  ? "FastAPI server and ngrok tunnel are synchronized. Raster GeoTIFFs, point inspection, and spatial stats are active."
                  : "Backend is connecting or offline. Double-click 'Start MCGSE Backend' on your desktop to start."}
              </span>
            </div>
          </div>

          {backendStatus !== "connected" && onReconnect && (
            <button
              onClick={onReconnect}
              className="px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all hover:brightness-110 flex-shrink-0"
              style={{
                background: "var(--c-accent)",
                color: "var(--c-base)",
              }}
            >
              Retry Connection
            </button>
          )}
        </div>

        {/* ─── SECTION 1: PLATFORM GUIDE ─── */}
        {activeSection === "guide" && (
          <div className="flex flex-col gap-4">
            {/* Intro banner */}
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

            {/* Callout Card linking to Data & Models Section */}
            <div
              onClick={() => setActiveSection("data-models")}
              className="p-3.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.02)]"
              style={{
                background: "var(--c-panel)",
                borderColor: "var(--c-border)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "var(--c-accent-dim)",
                    color: "var(--c-accent)",
                  }}
                >
                  <IconInfo size={14} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--c-text)]">
                    Need Technical Methodology & Factor Weights?
                  </div>
                  <div className="text-[11px] text-[var(--c-text3)]">
                    View spatial reference systems, Saaty consistency ratios, factor weights, and data sources in the About the Data & Models section.
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold text-[var(--c-accent)] flex items-center gap-1 flex-shrink-0 ml-3">
                <span>Open Data & Models</span>
                <span>→</span>
              </span>
            </div>
          </div>
        )}

        {/* ─── SECTION 2: ABOUT THE DATA & MODELS ─── */}
        {activeSection === "data-models" && (
          <div className="flex flex-col gap-4">
            {/* Technical Section Overview Header */}
            <div
              className="p-3.5 rounded-lg flex items-start gap-3"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: "var(--c-accent-dim)",
                  color: "var(--c-accent)",
                  border: "1px solid var(--c-accent)",
                }}
              >
                <IconDatabase size={16} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-[var(--c-text)]">
                    {hazardName} Multi-Criteria Spatial Model Specifications
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-mono font-medium"
                    style={{
                      background: "var(--c-accent-dim)",
                      color: "var(--c-accent)",
                    }}
                  >
                    Statewide 30m Grid
                  </span>
                </div>
                <div className="text-xs text-[var(--c-text2)] leading-relaxed">
                  Canonical Spatial Package metadata, mathematical decision matrices, coordinate reference systems,
                  and environmental factor contributions for Himachal Pradesh.
                </div>
              </div>
            </div>

            {/* Model Specifications & Coordinate Reference System */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--c-border)]">
                <span className="text-xs font-semibold text-[var(--c-text)]">
                  Model Specifications & Coordinate Systems
                </span>
                <span className="text-[10px] font-mono text-[var(--c-text3)]">
                  Himachal Pradesh Domain
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {publicMetadataRows.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--c-border)] last:border-0"
                  >
                    <span className="text-[var(--c-text3)]">{k}</span>
                    <span className="font-mono text-[var(--c-text)] text-[11px] font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Synthesized Factor Weights Table (Full Clean View) */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2.5"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                <div>
                  <span className="text-xs font-semibold text-[var(--c-text)] block">
                    Synthesized Factor Weights ({hazardName} Model)
                  </span>
                  <span className="text-[10.5px] text-[var(--c-text3)]">
                    Calculated using Saaty Pairwise Comparison Matrix (AHP Saaty Scale 1–9)
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold text-[var(--c-accent)]">
                  Total Weight: 100.0%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                {weights.map((w) => {
                  const info = CRITERIA_INFO[w.criterion_id];
                  const label = info?.label || w.criterion_id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  const pct = (w.weight * 100).toFixed(2);
                  return (
                    <div
                      key={w.criterion_id}
                      className="p-2.5 rounded flex flex-col gap-1 transition-colors"
                      style={{
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border)",
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--c-text)] truncate max-w-[170px]">
                          {label}
                        </span>
                        <Mono color="var(--c-accent)">{pct}%</Mono>
                      </div>

                      {/* Weight progress bar */}
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--c-track)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(w.weight * 350, 100)}%`,
                            background: "var(--c-accent)",
                          }}
                        />
                      </div>

                      {info && (
                        <div className="flex items-center justify-between text-[10px] text-[var(--c-text3)] pt-0.5">
                          <span>Unit: {info.unit || "Normalized"}</span>
                          <span className="truncate max-w-[140px] font-mono">{info.source.split(" ")[0]}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Authoritative Data Sources & Spatial Provenance */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2.5"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                <span className="text-xs font-semibold text-[var(--c-text)]">
                  Authoritative Data Sources & Spatial Provenance
                </span>
                <span className="text-[10px] font-mono text-[var(--c-text3)]">
                  Verified Datasets
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  {
                    domain: "Topography & Elevation",
                    source: "NASA SRTM DEM (30 m)",
                    desc: "Digital elevation model driving slope gradient, curvature, relief, and flow direction calculations.",
                  },
                  {
                    domain: "Climatology & Rainfall",
                    source: "CHIRPS v2.0 (0.05° ~ 5 km)",
                    desc: "30-year rainfall averages downscaled to 30 m via topographic lapse rate regression.",
                  },
                  {
                    domain: "Hydrology & Flow",
                    source: "HydroSHEDS / Copernicus",
                    desc: "Stream corridors, drainage network density, and Topographic Wetness Index (TWI).",
                  },
                  {
                    domain: "Geology & Structures",
                    source: "Geological Survey of India (GSI)",
                    desc: "1:50,000 litho-stratigraphic units, tectonic lineament density, and seismic fault proximity.",
                  },
                  {
                    domain: "Land Cover & Vegetation",
                    source: "ESA WorldCover & Sentinel-2",
                    desc: "10 m global land cover classification and Sentinel-2 seasonal NDVI vegetation density.",
                  },
                  {
                    domain: "Pedology & Soils",
                    source: "SoilGrids / ICAR-NBSS&LUP",
                    desc: "Soil texture, hydrologic soil groups (HSG), and effective rooting depth parameters.",
                  },
                ].map((s) => (
                  <div
                    key={s.domain}
                    className="p-2.5 rounded flex flex-col gap-1"
                    style={{
                      background: "var(--c-surface)",
                      border: "1px solid var(--c-border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--c-text)]">{s.domain}</span>
                      <span className="text-[10px] font-mono text-[var(--c-accent)]">{s.source}</span>
                    </div>
                    <p className="text-[11px] text-[var(--c-text2)] leading-relaxed m-0">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mathematical Validation & Saaty Consistency Ratio */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--c-text)]">
                  Mathematical Decision Consistency
                </span>
                <button
                  onClick={() => setShowTechnicalAudit(!showTechnicalAudit)}
                  className="text-xs text-[var(--c-accent)] font-mono hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{showTechnicalAudit ? "Hide matrix audit" : "View matrix audit"}</span>
                  <IconChevronD
                    size={11}
                    style={{
                      transform: showTechnicalAudit ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>
              </div>

              <p className="text-xs text-[var(--c-text2)] leading-relaxed m-0">
                The Saaty Consistency Ratio (CR) measures judgment consistency in pairwise factor ratings.
                CR must remain under 0.10 (10%) for a model to be validated. Current model CR:{" "}
                <strong className="text-[var(--c-accent)] font-mono">0.0158 (1.58%)</strong> — verified mathematically consistent.
              </p>

              {showTechnicalAudit && (
                <div
                  className="mt-1 p-3 rounded text-[11px] font-mono flex flex-col gap-1.5"
                  style={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                  }}
                >
                  <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                    <span className="text-[var(--c-text3)]">Model Package ID</span>
                    <span className="text-[var(--c-text)]">
                      {modelDetail?.model_id || activeModelId || "flood_11_factor_v1"}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                    <span className="text-[var(--c-text3)]">Saaty Consistency Ratio (CR)</span>
                    <span style={{ color: "var(--c-accent)" }}>0.0158 (&lt; 0.10 Pass)</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                    <span className="text-[var(--c-text3)]">Principal Eigenvalue (λmax)</span>
                    <span className="text-[var(--c-text)]">11.238</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-[var(--c-border)]">
                    <span className="text-[var(--c-text3)]">Random Index (RI)</span>
                    <span className="text-[var(--c-text)]">1.51 (n=11)</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-[var(--c-text3)]">Scoring Engine</span>
                    <span className="text-[var(--c-text2)]">MCGSE Spatial Engine · Renormalized Available Evidence</span>
                  </div>
                </div>
              )}
            </div>

            {/* Scientific Integrity Note */}
            <div
              className="p-3 rounded-lg text-xs leading-relaxed"
              style={{
                background: "rgba(208, 168, 111, 0.08)",
                border: "1px solid rgba(208, 168, 111, 0.25)",
                color: "var(--c-text2)",
              }}
            >
              <strong className="text-[var(--c-sand)]">Scientific Usage Note: </strong>
              Susceptibility scores represent a relative physical model-based evaluation of site characteristics and environmental predisposition. They do not constitute an operational forecast or guarantee of immediate event occurrence.
            </div>
          </div>
        )}

        {/* ─── Footer Controls ─── */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border)] text-xs text-[var(--c-text3)] flex-shrink-0">
          <span>
            Keyboard shortcut: Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--c-panel)] border border-[var(--c-border)] text-[var(--c-text)] font-mono text-[10px]">
              ESC
            </kbd>{" "}
            to close
          </span>

          <div className="flex items-center gap-2">
            {activeSection === "guide" ? (
              <button
                onClick={() => setActiveSection("data-models")}
                className="h-8 px-3 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                  color: "var(--c-text)",
                }}
              >
                <span>View Data & Models</span>
                <span>→</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveSection("guide")}
                className="h-8 px-3 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                  color: "var(--c-text)",
                }}
              >
                <span>← Back to Guide</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="h-8 px-4 rounded text-xs font-semibold transition-colors cursor-pointer"
              style={{
                background: "var(--c-accent)",
                color: "var(--c-base)",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
