import { useState } from "react";
import { SUIT_META, SUIT_ORDER } from "../data";
import { IconChevronD } from "../icons";

interface Props {
  activeModelName?: string;
  activeLayerName?: string;
  isContinuous?: boolean;
}

export default function MapLegend({
  activeModelName = "Flood",
  activeLayerName,
  isContinuous = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="absolute bottom-6 right-3 sm:right-4 z-[990] transition-all duration-200 select-none shadow-xl rounded-lg overflow-hidden backdrop-blur-md"
      style={{
        background: "var(--c-chip-bg)",
        border: "1px solid var(--c-border)",
        maxWidth: 260,
      }}
    >
      {/* Header bar with toggle */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)]"
        style={{ borderBottom: collapsed ? "none" : "1px solid var(--c-border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: activeModelName.toLowerCase() === "landslide" ? "#f97316" : "#00b4d8",
            }}
          />
          <span
            className="text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: "var(--c-text)", fontFamily: "var(--font-mono)" }}
          >
            {activeModelName} Legend
          </span>
        </div>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: "var(--c-text2)",
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <IconChevronD size={11} />
        </span>
      </div>

      {!collapsed && (
        <div className="p-3 flex flex-col gap-2">
          {/* Active Layer Label if specified */}
          {activeLayerName && (
            <div
              className="text-[10px] truncate pb-1 border-b border-[var(--c-border)]"
              style={{ color: "var(--c-text3)", fontFamily: "var(--font-mono)" }}
              title={activeLayerName}
            >
              Layer: {activeLayerName}
            </div>
          )}

          {/* 5 Classes */}
          <div className="flex flex-col gap-1">
            {SUIT_ORDER.map((cls) => {
              const meta = SUIT_META[cls];
              return (
                <div key={cls} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: meta.color }}
                  />
                  <span className="flex-1 truncate text-[var(--c-text)]">
                    {meta.label.replace(" Susceptibility", "")}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--c-text3)]">
                    {meta.range.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Continuous gradient bar indicator */}
          <div className="pt-1.5 border-t border-[var(--c-border)]">
            <div
              className="h-1.5 rounded-full w-full mb-1"
              style={{
                background:
                  "linear-gradient(to right, #00c896, #4ade80, #fbbf24, #f97316, #ef4444)",
              }}
            />
            <div className="flex justify-between text-[9px] font-mono text-[var(--c-text3)]">
              <span className="text-[#00c896]">1.0 (Lowest)</span>
              {isContinuous && <span className="text-[#00b4d8]">Continuous</span>}
              <span className="text-[#ef4444]">5.0 (Highest)</span>
            </div>
          </div>

          {/* Scientific Disclaimer Note */}
          <div className="text-[9.5px] leading-tight pt-1 text-[var(--c-text3)] italic border-t border-[var(--c-border)]">
            Relative model susceptibility assessment, not a prediction or guarantee of an event.
          </div>
        </div>
      )}
    </div>
  );
}
