import { useState, useCallback } from 'react';
import { ZONES, SUIT_META } from '../data';
import type { Zone } from '../types';
import { IconZoomIn, IconZoomOut, IconLocate, IconMaximize, IconMeasure, IconBookmark, IconCompare, IconPrint, IconGlobe } from '../icons';

interface Props {
  selectedZone: Zone | null;
  onZoneClick: (z: Zone) => void;
  compareMode: boolean;
  onCompare: () => void;
  basemap: string;
}

const BASEMAP_COLORS: Record<string, { bg: string; grid: string; water: string; terrain: string }> = {
  dark:      { bg: '#080e1a', grid: '#0d1825', water: '#0a1628', terrain: '#0c1422' },
  satellite: { bg: '#0d150d', grid: '#0f1a0f', water: '#061628', terrain: '#121e12' },
  topo:      { bg: '#0e0e18', grid: '#14142a', water: '#080e28', terrain: '#121230' },
  streets:   { bg: '#080e1a', grid: '#0d1628', water: '#070d22', terrain: '#0c1228' },
};

export default function MapCanvas({ selectedZone, onZoneClick, compareMode, onCompare, basemap }: Props) {
  const [zoom, setZoom] = useState(10);
  const [comparePos, setComparePos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [coord, setCoord] = useState({ lat: 26.5318, lng: 88.7214 });

  const bm = BASEMAP_COLORS[basemap] || BASEMAP_COLORS.dark;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setCoord({
      lat: 26.81 - py * 0.72,
      lng: 88.31 + px * 0.94,
    });
    if (dragging) {
      const newPos = Math.max(20, Math.min(80, px * 100));
      setComparePos(newPos);
    }
  }, [dragging]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: bm.bg }}>
      {/* Main SVG map */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        {/* Graticule grid */}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 8.33} y1={0} x2={i * 8.33} y2={100} stroke={bm.grid} strokeWidth={0.3} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 8.33} x2={100} y2={i * 8.33} stroke={bm.grid} strokeWidth={0.3} />
        ))}

        {/* Terrain texture — subtle fill areas */}
        <polygon points="0,0 35,0 40,15 30,30 15,35 0,20" fill={bm.terrain} opacity={0.6} />
        <polygon points="60,0 100,0 100,25 85,30 70,20 58,10" fill={bm.terrain} opacity={0.4} />
        <polygon points="0,60 20,55 30,68 20,82 0,85" fill={bm.terrain} opacity={0.5} />
        <polygon points="75,60 100,55 100,80 88,85 74,75" fill={bm.terrain} opacity={0.3} />

        {/* Contour hints */}
        <ellipse cx={22} cy={22} rx={18} ry={12} fill="none" stroke="#0f1a28" strokeWidth={0.5} opacity={0.7} />
        <ellipse cx={22} cy={22} rx={28} ry={18} fill="none" stroke="#0f1a28" strokeWidth={0.4} opacity={0.5} />
        <ellipse cx={72} cy={18} rx={14} ry={9}  fill="none" stroke="#0f1a28" strokeWidth={0.5} opacity={0.6} />

        {/* River network */}
        <path d="M 18,0 Q 20,18 16,35 Q 12,55 15,75 Q 18,88 14,100"
          stroke="#0a2040" strokeWidth={1.8} fill="none" opacity={0.9} />
        <path d="M 50,0 Q 48,15 52,32 Q 56,52 50,72 Q 46,88 50,100"
          stroke="#0a2040" strokeWidth={1.3} fill="none" opacity={0.8} />
        <path d="M 78,8 Q 74,22 76,40 Q 78,60 76,82 Q 74,92 78,100"
          stroke="#0a2040" strokeWidth={1} fill="none" opacity={0.7} />
        <path d="M 0,48 Q 20,44 36,46 Q 52,48 68,44 Q 82,42 100,46"
          stroke="#0a2040" strokeWidth={0.8} fill="none" opacity={0.6} />

        {/* District boundaries */}
        <path d="M 0,33 L 100,33" stroke="#162038" strokeWidth={0.6} strokeDasharray="2,3" opacity={0.8} />
        <path d="M 0,66 L 100,66" stroke="#162038" strokeWidth={0.6} strokeDasharray="2,3" opacity={0.8} />
        <path d="M 33,0 L 33,100" stroke="#162038" strokeWidth={0.6} strokeDasharray="2,3" opacity={0.6} />
        <path d="M 66,0 L 66,100" stroke="#162038" strokeWidth={0.6} strokeDasharray="2,3" opacity={0.6} />

        {/* Compare clip regions */}
        {compareMode && (
          <>
            <defs>
              <clipPath id="leftClip">
                <rect x={0} y={0} width={comparePos} height={100} />
              </clipPath>
              <clipPath id="rightClip">
                <rect x={comparePos} y={0} width={100 - comparePos} height={100} />
              </clipPath>
            </defs>
            {/* Left side: slightly different tint */}
            <rect x={0} y={0} width={comparePos} height={100} fill="rgba(0,180,216,0.04)" clipPath="url(#leftClip)" />
          </>
        )}

        {/* Suitability zones */}
        {ZONES.map(zone => {
          const m = SUIT_META[zone.cls];
          const isSelected = selectedZone?.id === zone.id;
          const isHovered = hoveredZone === zone.id;
          const alpha = isSelected ? '50' : isHovered ? '35' : '22';
          const strokeAlpha = isSelected ? 'cc' : isHovered ? '99' : '66';
          return (
            <g key={zone.id}
              onClick={() => onZoneClick(zone)}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              style={{ cursor: 'pointer' }}>
              <polygon
                points={zone.points}
                fill={`${m.color}${alpha}`}
                stroke={`${m.color}${strokeAlpha}`}
                strokeWidth={isSelected ? 0.8 : 0.5}
                style={{ transition: 'all 0.15s' }}
              />
              {/* Zone label */}
              <text x={zone.cx} y={zone.cy} textAnchor="middle" dominantBaseline="middle"
                fontSize={isSelected ? 3.5 : 2.8} fill={m.color}
                style={{ fontFamily: 'var(--font-mono)', opacity: (isSelected || isHovered) ? 1 : 0.6, pointerEvents: 'none' }}>
                {zone.label}
              </text>
              {/* Score label when selected */}
              {isSelected && (
                <text x={zone.cx} y={zone.cy + 4.5} textAnchor="middle"
                  fontSize={2.2} fill={m.color}
                  style={{ fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
                  {zone.score.toFixed(2)}
                </text>
              )}
              {/* Pulse ring on selected */}
              {isSelected && (
                <circle cx={zone.cx} cy={zone.cy} r={6}
                  fill="none" stroke={m.color} strokeWidth={0.4} opacity={0.4} />
              )}
            </g>
          );
        })}

        {/* Settlement markers */}
        {[
          { x: 50, y: 14, name: 'Siliguri' },
          { x: 19, y: 50, name: 'Jalpaiguri' },
          { x: 44, y: 62, name: 'Alipurduar' },
        ].map(s => (
          <g key={s.name}>
            <circle cx={s.x} cy={s.y} r={1} fill="#1a3860" stroke="#2d9cdb" strokeWidth={0.4} />
            <circle cx={s.x} cy={s.y} r={0.4} fill="#2d9cdb" />
            <text x={s.x + 1.5} y={s.y} fontSize={2} fill="#2d9cdb" dominantBaseline="middle"
              style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{s.name}</text>
          </g>
        ))}

        {/* Compare divider */}
        {compareMode && (
          <line x1={comparePos} y1={0} x2={comparePos} y2={100}
            stroke="#00b4d8" strokeWidth={0.6}
            onMouseDown={() => setDragging(true)}
            style={{ cursor: 'col-resize' }} />
        )}
      </svg>

      {/* Map controls — right side */}
      <div className="absolute right-3 top-3 flex flex-col gap-1 z-10">
        {[
          { Icon: IconZoomIn,   title: 'Zoom in',    onClick: () => setZoom(z => Math.min(z + 1, 22)) },
          { Icon: IconZoomOut,  title: 'Zoom out',   onClick: () => setZoom(z => Math.max(z - 1, 1)) },
          null,
          { Icon: IconLocate,   title: 'My location' },
          { Icon: IconMaximize, title: 'Fullscreen' },
          null,
          { Icon: IconMeasure,  title: 'Measure' },
          { Icon: IconBookmark, title: 'Bookmarks' },
          { Icon: IconCompare,  title: 'Compare', onClick: onCompare, active: compareMode },
          null,
          { Icon: IconPrint,    title: 'Print / Export' },
        ].map((btn, i) =>
          btn === null
            ? <div key={i} className="h-px mx-1" style={{ background: '#1c2e48' }} />
            : (
              <button key={btn.title} onClick={btn.onClick} title={btn.title}
                className="w-7 h-7 flex items-center justify-center rounded transition-all"
                style={{
                  background: btn.active ? 'rgba(0,180,216,0.15)' : '#0c1424',
                  border: `1px solid ${btn.active ? 'rgba(0,180,216,0.4)' : '#1c2e48'}`,
                  color: btn.active ? '#00b4d8' : '#647d9a',
                }}>
                <btn.Icon size={13} />
              </button>
            )
        )}
      </div>

      {/* Compare handle */}
      {compareMode && (
        <div className="absolute top-0 bottom-0 z-20 flex items-center"
          style={{ left: `${comparePos}%`, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          <div className="flex flex-col items-center h-full relative">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded text-[10px] font-semibold whitespace-nowrap"
              style={{ background: '#0c1424', border: '1px solid rgba(0,180,216,0.4)', color: '#00b4d8', fontFamily: 'var(--font-mono)' }}>
              ◁ Slope | Elevation ▷
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-3 py-1.5"
        style={{ background: 'rgba(8,13,24,0.92)', borderTop: '1px solid #1c2e48' }}>
        <span className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
          {coord.lat.toFixed(5)}°N  {coord.lng.toFixed(5)}°E
        </span>
        <span className="text-[10px]" style={{ color: '#1c2e48' }}>|</span>
        <span className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
          Zoom {zoom}  ·  Scale 1:{Math.round(591657550 / Math.pow(2, zoom)).toLocaleString()}
        </span>
        <span className="text-[10px]" style={{ color: '#1c2e48' }}>|</span>
        <span className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>EPSG:32645 UTM 45N</span>
        <div className="flex-1" />
        {/* Scale bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col">
            <div className="flex items-center h-2">
              <div className="w-px h-2" style={{ background: '#374f6a' }} />
              <div className="flex-1 h-px" style={{ width: 40, background: '#374f6a' }} />
              <div className="w-px h-2" style={{ background: '#374f6a' }} />
            </div>
          </div>
          <span className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>5 km</span>
        </div>
        <span className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
          © OpenStreetMap · SRTM · ESA
        </span>
      </div>

      {/* Layer badge (active layers) */}
      <div className="absolute top-3 left-3 z-10">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
          style={{ background: 'rgba(8,13,24,0.85)', border: '1px solid #1c2e48', fontFamily: 'var(--font-mono)', color: '#647d9a' }}>
          <IconGlobe size={10} />
          Groundwater Recharge Potential v2.1  ·  30 m  ·  West Bengal
        </div>
      </div>
    </div>
  );
}
