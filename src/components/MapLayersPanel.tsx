import { useState, useEffect, type ReactNode } from "react";
import type { Layer } from "../types";
import {
  IconEye,
  IconEyeOff,
  IconChevronD,
  IconChevronR,
  IconInfo,
  IconX,
  IconLayers,
} from "../icons";

interface Props {
  open: boolean;
  onClose: () => void;
  layers: Layer[];
  setLayers: (l: Layer[]) => void;
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onLayerEvidence: (id: string) => void;
  modelName?: string;
  isMobile?: boolean;
}

/* Category SVG icons */
const CategoryIcon = ({ type }: { type: string }) => {
  const s = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "results":
      return (
        <svg {...s}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "hydro":
      return (
        <svg {...s}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      );
    case "topo":
      return (
        <svg {...s}>
          <path d="M8 3l4 8 5-5 4 14H3L8 3z" />
        </svg>
      );
    case "geo":
      return (
        <svg {...s}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "env":
      return (
        <svg {...s}>
          <path d="M17 8c.7-1 1-2.2 1-3.5C18 2 15 2 15 2s-3 0-3 2.5c0 1.3.3 2.5 1 3.5" />
          <path d="M12 22V10" />
          <path d="M7 14c-1.5 0-3-1.3-3-3 0-1.5 1.3-3 3-3 .4 0 .7.1 1 .2" />
          <path d="M17 14c1.5 0 3-1.3 3-3 0-1.5-1.3-3-3-3-.4 0-.7.1-1 .2" />
        </svg>
      );
    case "quality":
      return (
        <svg {...s}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
};

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

export default function MapLayersPanel({
  open,
  onClose,
  layers,
  setLayers,
  activeLayerId,
  onSelectLayer,
  onLayerEvidence,
  modelName = "Flood",
  isMobile = false,
}: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Radio-style: only one layer visible at a time
  const toggleLayer = (id: string) => {
    const target = layers.find((l) => l.id === id);
    if (target?.visible) {
      // Already visible, just select it (don't hide — always keep one visible)
      onSelectLayer(id);
      return;
    }
    // Make only this layer visible, hide all others
    setLayers(layers.map((l) => ({ ...l, visible: l.id === id })));
    onSelectLayer(id);
  };

  const setOpacity = (id: string, v: number) => {
    setLayers(layers.map((l) => (l.id === id ? { ...l, opacity: v } : l)));
  };

  // Filter: only show RESULT layers (classified/continuous), hide raw FACTOR, RATING, QUALITY
  const displayLayers = layers.filter(
    (l) =>
      l.layerType === "RESULT" ||
      l.group === "composite" ||
      l.id.includes("suitability"),
  );

  // Categories — only Results category since raw/rating/quality are hidden
  const categories = [
    {
      id: "results",
      label: "Susceptibility Layers",
      icon: "results" as const,
      layers: displayLayers
        .sort((a, b) => {
          const idxA = RESULT_ORDER.indexOf(a.id);
          const idxB = RESULT_ORDER.indexOf(b.id);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        }),
    },
  ];

  const content = (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 flex-shrink-0"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <IconLayers size={15} style={{ color: "var(--c-accent)" }} />
          <span
            className="text-xs font-semibold uppercase tracking-wider text-[var(--c-text)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Map Layers
          </span>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded hidden"
            style={{
              background: "var(--c-accent-dim)",
              color: "var(--c-accent)",
            }}
          >
            {layers.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[rgba(255,255,255,0.06)] text-[var(--c-text3)] hover:text-[var(--c-text)] ml-1"
            title="Close panel (Esc)"
            aria-label="Close Map Layers panel"
          >
            <IconX size={13} />
          </button>
        </div>
      </div>

      {/* Categories & Layer Rows */}
      <div
        className="flex-1 min-h-0 overflow-y-auto py-1 overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {layers.length === 0 ? (
          <div className="px-4 py-8 text-center flex flex-col items-center gap-1.5">
            <span className="text-xs text-[var(--c-text2)]">
              {modelName} model rasters in preparation
            </span>
            <span className="text-[11px] text-[var(--c-text3)]">
              Rasters will load once published in the spatial catalog.
            </span>
          </div>
        ) : (
          categories.map((cat) => {
            if (!cat.layers.length) return null;
            return (
              <LayerCategory
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                count={cat.layers.length}
                defaultOpen={cat.id === "results"}
              >
                {cat.layers.map((l) => (
                  <LayerItem
                    key={l.id}
                    layer={l}
                    isActive={activeLayerId === l.id}
                    onToggle={toggleLayer}
                    onSelect={onSelectLayer}
                    onOpacity={setOpacity}
                    onInfo={onLayerEvidence}
                  />
                ))}
              </LayerCategory>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div
        className="px-3.5 py-2 text-[10px] flex items-center justify-between border-t"
        style={{
          borderColor: "var(--c-border)",
          background: "var(--c-panel)",
          color: "var(--c-text3)",
        }}
      >
        <span>Toggle eye to show/hide rasters</span>
        <span className="font-mono text-[9px] text-[var(--c-text3)]">30m Pixel</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 top-0 bottom-14 z-[1250] flex flex-col justify-end pointer-events-none">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto" onClick={onClose} />
        <div
          className="relative z-10 flex flex-col shadow-2xl bottom-sheet-enter mobile-bottom-sheet overflow-hidden pointer-events-auto"
          style={{
            background: "var(--c-surface)",
            borderRadius: "16px 16px 0 0",
            maxHeight: "calc(100dvh - 120px)",
            height: "75vh",
            minHeight: "45vh",
            border: "1px solid var(--c-border)",
            borderBottom: "none",
          }}
        >
          <div className="drag-handle flex-shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden pb-4">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Floating Panel over map
  return (
    <div
      className="absolute top-3 left-3 z-[1100] w-[340px] max-h-[calc(100vh-80px)] flex flex-col rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        boxShadow: "0 16px 36px rgba(0,0,0,0.5)",
      }}
    >
      {content}
    </div>
  );
}

function LayerCategory({
  label,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-1.5 text-xs transition-colors hover:bg-[rgba(255,255,255,0.02)] select-none text-left"
        style={{ color: "var(--c-text2)" }}
      >
        <span
          className="flex-shrink-0 transition-transform duration-150"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0)",
            color: "var(--c-text3)",
          }}
        >
          <IconChevronR size={10} />
        </span>
        <span className="flex-shrink-0" style={{ color: "var(--c-accent)" }}>
          <CategoryIcon type={icon} />
        </span>
        <span className="flex-1 truncate font-medium" style={{ color: "var(--c-text)" }}>
          {label}
        </span>
        <span
          className="text-[11px] font-medium px-1.5 py-0.2 rounded flex items-center justify-center flex-shrink-0"
          style={{
            background: "var(--c-accent-dim)",
            color: "var(--c-accent)",
          }}
        >
          {count}
        </span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function LayerItem({
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
      className="mx-2.5 rounded-md mb-0.5 transition-colors"
      style={{
        background: isActive ? "var(--c-accent-dim)" : "transparent",
        border: isActive ? "1px solid var(--c-accent)" : "1px solid transparent",
      }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={() => onToggle(layer.id)}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center transition-opacity"
          style={{ color: layer.visible ? "var(--c-accent)" : "var(--c-text3)" }}
          title={layer.visible ? "Hide raster" : "Show raster"}
        >
          {layer.visible ? <IconEye size={13} /> : <IconEyeOff size={13} />}
        </button>

        <span
          className="flex-1 text-xs truncate cursor-pointer select-none"
          style={{
            color: layer.visible ? "var(--c-text)" : "var(--c-text3)",
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
        </span>

        <button
          onClick={() => onInfo(layer.id)}
          title="Layer info"
          className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
          style={{ color: "var(--c-text3)", opacity: expanded ? 1 : undefined }}
        >
          <IconInfo size={11} />
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-4 h-4 flex items-center justify-center transition-opacity hover:opacity-100"
          style={{
            color: "var(--c-text3)",
            opacity: expanded ? 1 : 0.6,
          }}
        >
          <span
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
              transition: "transform 0.15s ease",
            }}
          >
            <IconChevronD size={10} />
          </span>
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div
          className="pb-2 pt-1 px-3 border-t flex flex-col gap-1.5"
          style={{ borderColor: "var(--c-border)" }}
        >
          <div
            className="flex items-center justify-between text-[10px]"
            style={{ color: "var(--c-text3)" }}
          >
            <span>Opacity</span>
            <span className="tabular-nums font-mono">{layer.opacity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={layer.opacity}
            onChange={(e) => onOpacity(layer.id, parseInt(e.target.value))}
            className="w-full h-1 accent-[var(--c-accent)] cursor-pointer"
          />
          {layer.description && (
            <div className="text-[10px] leading-relaxed pt-0.5" style={{ color: "var(--c-text3)" }}>
              {layer.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
