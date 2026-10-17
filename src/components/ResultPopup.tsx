import { useState, useRef } from "react";
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const m = SUIT_META[zone.cls] || SUIT_META["low"];
  const criteria = zone.criteria || [];
  const top2 = criteria.slice(0, 2);
  const limiting = criteria.filter((c) => c.cls === "limiting").slice(0, 1);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent drag when clicking buttons or interactive elements
    if ((e.target as HTMLElement).closest("button")) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? 0,
      origY: pos?.y ?? 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPos({
      x: dragStartRef.current.origX + dx,
      y: dragStartRef.current.origY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  if (minimized) {
    return (
      <div
        className="absolute z-[1100] flex items-center gap-2 px-2.5 py-1 rounded-full shadow-xl backdrop-blur-md cursor-grab active:cursor-grabbing transition-shadow hover:scale-[1.02] border border-[var(--c-border)] select-none"
        style={{
          bottom: 54,
          left: "50%",
          transform: pos
            ? `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`
            : "translateX(-50%)",
          background: "var(--c-chip-bg)",
          boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 10px ${m.color}20`,
          maxWidth: "calc(100vw - 24px)",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Drag to reposition · Click expand to view"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: m.color }}
        />
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[11px] font-semibold truncate"
            style={{ color: "var(--c-text)", fontFamily: "var(--font-display)" }}
          >
            {zone.district || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
          </span>
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded"
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
          className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-[rgba(255,255,255,0.08)] cursor-pointer"
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
          className="w-4 h-4 flex items-center justify-center rounded-full text-[var(--c-text3)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer"
          title="Close"
        >
          <IconX size={10} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute z-[1100] rounded-xl shadow-2xl overflow-hidden backdrop-blur-md w-[calc(100vw-24px)] max-w-[280px] select-none"
      style={{
        bottom: 54,
        left: "50%",
        transform: pos
          ? `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`
          : "translateX(-50%)",
        background: "var(--c-chip-bg)",
        border: `1px solid ${m.color}35`,
        boxShadow: `0 12px 36px rgba(0,0,0,0.4), 0 0 0 1px ${m.color}15`,
        touchAction: "none",
      }}
    >
      {/* Draggable Header Strip with Grab Handle */}
      <div
        className="cursor-grab active:cursor-grabbing flex flex-col pt-1.5 px-3 pb-1"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Subtle drag handle bar */}
        <div className="w-8 h-1 rounded-full bg-[var(--c-border2)] mx-auto mb-1 opacity-70" />

        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span
                className="text-[12px] font-semibold truncate"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--c-text)",
                }}
              >
                {zone.label || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
              </span>
              <SuitBadge cls={zone.cls} />
            </div>
            <div className="text-[10px] truncate" style={{ color: "var(--c-text2)" }}>
              {zone.district} · {zone.region}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div
              className="text-[18px] font-bold"
              style={{
                fontFamily: "var(--font-mono)",
                color: m.color,
                lineHeight: 1,
              }}
            >
              {zone.score.toFixed(2)}
              <span
                className="text-[10px] font-normal opacity-70 ml-0.5"
                style={{ color: "var(--c-text2)" }}
              >
                /5
              </span>
            </div>
            <div
              className="text-[9px]"
              style={{ color: "var(--c-text3)", fontFamily: "var(--font-mono)" }}
            >
              Class {zone.classifiedValue || 1}/5
            </div>
          </div>

          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
            <button
              onClick={() => setMinimized(true)}
              className="w-5 h-5 flex items-center justify-center rounded text-[var(--c-text2)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
              title="Minimize"
            >
              <IconMinimize size={10} />
            </button>
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded text-[var(--c-text2)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
              title="Close"
            >
              <IconX size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-3 pb-1.5">
        <ScoreBar value={zone.score / 5.0} color={m.color} height={3} />
      </div>

      {/* Key factors */}
      <div className="px-3 py-1.5" style={{ borderTop: "1px solid var(--c-border)" }}>
        <div className="flex items-center gap-1 flex-wrap">
          {top2.map((c) => (
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
      <div className="flex px-2.5 pb-2.5 pt-1 gap-1.5">
        <button
          onClick={onDetails}
          className="flex-1 h-7 rounded text-[11px] font-semibold transition-colors hover:bg-[var(--c-accent-hover)] cursor-pointer"
          style={{
            background: "var(--c-accent)",
            color: "var(--c-base)",
          }}
        >
          Details
        </button>
        <button
          onClick={onAsk}
          className="h-7 px-2.5 rounded text-[11px] flex items-center gap-1 transition-colors hover:bg-[var(--c-accent-dim)] cursor-pointer"
          style={{
            color: "var(--c-accent)",
            border: "1px solid var(--c-border2)",
            background: "var(--c-panel)",
          }}
        >
          <IconBot size={11} /> Ask AI
        </button>
      </div>
    </div>
  );
}

