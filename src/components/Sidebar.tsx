import { useState, type ReactNode } from "react";
import { SUIT_META, SUIT_ORDER, HIMACHAL_LOCATIONS } from "../data";
import type { Layer } from "../types";
import {
  IconEye,
  IconEyeOff,
  IconInfo,
  IconChevronD,
  IconChevronR,
  IconSettings,
  IconRefresh,
  IconGlobe,
} from "../icons";
import { Btn, Pill } from "../ui";

const BASEMAPS = [
  { id: "dark", label: "Dark Canvas", color: "#080d18" },
  { id: "satellite", label: "Satellite", color: "#1a2e1a" },
  { id: "topo", label: "Topographic", color: "#1e1a2e" },
  { id: "streets", label: "OpenStreet", color: "#1a1e2e" },
];

interface Props {
  open: boolean;
  layers: Layer[];
  setLayers: (l: Layer[]) => void;
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onLayerEvidence: (id: string) => void;
  basemap: string;
  onBasemap: (b: string) => void;
  onSelectLocation?: (loc: { lat: number; lng: number }) => void;
  modelName?: string;
  onModelChange?: (m: string) => void;
  activeModelId?: string;
  onRefresh?: () => void;
}

export default function Sidebar({
  open,
  layers,
  setLayers,
  activeLayerId,
  onSelectLayer,
  onLayerEvidence,
  basemap,
  onBasemap,
  onSelectLocation,
  modelName = "Flood",
  onModelChange,
  activeModelId,
  onRefresh,
}: Props) {
  const isLandslide =
    (activeModelId?.includes("landslide") || modelName.toLowerCase().includes("landslide")) ??
    false;
  const hazardName = isLandslide ? "Landslide" : modelName || "Flood";

  const [section, setSection] = useState<Record<string, boolean>>({
    analysis: true,
    layers: true,
    legend: true,
    filters: false,
    basemap: false,
    options: false,
  });
  const [selectedDistrict, setSelectedDistrict] = useState("Shimla");

  const toggle = (k: string) => setSection((s) => ({ ...s, [k]: !s[k] }));

  const toggleLayer = (id: string) => {
    setLayers(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
    onSelectLayer(id);
  };

  const setOpacity = (id: string, v: number) => {
    setLayers(layers.map((l) => (l.id === id ? { ...l, opacity: v } : l)));
  };

  const showAll = () => setLayers(layers.map((l) => ({ ...l, visible: true })));
  const hideAll = () => setLayers(layers.map((l) => ({ ...l, visible: false })));

  const handleDistrictChange = (distName: string) => {
    setSelectedDistrict(distName);
    const loc = HIMACHAL_LOCATIONS.find(
      (l) =>
        l.name.toLowerCase() === distName.toLowerCase() ||
        l.district.toLowerCase() === distName.toLowerCase(),
    );
    if (loc && onSelectLocation) {
      onSelectLocation({ lat: loc.lat, lng: loc.lng });
    }
  };

  // Dynamic result count derived from actual layer catalog
  const resultCount = layers.filter(
    (l) => l.layerType === "RESULT" || l.id.includes("suitability"),
  ).length;

  // Canonical results order
  const RESULT_ORDER = [
    "flood_11_factor_v1_available_evidence_suitability_classified",
    "flood_11_factor_v1_available_evidence_suitability",
    "flood_11_factor_v1_strict_suitability_classified",
    "flood_11_factor_v1_strict_suitability",
    "landslide_14_factor_v1_available_evidence_suitability_classified",
    "landslide_14_factor_v1_available_evidence_suitability",
    "landslide_14_factor_v1_strict_suitability_classified",
    "landslide_14_factor_v1_strict_suitability",
  ];

  // Semantic sidebar sections with zero duplicate display names
  const SECTIONS = [
    {
      id: "results",
      label: "Analysis Results",
      badge: `${resultCount}`,
      layers: layers
        .filter(
          (l) =>
            l.group === "composite" || l.layerType === "RESULT" || l.id.includes("suitability"),
        )
        .sort((a, b) => {
          const idxA = RESULT_ORDER.indexOf(a.id);
          const idxB = RESULT_ORDER.indexOf(b.id);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        }),
    },
    {
      id: "hydro_factors",
      label: "Hydrological Criteria",
      badge: "Raw",
      layers: layers.filter(
        (l) => l.group === "hydrological" && (l.layerType === "FACTOR" || !l.id.includes("rating")),
      ),
    },
    {
      id: "hydro_ratings",
      label: "Standardized Ratings",
      badge: "Hydrological (1–5)",
      layers: layers.filter(
        (l) => l.group === "hydrological" && (l.layerType === "RATING" || l.id.includes("rating")),
      ),
    },
    {
      id: "topo_factors",
      label: "Topographic Criteria",
      badge: "Raw",
      layers: layers.filter(
        (l) => l.group === "topographic" && (l.layerType === "FACTOR" || !l.id.includes("rating")),
      ),
    },
    {
      id: "topo_ratings",
      label: "Standardized Ratings",
      badge: "Topographic (1–5)",
      layers: layers.filter(
        (l) => l.group === "topographic" && (l.layerType === "RATING" || l.id.includes("rating")),
      ),
    },
    {
      id: "geo_factors",
      label: "Geological Criteria",
      badge: "Raw",
      layers: layers.filter(
        (l) => l.group === "geological" && (l.layerType === "FACTOR" || !l.id.includes("rating")),
      ),
    },
    {
      id: "geo_ratings",
      label: "Standardized Ratings",
      badge: "Geological (1–5)",
      layers: layers.filter(
        (l) => l.group === "geological" && (l.layerType === "RATING" || l.id.includes("rating")),
      ),
    },
    {
      id: "env_factors",
      label: "Environmental Criteria",
      badge: "Raw",
      layers: layers.filter(
        (l) =>
          l.group === "environmental" && (l.layerType === "FACTOR" || !l.id.includes("rating")),
      ),
    },
    {
      id: "env_ratings",
      label: "Standardized Ratings",
      badge: "Environmental (1–5)",
      layers: layers.filter(
        (l) => l.group === "environmental" && (l.layerType === "RATING" || l.id.includes("rating")),
      ),
    },
    {
      id: "quality",
      label: "Quality & Coverage",
      badge: "Coverage",
      layers: layers.filter(
        (l) =>
          (l.group === "quality" || l.layerType === "QUALITY" || l.id.includes("criteria")) &&
          !l.id.includes("bitmask"),
      ),
    },
  ];

  return (
    <aside
      className="flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 z-20"
      style={{
        width: open ? 330 : 0,
        minWidth: open ? 330 : 0,
        background: "var(--c-surface)",
        borderRight: "1px solid var(--c-border)",
      }}
    >
      {open && (
        <div className="flex flex-col h-full overflow-y-auto" style={{ minWidth: 330 }}>
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
            style={{
              background: "var(--c-panel)",
              borderBottom: "1px solid var(--c-border)",
            }}
          >
            <div
              className="text-xs font-semibold"
              style={{
                fontFamily: "var(--font-mono)",
                color: "#00b4d8",
                letterSpacing: "0.08em",
              }}
            >
              CONTROL PANEL
            </div>
            <div className="flex items-center gap-1">
              <Btn title="Refresh Layer Catalog" onClick={onRefresh} className="w-6 h-6">
                <IconRefresh size={11} />
              </Btn>
              <Btn title="Settings" className="w-6 h-6">
                <IconSettings size={11} />
              </Btn>
            </div>
          </div>

          {/* Analysis / Study area */}
          <SideSection
            label="Study Area & Model"
            open={section.analysis}
            onToggle={() => toggle("analysis")}
          >
            <div className="px-4 pb-4 flex flex-col gap-2.5">
              <Field label="Analysis Domain">
                <select className="w-full" value="Himachal Pradesh, India" disabled>
                  <option>Himachal Pradesh, India</option>
                </select>
              </Field>
              <Field label="District / Focus Area">
                <select
                  className="w-full"
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                >
                  {HIMACHAL_LOCATIONS.map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Susceptibility Model">
                <select
                  className="w-full"
                  value={modelName}
                  onChange={(e) => onModelChange?.(e.target.value)}
                >
                  <option value="Flood">Flood</option>
                  <option value="Landslide">Landslide</option>
                  <option value="Cyclone">Cyclone</option>
                  <option value="Drought">Drought</option>
                </select>
              </Field>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleDistrictChange(selectedDistrict)}
                  className="flex-1 h-8 rounded text-[13px] font-medium transition-colors hover:brightness-110"
                  style={{
                    background: "rgba(0,180,216,0.15)",
                    color: "#00b4d8",
                    border: "1px solid rgba(0,180,216,0.35)",
                  }}
                >
                  Locate Area
                </button>
                <button
                  onClick={() => handleDistrictChange("Shimla")}
                  className="h-8 px-3 rounded text-[13px] transition-colors hover:opacity-80"
                  style={{
                    color: "var(--c-text2)",
                    border: "1px solid var(--c-border)",
                    background: "var(--c-panel)",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </SideSection>

          {/* Layers — Dynamic Count */}
          <SideSection
            label={`Raster Layers (${layers.length})`}
            open={section.layers}
            onToggle={() => toggle("layers")}
            actions={
              <div className="flex items-center gap-1">
                <button
                  onClick={showAll}
                  className="text-[11px] px-2 py-0.5 rounded"
                  style={{
                    color: "#00b4d8",
                    border: "1px solid rgba(0,180,216,0.25)",
                  }}
                >
                  All
                </button>
                <button
                  onClick={hideAll}
                  className="text-[11px] px-2 py-0.5 rounded"
                  style={{
                    color: "var(--c-text2)",
                    border: "1px solid var(--c-border)",
                  }}
                >
                  None
                </button>
              </div>
            }
          >
            {layers.length === 0 ? (
              <div className="px-4 py-8 text-center flex flex-col items-center gap-2">
                <span className="text-[13px] font-semibold" style={{ color: "var(--c-text2)" }}>
                  {modelName} Model in Preparation
                </span>
                <span className="text-xs leading-relaxed" style={{ color: "var(--c-text3)" }}>
                  Spatial factor layers and analysis results for {modelName} will be available in an
                  upcoming release.
                </span>
              </div>
            ) : (
              <div className="pb-3 pt-1">
                {SECTIONS.map((s) => {
                  if (!s.layers.length) return null;
                  return (
                    <LayerGroup key={s.id} label={s.label} badge={s.badge}>
                      {s.layers.map((l) => (
                        <LayerRow
                          key={l.id}
                          layer={l}
                          isActive={activeLayerId === l.id}
                          onToggle={toggleLayer}
                          onSelect={onSelectLayer}
                          onOpacity={setOpacity}
                          onInfo={onLayerEvidence}
                        />
                      ))}
                    </LayerGroup>
                  );
                })}
              </div>
            )}
          </SideSection>

          {/* Legend */}
          <SideSection
            label="Susceptibility Legend"
            open={section.legend}
            onToggle={() => toggle("legend")}
          >
            <div className="px-4 pb-4">
              <div
                className="text-[11px] mb-2"
                style={{
                  color: "var(--c-text2)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {modelName} (Classes 1–5)
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {SUIT_ORDER.map((cls) => {
                  const m = SUIT_META[cls];
                  return (
                    <div key={cls} className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-3.5 rounded-sm flex-shrink-0"
                        style={{ background: m.color, opacity: 0.9 }}
                      />
                      <div className="flex-1 text-[13px]" style={{ color: "var(--c-text)" }}>
                        {m.label}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{
                          color: "var(--c-text2)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {m.range}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Gradient bar */}
              <div
                className="h-2.5 rounded-sm mb-1.5"
                style={{
                  background:
                    "linear-gradient(to right, #00c896, #4ade80, #fbbf24, #f97316, #ef4444)",
                }}
              />
              <div
                className="flex justify-between text-[10px] mb-1.5"
                style={{
                  color: "var(--c-text3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span style={{ color: "#00c896", fontWeight: 600 }}>1 (Very Low)</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span style={{ color: "#ef4444", fontWeight: 600 }}>5 (Very High)</span>
              </div>
              <div
                className="flex justify-between items-center text-[10px] px-2 py-1 rounded mb-2"
                style={{
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  className="flex items-center gap-1"
                  style={{ color: "#00c896", fontWeight: 600 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00c896" }} />
                  GREEN: Lower Hazard
                </span>
                <span
                  className="flex items-center gap-1"
                  style={{ color: "#ef4444", fontWeight: 600 }}
                >
                  RED: Higher Hazard
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }} />
                </span>
              </div>
              <div
                className="mt-2 pt-2 border-t border-[var(--c-border)] text-[11px] leading-relaxed"
                style={{ color: "var(--c-text3)" }}
              >
                <em>
                  {hazardName} susceptibility indicates environmental susceptibility under this
                  model. It is NOT a {hazardName.toLowerCase()} probability or prediction.
                </em>
              </div>
            </div>
          </SideSection>

          {/* Basemap Selector */}
          <SideSection label="Basemap" open={section.basemap} onToggle={() => toggle("basemap")}>
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => onBasemap(b.id)}
                  className="h-14 rounded text-[13px] font-medium transition-all flex flex-col items-center justify-center gap-1"
                  style={{
                    background: "var(--c-panel)",
                    color: "var(--c-text)",
                    border: basemap === b.id ? "2px solid #00b4d8" : "1px solid var(--c-border)",
                    boxShadow: basemap === b.id ? "0 0 0 1px rgba(0,180,216,0.3)" : "none",
                  }}
                >
                  <IconGlobe
                    size={15}
                    style={{
                      color: basemap === b.id ? "#00b4d8" : "var(--c-text2)",
                    }}
                  />
                  {b.label}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Footer Metadata */}
          <div
            className="mt-auto px-4 py-3 flex-shrink-0"
            style={{
              borderTop: "1px solid var(--c-border)",
              background: "var(--c-panel)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <Pill color="#00b4d8">Himachal Pradesh</Pill>
              <Pill color="#00c896">Data Verified</Pill>
              <Pill color="#374f6a">
                {isLandslide ? "14 Criteria" : layers.length > 0 ? "11 Criteria" : "MCDA"}
              </Pill>
            </div>
            <div
              className="text-[11px]"
              style={{
                color: "var(--c-text3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Statewide 30 m Spatial Analysis · v1.0
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function SideSection({
  label,
  open,
  onToggle,
  children,
  actions,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--c-border)" }}>
      <div
        onClick={onToggle}
        className="flex items-center w-full px-4 py-2.5 transition-colors hover:opacity-80 cursor-pointer select-none"
        style={{ color: "var(--c-text2)" }}
      >
        <span
          className="flex-1 text-left text-[11px] font-semibold tracking-[0.08em] uppercase"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
        {actions && (
          <span onClick={(e) => e.stopPropagation()} className="cursor-default">
            {actions}
          </span>
        )}
        <span
          className="ml-2 flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <IconChevronD size={11} />
        </span>
      </div>
      {open && children}
    </div>
  );
}

function LayerGroup({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const getBadgeStyle = (b: string) => {
    const lower = b.toLowerCase();
    if (lower === "raw") {
      return {
        color: "#38bdf8",
        background: "rgba(56, 189, 248, 0.08)",
        border: "1px solid rgba(56, 189, 248, 0.25)",
      };
    }
    if (lower.includes("1–5") || lower.includes("1-5")) {
      return {
        color: "#34d399",
        background: "rgba(52, 211, 153, 0.08)",
        border: "1px solid rgba(52, 211, 153, 0.25)",
      };
    }
    if (lower === "coverage") {
      return {
        color: "#818cf8",
        background: "rgba(129, 140, 248, 0.08)",
        border: "1px solid rgba(129, 140, 248, 0.25)",
      };
    }
    if (!isNaN(Number(b))) {
      return {
        color: "#00b4d8",
        background: "rgba(0, 180, 216, 0.1)",
        border: "1px solid rgba(0, 180, 216, 0.25)",
      };
    }
    return {
      color: "var(--c-text3)",
      background: "var(--c-panel)",
      border: "1px solid var(--c-border)",
    };
  };

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-1.5 text-[10.5px] font-semibold transition-colors hover:bg-[rgba(255,255,255,0.02)] select-none text-left"
        style={{
          color: "var(--c-text2)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2 overflow-hidden">
          <span
            className="flex-shrink-0 transition-transform duration-150"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0)" }}
          >
            <IconChevronR size={9} />
          </span>
          <span className="truncate whitespace-nowrap">{label.toUpperCase()}</span>
        </div>
        {badge && (
          <span
            className="text-[9px] px-1.5 py-[1.5px] rounded font-medium flex-shrink-0 whitespace-nowrap leading-none tracking-wide"
            style={getBadgeStyle(badge)}
          >
            {badge}
          </span>
        )}
      </button>
      {open && <div className="pl-1 pr-1">{children}</div>}
    </div>
  );
}

function LayerRow({
  layer,
  isActive,
  onToggle,
  onSelect,
  onOpacity,
  onInfo,
}: {
  layer: Layer;
  isActive: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onOpacity: (id: string, v: number) => void;
  onInfo: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="px-2 rounded mx-2 mb-0.5 transition-colors"
      style={{
        background: isActive ? "rgba(0,180,216,0.1)" : expanded ? "var(--c-panel)" : "transparent",
        border: isActive ? "1px solid rgba(0,180,216,0.3)" : "1px solid transparent",
      }}
    >
      <div className="flex items-center gap-1.5 py-1.5">
        <button
          onClick={() => onToggle(layer.id)}
          className="flex-shrink-0 transition-opacity w-5 h-5 flex items-center justify-center"
          style={{ color: layer.visible ? "#00b4d8" : "var(--c-text3)" }}
        >
          {layer.visible ? <IconEye size={13} /> : <IconEyeOff size={13} />}
        </button>
        <span
          className="flex-1 text-[13px] truncate cursor-pointer select-none"
          style={{
            color: layer.visible ? "var(--c-text)" : "var(--c-text2)",
            fontWeight: isActive ? 600 : 400,
          }}
          onClick={() => {
            onSelect(layer.id);
            if (!layer.visible) {
              onToggle(layer.id);
            }
          }}
          title={layer.name}
        >
          {layer.name}
          {layer.unit && (
            <span
              className="ml-1 text-[10px] opacity-75"
              style={{
                color: "var(--c-text3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              ({layer.unit})
            </span>
          )}
        </span>
        <button
          onClick={() => onInfo(layer.id)}
          title="Layer info"
          className="w-5 h-5 flex items-center justify-center rounded transition-opacity opacity-40 hover:opacity-100"
          style={{ color: "var(--c-text2)" }}
        >
          <IconInfo size={12} />
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-4 h-4 flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"
          style={{ color: "var(--c-text2)" }}
        >
          <span
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
            }}
          >
            <IconChevronD size={10} />
          </span>
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div
          className="pb-2 pt-1 px-1 border-t flex flex-col gap-1.5"
          style={{ borderColor: "var(--c-border)" }}
        >
          <div
            className="flex items-center justify-between text-[11px]"
            style={{ color: "var(--c-text3)" }}
          >
            <span>Opacity</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{layer.opacity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={layer.opacity}
            onChange={(e) => onOpacity(layer.id, parseInt(e.target.value))}
            className="w-full h-1 accent-[#00b4d8] cursor-pointer"
          />
          {layer.description && (
            <div className="text-[11px] leading-relaxed pt-1" style={{ color: "var(--c-text2)" }}>
              {layer.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: "var(--c-text2)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
