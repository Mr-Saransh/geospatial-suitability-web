import { useState, type ReactNode } from "react";
import { HIMACHAL_LOCATIONS } from "../data";
import type { ModelDetail } from "../lib/api/types";
import { IconChevronD, IconMoon, IconSatellite, IconMountain, IconRoadMap } from "../icons";

const BASEMAPS = [
  { id: "dark", label: "Dark Canvas", Icon: IconMoon },
  { id: "satellite", label: "Satellite", Icon: IconSatellite },
  { id: "topo", label: "Topographic", Icon: IconMountain },
  { id: "streets", label: "OpenStreet", Icon: IconRoadMap },
];

/* ── Inline SVG icons for section headers and dropdowns ── */
const SectionIcon = ({ type }: { type: string }) => {
  const s = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--c-accent)",
    strokeWidth: "1.6",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "pin":
      return (
        <svg {...s}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "legend":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    case "basemap":
      return (
        <svg {...s}>
          <path d="M3 6l9-3 9 3v12l-9 3-9-3V6z" />
          <path d="M12 3v18" />
        </svg>
      );
    default:
      return null;
  }
};

/* ── Dropdown icon (inline, left-side) ── */
const DropdownIcon = ({ type }: { type: string }) => {
  const s = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--c-text3)",
    strokeWidth: "1.6",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "tag":
      return (
        <svg {...s}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "building":
      return (
        <svg {...s}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
        </svg>
      );
    case "model":
      return (
        <svg {...s}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    default:
      return null;
  }
};

interface Props {
  open: boolean;
  basemap: string;
  onBasemap: (b: string) => void;
  onSelectLocation?: (loc: { lat: number; lng: number }) => void;
  modelName?: string;
  onModelChange?: (m: string) => void;
  activeModelId?: string;
  modelDetail?: ModelDetail | null;
  onRefresh?: () => void;
  onCollapse?: () => void;
  isMobile?: boolean;
  // Legacy optional props ignored or passed through
  layers?: unknown;
  setLayers?: unknown;
  activeLayerId?: string;
  onSelectLayer?: (id: string) => void;
  onLayerEvidence?: (id: string) => void;
}

