import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { CRITERIA, CLASS_DIST, SCORE_HIST, SUIT_META, SUIT_ORDER } from '../data';
import type { Zone, RightTab } from '../types';
import { SuitBadge, ScoreBar, SectionLabel, StatTile, TabBar, EmptyState, Mono, Pill } from '../ui';
import { IconAnalyze, IconInfo, IconChart } from '../icons';

interface Props {
  zone: Zone | null;
  onLayerEvidence: (id: string) => void;
  onTabChange?: (t: RightTab) => void;
}

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'criteria',   label: 'Criteria' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'evidence',   label: 'Evidence' },
  { id: 'metadata',   label: 'Metadata' },
];

export default function RightPanel({ zone, onLayerEvidence }: Props) {
  const [tab, setTab] = useState<RightTab>('overview');

  return (
    <div className="flex flex-col overflow-hidden" style={{ width: 304, background: '#0c1424', borderLeft: '1px solid #1c2e48' }}>
      {/* Panel header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ background: '#080d18', borderBottom: '1px solid #1c2e48' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <IconAnalyze size={13} style={{ color: '#374f6a' }} />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase"
            style={{ fontFamily: 'var(--font-mono)', color: '#374f6a' }}>Analysis Panel</span>
        </div>
        {zone ? (
          <>
            <div className="flex items-start justify-between mt-1">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>
                    Sector {zone.label}
                  </span>
                  <SuitBadge cls={zone.cls} />
                </div>
                <div className="text-[11px]" style={{ color: '#374f6a' }}>{zone.district} · {zone.region}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-right" style={{ fontFamily: 'var(--font-mono)', color: SUIT_META[zone.cls].color }}>
                  {zone.score.toFixed(2)}
                </div>
                <div className="text-[9px] text-right" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>/1.00</div>
              </div>
            </div>
            <div className="mt-2">
              <ScoreBar value={zone.score} color={SUIT_META[zone.cls].color} height={4} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Pill color="#374f6a">{zone.area.toFixed(1)} km²</Pill>
              <Pill color="#374f6a">30 m resolution</Pill>
            </div>
          </>
        ) : (
          <div className="text-xs mt-1" style={{ color: '#374f6a' }}>Select a zone on the map</div>
        )}
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={tab} onChange={t => setTab(t as RightTab)} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!zone ? (
          <EmptyState icon={<IconAnalyze size={18} />}
            title="No area selected"
            body="Click any suitability zone on the map to view detailed analysis, criteria scores, and scientific evidence." />
        ) : (
          <>
            {tab === 'overview'   && <OverviewTab zone={zone} />}
            {tab === 'criteria'   && <CriteriaTab zone={zone} onEvidence={onLayerEvidence} />}
            {tab === 'statistics' && <StatisticsTab zone={zone} />}
            {tab === 'evidence'   && <EvidenceTab zone={zone} onEvidence={onLayerEvidence} />}
            {tab === 'metadata'   && <MetadataTab />}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────── */
function OverviewTab({ zone }: { zone: Zone }) {
  const m = SUIT_META[zone.cls];
  const positive = CRITERIA.filter(c => c.cls === 'positive');
  const limiting = CRITERIA.filter(c => c.cls === 'limiting');

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Summary */}
      <div className="p-3 rounded" style={{ background: `${m.color}0d`, border: `1px solid ${m.color}25` }}>
        <div className="text-xs leading-relaxed" style={{ color: '#c4d4e8' }}>
          Sector {zone.label} achieves <strong style={{ color: m.color }}>{m.label.toLowerCase()} suitability</strong> ({zone.score.toFixed(2)}/1.00) for groundwater recharge. The zone is characterised by favourable topographic and hydrological conditions in {zone.district}, {zone.region}.
        </div>
      </div>

      {/* Top contributors mini chart */}
      <div>
        <SectionLabel>Top Criterion Contributions</SectionLabel>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={CRITERIA.slice(0, 5).map(c => ({ name: c.name.split(' ')[0], v: +(c.contribution * 100).toFixed(1) }))}
            layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9, fill: '#374f6a', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 10, fill: '#647d9a' }} axisLine={false} tickLine={false} />
            <Bar dataKey="v" radius={[0, 2, 2, 0]}>
              {CRITERIA.slice(0, 5).map((c, i) => (
                <Cell key={i} fill={c.cls === 'positive' ? '#00b4d8' : '#f97316'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Positive factors */}
      <div>
        <SectionLabel>Positive Factors ({positive.length})</SectionLabel>
        {positive.map(c => (
          <div key={c.name} className="flex items-start gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#00c896' }} />
            <div className="text-xs" style={{ color: '#647d9a' }}>
              <span style={{ color: '#c4d4e8' }}>{c.name}</span> — score {c.rawScore.toFixed(2)} (w={c.weight.toFixed(2)})
            </div>
          </div>
        ))}
      </div>

      {/* Limiting factors */}
      <div>
        <SectionLabel>Limiting Factors ({limiting.length})</SectionLabel>
        {limiting.map(c => (
          <div key={c.name} className="flex items-start gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#f97316' }} />
            <div className="text-xs" style={{ color: '#647d9a' }}>
              <span style={{ color: '#c4d4e8' }}>{c.name}</span> — score {c.rawScore.toFixed(2)} (w={c.weight.toFixed(2)})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Criteria ───────────────────────────────────────────────── */
function CriteriaTab({ zone: _zone, onEvidence }: { zone: Zone; onEvidence: (id: string) => void }) {
  const chartData = CRITERIA.map(c => ({
    name: c.name.replace('Distance to ', 'Dist. '),
    weight: +(c.weight * 100).toFixed(0),
    score: +(c.rawScore * 100).toFixed(0),
    contrib: +(c.contribution * 100).toFixed(1),
  }));

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <SectionLabel>AHP Weights vs Normalised Scores</SectionLabel>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: -8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="2,3" stroke="#111d33" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#374f6a' }} angle={-45} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#374f6a', fontFamily: 'var(--font-mono)' }} />
            <Tooltip contentStyle={{ background: '#0c1424', border: '1px solid #1c2e48', borderRadius: 4, fontSize: 10 }}
              labelStyle={{ color: '#c4d4e8' }} itemStyle={{ color: '#647d9a' }} />
            <Bar dataKey="weight" fill="#2d9cdb" opacity={0.7} radius={[2, 2, 0, 0]} name="Weight %" />
            <Bar dataKey="score"  fill="#00b4d8" opacity={0.9} radius={[2, 2, 0, 0]} name="Score %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionLabel>Criterion Detail</SectionLabel>
      {CRITERIA.map(c => (
        <div key={c.name} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: '#c4d4e8' }}>{c.name}</span>
            <div className="flex items-center gap-2">
              <Mono color={c.cls === 'positive' ? '#00c896' : '#f97316'}>
                {c.rawScore.toFixed(2)}
              </Mono>
              <button onClick={() => onEvidence(c.layerId)}
                className="text-[9px] px-1.5 py-px rounded"
                style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
                ⊞ map
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ScoreBar value={c.rawScore} color={c.cls === 'positive' ? '#00b4d8' : '#f97316'} height={3} />
            </div>
            <span className="text-[10px] w-10 text-right" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
              w={c.weight.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: '#374f6a' }}>
            Contribution: {(c.contribution * 100).toFixed(1)}% · {c.source}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Statistics ─────────────────────────────────────────────── */
function StatisticsTab({ zone }: { zone: Zone }) {
  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Zone stats grid */}
      <div>
        <SectionLabel>Zone Statistics</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Area"       value={`${zone.area.toFixed(1)} km²`} />
          <StatTile label="Score"      value={zone.score.toFixed(3)}         accent={SUIT_META[zone.cls].color} />
          <StatTile label="Min Score"  value="0.51"    sub="pixel minimum" />
          <StatTile label="Max Score"  value="0.97"    sub="pixel maximum" />
          <StatTile label="Mean"       value="0.78"    sub="μ" />
          <StatTile label="Std Dev"    value="0.091"   sub="σ" />
          <StatTile label="Pixels"     value="157,889" sub="30 m cells" />
          <StatTile label="ROC-AUC"    value="0.87"    sub="validation" accent="#00c896" />
        </div>
      </div>

      {/* Suitability class pie */}
      <div>
        <SectionLabel>Class Distribution — Study Area</SectionLabel>
        <div className="flex items-center gap-3">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie data={CLASS_DIST} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={1}>
                {CLASS_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 flex-1">
            {CLASS_DIST.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[10px] flex-1" style={{ color: '#647d9a' }}>{d.name}</span>
                <Mono color="#374f6a">{d.value}%</Mono>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area by class */}
      <div>
        <SectionLabel>Area by Suitability Class (km²)</SectionLabel>
        {CLASS_DIST.map(d => (
          <div key={d.name} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] w-16 flex-shrink-0" style={{ color: '#647d9a' }}>{d.name}</span>
            <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: '#111d33' }}>
              <div className="h-full rounded-sm" style={{ width: `${(d.area / 541.2) * 100}%`, background: d.color, opacity: 0.8 }} />
            </div>
            <Mono color="#374f6a">{d.area.toFixed(0)}</Mono>
          </div>
        ))}
      </div>

      {/* Score histogram */}
      <div>
        <SectionLabel>Score Distribution (pixel count)</SectionLabel>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={SCORE_HIST} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#ef4444" />
                <stop offset="30%"  stopColor="#f97316" />
                <stop offset="50%"  stopColor="#fbbf24" />
                <stop offset="75%"  stopColor="#4ade80" />
                <stop offset="100%" stopColor="#00c896" />
              </linearGradient>
            </defs>
            <XAxis dataKey="bin" tick={{ fontSize: 8, fill: '#374f6a', fontFamily: 'var(--font-mono)' }} />
            <Area type="monotone" dataKey="count" stroke="#00b4d8" fill="url(#histGrad)" fillOpacity={0.3} strokeWidth={1.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Evidence ───────────────────────────────────────────────── */
function EvidenceTab({ zone, onEvidence }: { zone: Zone; onEvidence: (id: string) => void }) {
  const m = SUIT_META[zone.cls];
  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Why box */}
      <div className="p-3 rounded border-l-2" style={{ background: `${m.color}0a`, borderLeftColor: m.color }}>
        <div className="text-xs font-semibold mb-1.5" style={{ color: m.color }}>
          Why is Sector {zone.label} {m.label.toLowerCase()} suitability?
        </div>
        <div className="text-xs leading-relaxed" style={{ color: '#647d9a' }}>
          This zone occupies a gently sloping pediplain (2–5°) underlain by weathered Gondwana sediments with high infiltration capacity. The terrain wetness index (4.2) indicates moderate moisture accumulation without waterlogging risk. Monsoon rainfall of 1,840 mm/yr provides a sustained recharge pulse through the June–September window.
        </div>
      </div>

      {/* Per-criterion evidence */}
      <SectionLabel>Criterion Evidence</SectionLabel>
      {CRITERIA.map(c => (
        <div key={c.name} className="mb-3 p-3 rounded" style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-xs font-medium" style={{ color: '#c4d4e8' }}>{c.name}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Mono color={c.cls === 'positive' ? '#00c896' : '#f97316'}>{c.rawScore.toFixed(2)}</Mono>
              <span className="text-[9px]" style={{ color: '#374f6a' }}>/{c.weight.toFixed(2)}</span>
            </div>
          </div>
          <div className="text-[11px] leading-relaxed mb-2" style={{ color: '#374f6a' }}>{c.evidence}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => onEvidence(c.layerId)}
              className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1"
              style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
              <IconChart size={9} /> Show Evidence on Map
            </button>
            <span className="text-[10px]" style={{ color: '#1c2e48' }}>·</span>
            <span className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>{c.source}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Metadata ───────────────────────────────────────────────── */
function MetadataTab() {
  const rows = [
    ['Model',           'Groundwater Recharge Potential v2.1'],
    ['Run ID',          'GRP-2024-WB-JLP-0042'],
    ['Processed',       '2024-11-08 03:47 UTC'],
    ['AHP Method',      'Saaty (1980)'],
    ['CR (Consistency)','0.043  <  0.10 ✓'],
    ['Normalization',   'Fuzzy membership (linear)'],
    ['DEM',             'SRTM 1-Arc · NASA 2000'],
    ['LULC',            'ESA WorldCover 10 m · 2021'],
    ['Climate',         'CHIRPS v2.0 · 2000–2023'],
    ['Soil',            'SoilGrids v2.0 · ISRIC'],
    ['Vegetation',      'Sentinel-2 L2A · 2024'],
    ['Output CRS',      'EPSG:32645 UTM 45N'],
    ['Resolution',      '30 m spatial'],
    ['Validation',      'ROC-AUC 0.87  (n=124 wells)'],
    ['Kappa',           '0.79  (substantial)'],
    ['Overall Acc.',    '82.3%'],
  ];

  const ahpWeights = CRITERIA.map(c => ({ name: c.name, w: c.weight }));

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <SectionLabel>Dataset & Processing</SectionLabel>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-1.5" style={{ borderBottom: '1px solid #111d33' }}>
            <span className="text-[10px] flex-shrink-0 w-28" style={{ color: '#374f6a' }}>{k}</span>
            <span className="text-[10px] text-right flex-1" style={{ color: '#647d9a', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{v}</span>
          </div>
        ))}
      </div>

      <div>
        <SectionLabel>AHP Weight Configuration</SectionLabel>
        {ahpWeights.map(r => (
          <div key={r.name} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] flex-1 truncate" style={{ color: '#647d9a' }}>{r.name}</span>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#111d33' }}>
              <div className="h-full rounded-full" style={{ width: `${r.w * 100 / 0.22 * 100}%`, background: '#2d9cdb' }} />
            </div>
            <Mono color="#374f6a">{r.w.toFixed(2)}</Mono>
          </div>
        ))}
        <div className="mt-2 p-2 rounded text-[10px]" style={{ background: '#111d33', color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
          Σ weights = 1.00  ·  CR = 0.043  ·  n=9 criteria  ·  Expert consensus (n=7 panel)
        </div>
      </div>

      <div>
        <SectionLabel>Methodology</SectionLabel>
        <div className="text-[11px] leading-relaxed" style={{ color: '#374f6a' }}>
          Multi-Criteria Decision Analysis (MCDA) using the Analytic Hierarchy Process (Saaty, 1980). Criteria weights derived from structured expert elicitation with 7-member interdisciplinary panel (hydrology, geology, remote sensing). Fuzzy-linear membership functions applied to normalise each criterion to [0, 1]. Weighted linear combination used for composite index. Validated against 124 existing groundwater observation wells (CGWB dataset, 2019–2024).
        </div>
      </div>
    </div>
  );
}
