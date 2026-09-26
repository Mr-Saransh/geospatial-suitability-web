import { SUIT_META } from '../data';
import type { Zone } from '../types';
import { SuitBadge, ScoreBar, Pill } from '../ui';
import { IconX, IconBot, IconInfo } from '../icons';

interface Props {
  zone: Zone;
  onClose: () => void;
  onDetails: () => void;
  onAsk: () => void;
  onWhy: () => void;
  loading?: boolean;
}

export default function ResultPopup({ zone, onClose, onDetails, onAsk, onWhy, loading }: Props) {
  const m = SUIT_META[zone.cls] || SUIT_META['low'];
  const criteria = zone.criteria || [];
  const top3 = criteria.slice(0, 3);
  const limiting = criteria.filter(c => c.cls === 'limiting');

  return (
    <div className="absolute z-[1100] rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
      style={{
        bottom: 52, left: '50%', transform: 'translateX(-50%)',
        width: 330,
        background: 'var(--c-chip-bg)',
        border: `1px solid ${m.color}35`,
        boxShadow: `0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px ${m.color}18`,
      }}>
      {/* Accent top strip */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${m.color}00, ${m.color}, ${m.color}00)` }} />

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-text)' }}>
              {zone.label || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
            </span>
            <SuitBadge cls={zone.cls} />
          </div>
          <div className="text-xs" style={{ color: 'var(--c-text2)' }}>{zone.district} · {zone.region}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: m.color, lineHeight: 1 }}>
            {zone.score.toFixed(2)}
          </div>
          <div className="text-[9px]" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>Class {zone.classifiedValue || 1} / 5</div>
        </div>
        <button onClick={onClose} className="ml-1 flex-shrink-0 w-6 h-6 flex items-center justify-center hover:opacity-75 transition-opacity"
          style={{ color: 'var(--c-text2)' }}>
          <IconX size={12} />
        </button>
      </div>

      {/* Score bar */}
      <div className="px-4 pb-3">
        <ScoreBar value={zone.score / 5.0} color={m.color} height={4} />
        <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
          <span>1.0 (V.Low)</span><span>2.0</span><span>3.0</span><span>4.0</span><span>5.0 (V.High)</span>
        </div>
      </div>

      {/* Key factors */}
      <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-2 pt-3 flex-wrap">
          {top3.map(c => (
            <Pill key={c.name} color="#00c896">+ {c.name.split(' ')[0]}</Pill>
          ))}
          {limiting.map(c => (
            <Pill key={c.name} color="#f97316">− {c.name.split(' ')[0]}</Pill>
          ))}
          <Pill color="#00b4d8">{zone.lat.toFixed(3)}°, {zone.lng.toFixed(3)}°</Pill>
        </div>
      </div>

      {/* Actions */}
      <div className="flex px-3 pb-3 gap-1.5">
        <button onClick={onDetails}
          className="flex-1 h-8 rounded text-xs font-medium transition-colors hover:brightness-110"
          style={{ background: 'rgba(0,180,216,0.15)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.35)' }}>
          View Full Inspection
        </button>
        <button onClick={onWhy}
          className="h-8 px-3 rounded text-xs flex items-center gap-1 transition-colors hover:opacity-80"
          style={{ color: 'var(--c-text)', border: '1px solid var(--c-border)', background: 'var(--c-panel)' }}>
          <IconInfo size={11} /> Why?
        </button>
        <button onClick={onAsk}
          className="h-8 px-3 rounded text-xs flex items-center gap-1 transition-colors hover:opacity-80"
          style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)', background: 'var(--c-panel)' }}>
          <IconBot size={11} /> Ask AI
        </button>
      </div>
    </div>
  );
}