export default function Sidebar({
  open,
  basemap,
  onBasemap,
  onSelectLocation,
  modelName = "Flood",
  onModelChange,
  activeModelId,
  modelDetail,
  onCollapse,
  isMobile = false,
}: Props) {
  const isLandslide =
    (activeModelId?.includes("landslide") || modelName.toLowerCase().includes("landslide")) ??
    false;

  const [section, setSection] = useState<Record<string, boolean>>({
    study: true,
    legend: true,
    basemap: true,
  });
  const [selectedDistrict, setSelectedDistrict] = useState("Shimla");

  const toggle = (k: string) => setSection((s) => ({ ...s, [k]: !s[k] }));

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

  const handleReset = () => {
    handleDistrictChange("Shimla");
  };

  // Derive model-specific classification legend classes
  // Canonical Symbology Colors
  const CLASS_COLORS: Record<number, string> = {
    1: "#00c896", // Very Low
    2: "#4ade80", // Low
    3: "#fbbf24", // Moderate
    4: "#f97316", // High
    5: "#ef4444", // Very High
  };

  const legendItems = modelDetail?.classification?.length
    ? modelDetail.classification.map((c) => ({
        classValue: c.class_value,
        name: c.label.replace(" Susceptibility", ""),
        range:
          c.range_max > 5
            ? `${c.range_min.toFixed(2)}+`
            : `${c.range_min.toFixed(2)}–${c.range_max.toFixed(2)}`,
        color: CLASS_COLORS[c.class_value] || "#00c896",
      }))
    : isLandslide
      ? [
          { classValue: 1, name: "Very Low", range: "1.00–2.00", color: "#00c896" },
          { classValue: 2, name: "Low", range: "2.00–3.00", color: "#4ade80" },
          { classValue: 3, name: "Moderate", range: "3.00–4.00", color: "#fbbf24" },
          { classValue: 4, name: "High", range: "4.00–5.00", color: "#f97316" },
          { classValue: 5, name: "Very High", range: "5.00", color: "#ef4444" },
        ]
      : [
          { classValue: 1, name: "Very Low", range: "1.00–1.80", color: "#00c896" },
          { classValue: 2, name: "Low", range: "1.80–2.60", color: "#4ade80" },
          { classValue: 3, name: "Moderate", range: "2.60–3.40", color: "#fbbf24" },
          { classValue: 4, name: "High", range: "3.40–4.20", color: "#f97316" },
          { classValue: 5, name: "Very High", range: "4.20–5.00", color: "#ef4444" },
        ];

  const sidebarWidth = isMobile ? 265 : 280;

  return (
    <aside
      className="sidebar-root flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 z-20 h-full"
      style={{
        width: open ? sidebarWidth : 0,
        minWidth: open ? sidebarWidth : 0,
        background: "var(--c-surface)",
        borderRight: "1px solid var(--c-border)",
      }}
    >
      {open && (
        <div
          className="flex flex-col h-full overflow-y-auto w-full select-none"
          style={{ minWidth: sidebarWidth }}
        >
          {/* ─── 1. Study Area Section ─── */}
          <SideSection
            icon="pin"
            label="Study area"
            open={section.study}
            onToggle={() => toggle("study")}
            actions={
              onCollapse && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollapse();
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.08)] text-[var(--c-text3)] hover:text-[var(--c-text)]"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="11 17 6 12 11 7" />
                    <polyline points="18 17 13 12 18 7" />
                  </svg>
                </button>
              )
            }
          >
            <div className="px-3.5 pb-3.5 flex flex-col gap-2.5">
              <DropdownField icon="tag" label="Spatial Domain">
                <select className="w-full" value="National Multi-Criteria Domain" disabled>
                  <option>National Multi-Criteria Domain</option>
                </select>
              </DropdownField>

              <DropdownField icon="building" label="District / Focus area">
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
              </DropdownField>

              <DropdownField icon="model" label="Model">
                <select
                  className="w-full"
                  value={modelName}
                  onChange={(e) => onModelChange?.(e.target.value)}
                >
                  <option value="Flood">Flood</option>
                  <option value="Landslide">Landslide</option>
                  <option value="Cyclone">Cyclone (In dev)</option>
                  <option value="Drought">Drought (In dev)</option>
                </select>
              </DropdownField>

              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleDistrictChange(selectedDistrict)}
                  className="sidebar-locate-btn flex-1 h-8 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  style={{
                    background: "var(--c-accent)",
                    color: "var(--c-base)",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                  Locate area
                </button>

                <button
                  onClick={handleReset}
                  className="h-8 px-3 rounded text-xs transition-colors hover:bg-[rgba(255,255,255,0.04)] flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: "var(--c-panel)",
                    border: "1px solid var(--c-border)",
                    color: "var(--c-text2)",
                  }}
                  title="Reset to default area"
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Reset
                </button>
              </div>
            </div>
          </SideSection>

          {/* ─── 2. Map Legend Section ─── */}
          <SideSection
            icon="legend"
            label="Map legend"
            open={section.legend}
            onToggle={() => toggle("legend")}
          >
            <div className="px-3.5 pb-3.5">
              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[var(--c-border)]">
                <span className="text-[11px] font-medium text-[var(--c-text2)]">
                  {isLandslide ? "Landslide" : "Flood"} Susceptibility
                </span>
                <span className="text-[10px] font-mono text-[var(--c-text3)]">
                  Canonical 1–5
                </span>
              </div>

              {/* Class rows */}
              <div className="flex flex-col gap-1.5 mb-2.5">
                {legendItems.map((item) => (
                  <div key={item.classValue} className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-3.5 rounded-xs flex-shrink-0"
                      style={{ background: item.color }}
                    />
                    <div className="flex-1 text-xs text-[var(--c-text)]">
                      {item.name} susceptibility
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[var(--c-text3)]">
                      {item.range}
                    </div>
                  </div>
                ))}
              </div>

              {/* Compact Continuous Gradient Scale */}
              <div
                className="h-1.5 rounded-full mb-1"
                style={{
                  background:
                    "linear-gradient(to right, #00c896, #4ade80, #fbbf24, #f97316, #ef4444)",
                }}
              />
              <div className="flex justify-between text-[10px] text-[var(--c-text3)] mb-2 font-medium">
                <span style={{ color: "#00c896" }}>Lower</span>
                <span style={{ color: "#ef4444" }}>Higher</span>
              </div>

              {/* Explanatory note */}
              <div
                className="text-[10.5px] leading-relaxed pt-1.5 border-t border-[var(--c-border)] text-[var(--c-text3)]"
              >
                Susceptibility is a relative model-based assessment, not a guaranteed event or
                prediction.
              </div>
            </div>
          </SideSection>

          {/* ─── 3. Basemap Section (Compact Selector) ─── */}
          <SideSection
            icon="basemap"
            label="Basemap"
            open={section.basemap}
            onToggle={() => toggle("basemap")}
          >
            <div className="px-3.5 pb-3.5 grid grid-cols-2 gap-1.5">
              {BASEMAPS.map((b) => {
                const active = basemap === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => onBasemap(b.id)}
                    className="h-8 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: active ? "var(--c-accent-dim)" : "var(--c-panel)",
                      color: active ? "var(--c-accent)" : "var(--c-text2)",
                      border: active
                        ? "1px solid var(--c-accent)"
                        : "1px solid var(--c-border)",
                    }}
                  >
                    <b.Icon
                      size={12}
                      style={{
                        color: active ? "var(--c-accent)" : "var(--c-text3)",
                      }}
                    />
                    <span>{b.label}</span>
                  </button>
                );
              })}
            </div>
          </SideSection>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          <div
            className="px-3.5 py-2 flex-shrink-0 text-[10.5px] flex items-center justify-between border-t border-[var(--c-border)]"
            style={{
              background: "var(--c-panel)",
              color: "var(--c-text3)",
            }}
          >
            <span>Multi-Hazard Domain · 30m</span>
            <span style={{ color: "var(--c-accent)" }}>Canonical Package</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function SideSection({
  icon,
  label,
  open,
  onToggle,
  children,
  actions,
}: {
  icon: string;
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
        className="flex items-center w-full px-3.5 py-2.5 transition-colors cursor-pointer select-none hover:bg-[rgba(255,255,255,0.02)]"
      >
        <SectionIcon type={icon} />
        <span
          className="flex-1 text-left text-[13px] font-semibold ml-2 text-[var(--c-text)]"
        >
          {label}
        </span>
        {actions && (
          <span onClick={(e) => e.stopPropagation()} className="cursor-default mr-1.5">
            {actions}
          </span>
        )}
        <span
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            color: "var(--c-text3)",
          }}
        >
          <IconChevronD size={13} />
        </span>
      </div>
      {open && children}
    </div>
  );
}

function DropdownField({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] text-[var(--c-text3)] font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <DropdownIcon type={icon} />
        </span>
        <div className="sidebar-select-wrapper [&>select]:pl-8">
          {children}
        </div>
      </div>
    </div>
  );
}
