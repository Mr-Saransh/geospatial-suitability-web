import { useState } from "react";
import { SUIT_META } from "../data";
import type { Zone } from "../types";
import { SuitBadge, ScoreBar, Pill } from "../ui";
import { IconX, IconBot, IconMinimize, IconChevronU } from "../icons";

interface Props {
  zone: Zone;
  onClose: () => void;
  onDetails: () => void;
  onAsk: () => void;
  onWhy?: () => void;
  loading?: boolean;
}

export default function ResultPopup({
  zone,
  onClose,
  onDetails,
  onAsk,
  onWhy: _onWhy,
  loading: _loading,
}: Props) {
  const [minimized, setMinimized] = useState(false);
  const m = SUIT_META[zone.cls] || SUIT_META["low"];
  const criteria = zone.criteria || [];
  const top3 = criteria.slice(0, 3);
  const limiting = criteria.filter((c) => c.cls === "limiting");

  if (minimized) {
    return (
      <div
        className="absolute z-[1100] flex items-center gap-2 px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-[1.02] border border-[var(--c-border)]"
        style={{
          bottom: 64,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--c-chip-bg)",
          boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 12px ${m.color}25`,
          maxWidth: "calc(100vw - 24px)",
        }}
        onClick={() => setMinimized(false)}
        title="Click to expand coordinate details"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: m.color }}
        />
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: "var(--c-text)", fontFamily: "var(--font-display)" }}
          >
            {zone.district || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
          </span>
          <span
            className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded"
            style={{
              background: `${m.color}22`,
              color: m.color,
            }}
          >
            {zone.score.toFixed(2)}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(false);
          }}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors hover:bg-[rgba(255,255,255,0.08)] cursor-pointer"
          style={{ color: "var(--c-accent)" }}
          title="Expand"
        >
          <span>Expand</span>
          <IconChevronU size={10} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--c-text3)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer"
          title="Close"
        >
          <IconX size={11} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute z-[1100] rounded-xl shadow-2xl overflow-hidden backdrop-blur-md w-[calc(100vw-24px)] max-w-[340px]"
      style={{
        bottom: 64,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--c-chip-bg)",
        border: `1px solid ${m.color}35`,
        boxShadow: `0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px ${m.color}18`,
      }}
    >
      {/* Accent top strip */}
      <div
        className="h-0.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${m.color}00, ${m.color}, ${m.color}00)`,
        }}
      />

      {/* Header */}
      <div className="flex items-start gap-2.5 px-4 pt-3 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className="text-[14px] font-semibold truncate"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--c-text)",
              }}
            >
              {zone.label || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
            </span>
            <SuitBadge cls={zone.cls} />
          </div>
          <div className="text-xs truncate" style={{ color: "var(--c-text2)" }}>
            {zone.district} · {zone.region}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div
            className="text-[24px] font-bold"
            style={{
              fontFamily: "var(--font-mono)",
              color: m.color,
              lineHeight: 1,
            }}
          >
            {zone.score.toFixed(2)}
            <span
              className="text-xs font-normal opacity-70 ml-0.5"
              style={{ color: "var(--c-text2)" }}
            >
              {" "}
              / 5.00
            </span>
          </div>
          <div
            className="text-[10px]"
            style={{ color: "var(--c-text3)", fontFamily: "var(--font-mono)" }}
          >
            Class {zone.classifiedValue || 1} / 5
          </div>
        </div>
        <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
          <button
            onClick={() => setMinimized(true)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--c-text2)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
            title="Minimize"
          >
            <IconMinimize size={12} />
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--c-text2)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
            title="Close"
          >
            <IconX size={12} />
          </button>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-4 pb-2.5">
        <ScoreBar value={zone.score / 5.0} color={m.color} height={4} />
        <div
          className="flex justify-between text-[10px] mt-1"
          style={{ color: "var(--c-text3)", fontFamily: "var(--font-mono)" }}
        >
          <span>1.0 (V.Low)</span>
          <span>2.0</span>
          <span>3.0</span>
          <span>4.0</span>
          <span>5.0 (V.High)</span>
        </div>
      </div>

      {/* Key factors */}
      <div className="px-4 pb-2.5" style={{ borderTop: "1px solid var(--c-border)" }}>
        <div className="flex items-center gap-1.5 pt-2.5 flex-wrap">
          {top3.map((c) => (
            <Pill key={c.name} color="#00c896">
              + {c.name.split(" ")[0]}
            </Pill>
          ))}
          {limiting.map((c) => (
            <Pill key={c.name} color="#f97316">
              − {c.name.split(" ")[0]}
            </Pill>
          ))}
          <Pill color="var(--c-accent)">
            {zone.lat.toFixed(3)}°, {zone.lng.toFixed(3)}°
          </Pill>
        </div>
      </div>

      {/* Actions */}
      <div className="flex px-3 pb-3 gap-1.5">
        <button
          onClick={onDetails}
          className="flex-1 h-8 rounded text-xs font-semibold transition-colors hover:bg-[var(--c-accent-hover)] cursor-pointer"
          style={{
            background: "var(--c-accent)",
            color: "var(--c-base)",
          }}
        >
          Location Details
        </button>
        <button
          onClick={onAsk}
          className="h-8 px-3 rounded text-xs flex items-center gap-1.5 transition-colors hover:bg-[var(--c-accent-dim)] cursor-pointer"
          style={{
            color: "var(--c-accent)",
            border: "1px solid var(--c-border2)",
            background: "var(--c-panel)",
          }}
        >
          <IconBot size={12} /> Ask AI
        </button>
      </div>
    </div>
  );
}

