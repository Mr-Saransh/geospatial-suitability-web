import { useState } from 'react';
import { ZONES, SUIT_META, LAYERS, CRITERIA, CLASS_DIST } from '../data';
import type { Zone, MobileSheet } from '../types';
import { SuitBadge, ScoreBar, SectionLabel, StatTile, EmptyState, Mono, Pill } from '../ui';
import { IconMap, IconLayers, IconAnalyze, IconBot, IconMore, IconX, IconEye, IconEyeOff, IconSearch, IconExport, IconSend, IconChevronD } from '../icons';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function MobileApp() {
  const [activeNav, setActiveNav] = useState<'map' | 'layers' | 'analyze' | 'ai' | 'more'>('map');
  const [sheet, setSheet] = useState<MobileSheet>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [layers, setLayers] = useState(LAYERS);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([
    { role: 'ai', text: 'Groundwater Recharge Potential v2.1 context loaded. Select a zone or ask a question.' },
  ]);

  const openSheet = (s: MobileSheet) => setSheet(s);
  const closeSheet = () => setSheet(null);
  const handleZone = (z: Zone) => { setZone(z); openSheet('analyze'); };
  const toggleLayer = (id: string) => setLayers(l => l.map(x => x.id === id ? { ...x, visible: !x.visible } : x));

  return (
    <div className="flex flex-col h-full" style={{ background: '#080d18' }}>
      {/* Mobile top bar */}
      <div className="flex items-center gap-2 px-3 h-12 flex-shrink-0"
        style={{ background: '#0c1424', borderBottom: '1px solid #1c2e48' }}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: 'linear-gradient(145deg,#00b4d8,#023e8a)' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="white" strokeWidth="1.4" fill="none"/>
              <circle cx="10" cy="10" r="2.5" fill="white"/>
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>MCGSE</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1 h-8 px-2.5 rounded"
          style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
          <IconSearch size={11} style={{ color: '#374f6a' }} />
          <span className="text-xs" style={{ color: '#374f6a' }}>Search location…</span>
        </div>
        <button onClick={() => openSheet('export')}
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: '#0e1828', border: '1px solid #1c2e48', color: '#647d9a' }}>
          <IconExport size={14} />
        </button>
      </div>

      {/* Map area */}
      <div className="relative flex-1 overflow-hidden">
        {/* SVG map simulation */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {/* Background */}
          <rect x={0} y={0} width={100} height={100} fill="#080e1a"/>
          {/* Grid */}
          {Array.from({ length: 10 }).map((_, i) => (
            <g key={i}>
              <line x1={i*10} y1={0} x2={i*10} y2={100} stroke="#0d1825" strokeWidth={0.3} />
              <line x1={0} y1={i*10} x2={100} y2={i*10} stroke="#0d1825" strokeWidth={0.3} />
            </g>
          ))}
          {/* Rivers */}
          <path d="M18,0 Q20,18 16,35 Q12,55 15,75 Q18,88 14,100" stroke="#0a2040" strokeWidth={2} fill="none"/>
          <path d="M50,0 Q48,15 52,32 Q56,52 50,72 Q46,88 50,100" stroke="#0a2040" strokeWidth={1.5} fill="none"/>
          {/* Zones */}
          {ZONES.map(z => {
            const m = SUIT_META[z.cls];
            const isSel = zone?.id === z.id;
            return (
              <g key={z.id} onClick={() => handleZone(z)} style={{ cursor: 'pointer' }}>
                <polygon points={(z as any).points}
                  fill={`${m.color}${isSel ? '45' : '20'}`}
                  stroke={`${m.color}${isSel ? 'cc' : '55'}`}
                  strokeWidth={isSel ? 1 : 0.5} />
                <text x={(z as any).cx} y={(z as any).cy} textAnchor="middle" dominantBaseline="middle"
                  fontSize={3} fill={m.color} style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                  {z.label}
                </text>
              </g>
            );
          })}
          {/* District borders */}
          <path d="M0,33 L100,33" stroke="#162038" strokeWidth={0.6} strokeDasharray="2,3"/>
          <path d="M0,66 L100,66" stroke="#162038" strokeWidth={0.6} strokeDasharray="2,3"/>
        </svg>

        {/* Selected zone banner */}
        {zone && (
          <div className="absolute top-3 left-3 right-3 rounded-lg p-3 z-10"
            style={{ background: 'rgba(12,20,36,0.96)', border: `1px solid ${SUIT_META[zone.cls].color}40` }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ color: '#c4d4e8' }}>Sector {zone.label}</span>
                  <SuitBadge cls={zone.cls} />
                </div>
                <div className="text-xs" style={{ color: '#374f6a' }}>{zone.district}</div>
              </div>
              <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-mono)', color: SUIT_META[zone.cls].color }}>
                {zone.score.toFixed(2)}
              </div>
            </div>
            <ScoreBar value={zone.score} color={SUIT_META[zone.cls].color} />
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => openSheet('analyze')}
                className="flex-1 h-8 rounded text-xs font-medium"
                style={{ background: 'rgba(0,180,216,0.12)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }}>
                View Analysis
              </button>
              <button onClick={() => { setActiveNav('ai'); openSheet('ai'); }}
                className="h-8 px-3 rounded text-xs"
                style={{ color: '#647d9a', border: '1px solid #1c2e48' }}>
                Ask AI
              </button>
              <button onClick={() => setZone(null)}
                className="h-8 w-8 rounded flex items-center justify-center"
                style={{ color: '#374f6a', border: '1px solid #1c2e48' }}>
                <IconX size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Floating controls */}
        <div className="absolute right-3 bottom-16 flex flex-col gap-1 z-10">
          {['+', '−', '⊕'].map(s => (
            <button key={s} className="w-9 h-9 rounded text-sm font-semibold flex items-center justify-center"
              style={{ background: '#0c1424', border: '1px solid #1c2e48', color: '#647d9a' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Scale / coords */}
        <div className="absolute bottom-3 left-3 text-[10px]"
          style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
          26.53°N 88.72°E · 30 m
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-shrink-0" style={{ background: '#0c1424', borderTop: '1px solid #1c2e48', height: 56 }}>
        {([
          { id: 'map',     label: 'Map',     Icon: IconMap },
          { id: 'layers',  label: 'Layers',  Icon: IconLayers },
          { id: 'analyze', label: 'Analyze', Icon: IconAnalyze },
          { id: 'ai',      label: 'AI',      Icon: IconBot },
          { id: 'more',    label: 'More',    Icon: IconMore },
        ] as const).map(n => (
          <button key={n.id}
            onClick={() => { setActiveNav(n.id); if (n.id !== 'map') openSheet(n.id); }}
            className="flex-1 flex flex-col items-center justify-center gap-1"
            style={{ color: activeNav === n.id ? '#00b4d8' : '#374f6a' }}>
            <n.Icon size={17} />
            <span className="text-[9px]">{n.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom sheets */}
      <Sheet open={sheet === 'layers'} title="Layers" onClose={closeSheet}>
        <div className="flex flex-col gap-0.5">
          {layers.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-2 py-2.5 rounded"
              style={{ background: '#0e1828' }}>
              <button onClick={() => toggleLayer(l.id)} style={{ color: l.visible ? '#00b4d8' : '#374f6a' }}>
                {l.visible ? <IconEye size={15} /> : <IconEyeOff size={15} />}
              </button>
              <span className="flex-1 text-sm" style={{ color: l.visible ? '#c4d4e8' : '#374f6a' }}>{l.name}</span>
              {l.unit && <span className="text-xs" style={{ color: '#374f6a' }}>{l.unit}</span>}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'analyze'} title={zone ? `Sector ${zone.label} — Analysis` : 'Analysis'} onClose={closeSheet}>
        {!zone ? (
          <EmptyState icon={<IconAnalyze size={18} />}
            title="No zone selected" body="Tap a susceptibility zone on the map to view analysis." />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Score summary */}
            <div className="flex items-center gap-4">
              <div>
                <div className="text-4xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: SUIT_META[zone.cls].color }}>
                  {zone.score.toFixed(2)}
                </div>
                <SuitBadge cls={zone.cls} size="sm" />
              </div>
              <ResponsiveContainer width={80} height={80}>
                <PieChart>
                  <Pie data={[{ v: zone.score }, { v: 1 - zone.score }]} dataKey="v" cx="50%" cy="50%" innerRadius={26} outerRadius={36} startAngle={90} endAngle={-270}>
                    <Cell fill={SUIT_META[zone.cls].color} />
                    <Cell fill="#111d33" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1">
                <div className="text-xs mb-1" style={{ color: '#374f6a' }}>{zone.district}</div>
                <div className="text-xs mb-1" style={{ color: '#374f6a' }}>{zone.area} km²</div>
                <ScoreBar value={zone.score} color={SUIT_META[zone.cls].color} />
              </div>
            </div>

            {/* Criteria */}
            <div>
              <SectionLabel>Criteria Scores</SectionLabel>
              {CRITERIA.map(c => (
                <div key={c.name} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#c4d4e8' }}>{c.name}</span>
                    <Mono color={c.cls === 'positive' ? '#00c896' : '#f97316'}>{(c.rawScore ?? 0).toFixed(2)}</Mono>
                  </div>
                  <ScoreBar value={c.rawScore ?? 0} color={c.cls === 'positive' ? '#00b4d8' : '#f97316'} height={3} />
                </div>
              ))}
            </div>

            {/* Stats */}
            <div>
              <SectionLabel>Zone Statistics</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Area" value={`${zone.area} km²`} />
                <StatTile label="Pixels" value="157,889" sub="30 m cells" />
                <StatTile label="Mean Score" value="0.78" />
                <StatTile label="ROC-AUC" value="0.87" accent="#00c896" />
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'ai'} title="AI Assistant" onClose={closeSheet}>
        <div className="flex flex-col" style={{ minHeight: 380 }}>
          {/* Context */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00b4d8' }} />
            <span className="text-xs" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>GRP v2.1</span>
            {zone && <><span style={{ color: '#1c2e48' }}>·</span><Pill color="#00b4d8">Sector {zone.label}</Pill></>}
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3 flex-1 mb-4">
            {aiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[90%] px-3 py-2 rounded-lg text-xs leading-relaxed"
                  style={{
                    background: m.role === 'user' ? 'rgba(0,180,216,0.1)' : '#0e1828',
                    color: m.role === 'user' ? '#00b4d8' : '#647d9a',
                    border: `1px solid ${m.role === 'user' ? 'rgba(0,180,216,0.25)' : '#1c2e48'}`,
                  }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 rounded-lg"
            style={{ background: '#0e1828', border: '1px solid #1c2e48', height: 40 }}>
            <input className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: '#c4d4e8' }}
              placeholder="Ask about this zone or model…"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && aiInput.trim()) {
                  setAiMessages(m => [...m,
                    { role: 'user', text: aiInput },
                    { role: 'ai', text: 'Based on the loaded scientific context, this area scores highly due to optimal slope (2.4°) and favourable TWI (4.2). The primary limiting factor is river distance at 4.7 km.' }
                  ]);
                  setAiInput('');
                }
              }} />
            <button style={{ color: '#00b4d8' }}><IconSend size={15} /></button>
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'export'} title="Export" onClose={closeSheet}>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Summary CSV', sub: '~48 KB · .csv' },
            { label: 'GeoTIFF Raster', sub: '~38 MB · .tif' },
            { label: 'Map Image', sub: '~4.2 MB · .png' },
            { label: 'Susceptibility Report', sub: '~2.1 MB · .pdf' },
            { label: 'Metadata Bundle', sub: '~120 KB · .xml' },
          ].map(f => (
            <button key={f.label}
              className="flex items-center justify-between h-14 px-4 rounded"
              style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
              <div className="text-left">
                <div className="text-sm" style={{ color: '#c4d4e8' }}>{f.label}</div>
                <div className="text-xs" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>{f.sub}</div>
              </div>
              <IconExport size={16} style={{ color: '#374f6a' }} />
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'more'} title="More" onClose={closeSheet}>
        <div className="flex flex-col gap-2">
          {['Compare Layers', 'Saved Analyses', 'Bookmarks', 'Model Library', 'Help & Documentation', 'About MCGSE'].map(item => (
            <button key={item}
              className="flex items-center justify-between h-12 px-4 rounded text-sm"
              style={{ background: '#0e1828', border: '1px solid #1c2e48', color: '#c4d4e8' }}>
              {item}
              <IconChevronD size={13} style={{ color: '#374f6a', transform: 'rotate(-90deg)' }} />
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* Bottom sheet wrapper */
function Sheet({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-t-2xl flex flex-col overflow-hidden"
        style={{ background: '#0c1424', border: '1px solid #1c2e48', maxHeight: '85vh' }}>
        {/* Pull indicator */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#1c2e48' }} />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid #1c2e48' }}>
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>{title}</span>
          <button onClick={onClose} style={{ color: '#374f6a' }}><IconX size={14} /></button>
        </div>
        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
