import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { SUIT_META, SUIT_ORDER, INITIAL_STATS } from '../data';
import type { Zone, RightTab, CriterionRow } from '../types';
import type { AnalysisStatistics, ModelDetail } from '../lib/api/types';
import { SuitBadge, ScoreBar, SectionLabel, StatTile, TabBar, EmptyState, Mono, Pill } from '../ui';
import { IconAnalyze, IconInfo, IconChart } from '../icons';

interface Props {
  zone: Zone | null;
  onLayerEvidence: (id: string) => void;
  statistics?: AnalysisStatistics | null;
  modelDetail?: ModelDetail | null;
  onTabChange?: (t: RightTab) => void;
}

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'criteria',   label: 'Criteria' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'evidence',   label: 'Evidence' },
  { id: 'metadata',   label: 'Metadata' },
];

export default function RightPanel({ zone, onLayerEvidence, statistics, modelDetail }: Props) {
  const [tab, setTab] = useState<RightTab>('overview');
  const stats = statistics || (INITIAL_STATS as any);

  return (
    <div className="flex flex-col overflow-hidden z-20" style={{ width: 320, background: '#0c1424', borderLeft: '1px solid #1c2e48' }}>
      {/* Panel header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ background: '#080d18', borderBottom: '1px solid #1c2e48' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <IconAnalyze size={13} style={{ color: '#00b4d8' }} />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase"
            style={{ fontFamily: 'var(--font-mono)', color: '#00b4d8' }}>Point Inspection Panel</span>
        </div>
        {zone ? (
          <>
            <div className="flex items-start justify-between mt-1">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>
                    {zone.label || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
                  </span>
                  <SuitBadge cls={zone.cls} />
                </div>
                <div className="text-[11px]" style={{ color: '#647d9a' }}>
                  {zone.district} · {zone.region}
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-right" style={{ fontFamily: 'var(--font-mono)', color: SUIT_META[zone.cls]?.color || '#00b4d8' }}>
                  {zone.score.toFixed(2)}
                </div>
                <div className="text-[9px] text-right" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>Class {zone.classifiedValue || 1} / 5</div>
              </div>
            </div>
            <div className="mt-2">
              <ScoreBar value={zone.score / 5.0} color={SUIT_META[zone.cls]?.color || '#00b4d8'} height={4} />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Pill color="#00b4d8">{zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E</Pill>
              <Pill color="#374f6a">30 m pixel</Pill>
              {zone.finalStatus === 'VALID' ? (
                <Pill color="#00c896">Valid Sample</Pill>
              ) : (
                <Pill color="#f97316">{zone.finalStatus || 'Valid'}</Pill>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs mt-1" style={{ color: '#647d9a' }}>Click any point on the map to sample rasters</div>
        )}
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={tab} onChange={t => setTab(t as RightTab)} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!zone ? (
          <EmptyState icon={<IconAnalyze size={18} />}
            title="No coordinates selected"
            body="Click anywhere on the Himachal Pradesh map to inspect real-time pixel values across all 11 criteria and suitability models." />
        ) : (
          <>
            {tab === 'overview'   && <OverviewTab zone={zone} />}
            {tab === 'criteria'   && <CriteriaTab zone={zone} onEvidence={onLayerEvidence} />}
            {tab === 'statistics' && <StatisticsTab zone={zone} stats={stats} />}
            {tab === 'evidence'   && <EvidenceTab zone={zone} onEvidence={onLayerEvidence} />}
            {tab === 'metadata'   && <MetadataTab modelDetail={modelDetail} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────── */
function OverviewTab({ zone }: { zone: Zone }) {
  const m = SUIT_META[zone.cls] || SUIT_META['low'];
  const criteria = zone.criteria || [];
  const positive = criteria.filter(c => c.cls === 'positive');
  const limiting = criteria.filter(c => c.cls === 'limiting');

  const topContributors = [...criteria]
    .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
    .slice(0, 5)
    .map(c => ({
      name: c.name.replace('Terrain ', '').replace('Distance to ', 'Dist. ').split(' ')[0],
      v: +((c.contribution ?? 0) * 100).toFixed(1),
      cls: c.cls,
    }));

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Summary */}
      <div className="p-3 rounded" style={{ background: `${m.color}0d`, border: `1px solid ${m.color}25` }}>
        <div className="text-xs leading-relaxed" style={{ color: '#c4d4e8' }}>
          This coordinate ({zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E) is evaluated with <strong style={{ color: m.color }}>{m.label.toLowerCase()} flood suitability</strong> (Continuous Score: {zone.score.toFixed(3)}/5.00). Inundation vulnerability is driven by local slope gradient, rainfall intensity, and distance to primary river channels.
        </div>
      </div>

      {/* Top contributors mini chart */}
      {topContributors.length > 0 && (
        <div>
          <SectionLabel>Top Criterion Contributions</SectionLabel>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={topContributors} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: '#374f6a', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 10, fill: '#647d9a' }} axisLine={false} tickLine={false} />
              <Bar dataKey="v" radius={[0, 2, 2, 0]}>
                {topContributors.map((c, i) => (
                  <Cell key={i} fill={c.cls === 'positive' ? '#00b4d8' : '#f97316'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Positive factors */}
      {positive.length > 0 && (
        <div>
          <SectionLabel>Mitigating / Low-Risk Factors ({positive.length})</SectionLabel>
          {positive.slice(0, 5).map(c => (
            <div key={c.name} className="flex items-start gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#00c896' }} />
              <div className="text-xs" style={{ color: '#647d9a' }}>
                <span style={{ color: '#c4d4e8' }}>{c.name}</span> — raw {c.rawScore !== null ? c.rawScore.toFixed(1) : 'N/A'}{c.unit ? ` ${c.unit}` : ''} (Rating {c.rating ?? 1}, w={c.weight.toFixed(3)})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Limiting factors */}
      {limiting.length > 0 && (
        <div>
          <SectionLabel>Primary Hazard Determinants ({limiting.length})</SectionLabel>
          {limiting.map(c => (
            <div key={c.name} className="flex items-start gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#f97316' }} />
              <div className="text-xs" style={{ color: '#647d9a' }}>
                <span style={{ color: '#c4d4e8' }}>{c.name}</span> — raw {c.rawScore !== null ? c.rawScore.toFixed(1) : 'N/A'}{c.unit ? ` ${c.unit}` : ''} (Rating {c.rating ?? 5}, w={c.weight.toFixed(3)})
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Criteria ───────────────────────────────────────────────── */
function CriteriaTab({ zone, onEvidence }: { zone: Zone; onEvidence: (id: string) => void }) {
  const criteria = zone.criteria || [];
  const chartData = criteria.map(c => ({
    name: c.name.replace('Terrain ', '').replace('Distance to ', 'Dist. ').replace('Topographic ', '').split(' ')[0],
    weight: +(c.weight * 100).toFixed(1),
    rating: +((c.rating ?? 1) * 20).toFixed(0),
    contrib: +((c.contribution ?? 0) * 100).toFixed(1),
  }));

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <SectionLabel>AHP Weight (%) vs Normalised Rating (%)</SectionLabel>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: -8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="2,3" stroke="#111d33" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#647d9a' }} angle={-45} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#374f6a', fontFamily: 'var(--font-mono)' }} />
            <Tooltip contentStyle={{ background: '#0c1424', border: '1px solid #1c2e48', borderRadius: 4, fontSize: 10 }}
              labelStyle={{ color: '#c4d4e8' }} itemStyle={{ color: '#647d9a' }} />
            <Bar dataKey="weight" fill="#2d9cdb" opacity={0.8} radius={[2, 2, 0, 0]} name="AHP Weight %" />
            <Bar dataKey="rating"  fill="#00b4d8" opacity={0.9} radius={[2, 2, 0, 0]} name="Rating (norm %)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionLabel>Criterion Sample Values ({criteria.length})</SectionLabel>
      {criteria.map(c => (
        <div key={c.name} className="mb-3 p-2.5 rounded" style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium" style={{ color: '#c4d4e8' }}>{c.name}</span>
            <div className="flex items-center gap-2">
              <Mono color={c.cls === 'positive' ? '#00c896' : '#f97316'}>
                {c.rawScore !== null ? `${c.rawScore.toFixed(1)}${c.unit ? ` ${c.unit}` : ''}` : 'NoData'}
              </Mono>
              <button onClick={() => onEvidence(c.layerId)}
                className="text-[9px] px-1.5 py-px rounded hover:bg-[#00b4d822]"
                style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
                ⊞ map
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ScoreBar value={(c.rating ?? 1) / 5.0} color={c.cls === 'positive' ? '#00b4d8' : '#f97316'} height={3} />
            </div>
            <span className="text-[10px] w-12 text-right" style={{ color: '#647d9a', fontFamily: 'var(--font-mono)' }}>
              w={(c.weight * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-[10px] mt-1 flex justify-between" style={{ color: '#374f6a' }}>
            <span>Rating: {c.rating ?? 1}/5 · Contrib: {((c.contribution ?? 0) * 100).toFixed(1)}%</span>
            <span>{c.source}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Statistics ─────────────────────────────────────────────── */
function StatisticsTab({ zone, stats }: { zone: Zone; stats: AnalysisStatistics }) {
  const classDist = stats.class_distribution || [];
  const distChartData = classDist.map(d => ({
    name: d.label,
    value: d.percentage,
    area: d.area_km2,
    color: d.class_value === 5 ? '#00c896' : d.class_value === 4 ? '#4ade80' : d.class_value === 3 ? '#fbbf24' : d.class_value === 2 ? '#f97316' : '#ef4444',
  }));

  const maxArea = Math.max(...classDist.map(d => d.area_km2), 1);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* State wide summary statistics */}
      <div>
        <SectionLabel>Analysis Statistics (Statewide HP)</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Total Pixels" value={`${(stats.total_pixels / 1e6).toFixed(1)} M`} sub="30 m grid" />
          <StatTile label="Valid Area"   value={`${(stats.valid_pixels * 900 / 1e6).toFixed(0)} km²`} accent="#00c896" />
          <StatTile label="Score Min"    value={stats.score_min?.toFixed(2) || '1.10'} sub="pixel minimum" />
          <StatTile label="Score Max"    value={stats.score_max?.toFixed(2) || '3.45'} sub="pixel maximum" />
          <StatTile label="Mean Score"   value={stats.score_mean?.toFixed(2) || '1.80'} sub="μ" accent="#00b4d8" />
          <StatTile label="Std Dev"      value={stats.score_std?.toFixed(3) || '0.349'} sub="σ" />
          <StatTile label="Valid Px %"   value={`${stats.valid_coverage_pct?.toFixed(1)}%`} sub="coverage" />
          <StatTile label="AHP CR"       value="0.0158" sub="consistency" accent="#00c896" />
        </div>
      </div>

      {/* Suitability class pie */}
      <div>
        <SectionLabel>Class Distribution — Himachal Pradesh</SectionLabel>
        <div className="flex items-center gap-3">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie data={distChartData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={1}>
                {distChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 flex-1">
            {distChartData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[10px] flex-1" style={{ color: '#647d9a' }}>{d.name}</span>
                <Mono color="#c4d4e8">{d.value.toFixed(1)}%</Mono>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area by class */}
      <div>
        <SectionLabel>Area by Suitability Class (km²)</SectionLabel>
        {distChartData.map(d => (
          <div key={d.name} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] w-16 flex-shrink-0" style={{ color: '#647d9a' }}>{d.name}</span>
            <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: '#111d33' }}>
              <div className="h-full rounded-sm" style={{ width: `${(d.area / maxArea) * 100}%`, background: d.color, opacity: 0.85 }} />
            </div>
            <Mono color="#647d9a">{d.area.toFixed(0)}</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Evidence ───────────────────────────────────────────────── */
function EvidenceTab({ zone, onEvidence }: { zone: Zone; onEvidence: (id: string) => void }) {
  const m = SUIT_META[zone.cls] || SUIT_META['low'];
  const criteria = zone.criteria || [];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Why box */}
      <div className="p-3 rounded border-l-2" style={{ background: `${m.color}0a`, borderLeftColor: m.color }}>
        <div className="text-xs font-semibold mb-1.5" style={{ color: m.color }}>
          Why is this coordinate evaluated as {m.label} suitability?
        </div>
        <div className="text-xs leading-relaxed" style={{ color: '#647d9a' }}>
          Evaluated under the 11-Factor AHP Flood Model. Multi-criteria aggregation formula:
          <div className="my-1.5 font-mono text-[10px] px-2 py-1 rounded bg-[#080d18] text-[#00b4d8]">
            S = Σ (wᵢ × rᵢ) = {zone.score.toFixed(3)}
          </div>
          The combination of high terrain slopes and distance from river banks reduces flood accumulation risk, despite high regional monsoon rainfall.
        </div>
      </div>

      {/* Per-criterion evidence */}
      <SectionLabel>Criterion Evidence & Sources</SectionLabel>
      {criteria.map(c => (
        <div key={c.name} className="mb-3 p-3 rounded" style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-xs font-medium" style={{ color: '#c4d4e8' }}>{c.name}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Mono color={c.cls === 'positive' ? '#00c896' : '#f97316'}>
                {c.rawScore !== null ? c.rawScore.toFixed(1) : 'N/A'}{c.unit ? ` ${c.unit}` : ''}
              </Mono>
              <span className="text-[9px]" style={{ color: '#374f6a' }}>w={c.weight.toFixed(3)}</span>
            </div>
          </div>
          <div className="text-[11px] leading-relaxed mb-2" style={{ color: '#647d9a' }}>{c.evidence}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => onEvidence(c.layerId)}
              className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 hover:bg-[#00b4d822]"
              style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
              <IconChart size={9} /> Show Layer on Map
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
function MetadataTab({ modelDetail }: { modelDetail?: ModelDetail | null }) {
  const rows = [
    ['Model',           '11-Factor Flood Suitability AHP'],
    ['Model ID',        'flood_11_factor_v1'],
    ['Run ID',          '51'],
    ['AHP Method',      'Saaty (1980) Pairwise Matrix'],
    ['CR (Consistency)','0.0158  <  0.10 ✓ (Valid)'],
    ['Criteria Count',  '11 Biophysical Criteria'],
    ['DEM Source',      'SRTM 30 m DEM (NASA)'],
    ['Climate',         'CHIRPS v2.0 (IMD / UCSB)'],
    ['LULC',            'ESA WorldCover 10 m (2021)'],
    ['Hydrology',       'HydroRIVERS + OSM Hydrology'],
    ['Soil',            'SoilGrids v2.0 (ISRIC 250 m)'],
    ['Vegetation',      'Sentinel-2 L2A Annual Composite'],
    ['Output CRS',      'EPSG:4326 / EPSG:32643 UTM 43N'],
    ['Spatial Res.',    '30 m spatial resolution'],
    ['Framework',       'Python 3.12 · Rasterio 1.5.1 · GDAL'],
  ];

  const weights = modelDetail?.weights || [
    { criterion_id: 'slope', weight: 0.230588 },
    { criterion_id: 'distance_to_rivers', weight: 0.148021 },
    { criterion_id: 'twi', weight: 0.142168 },
    { criterion_id: 'rainfall', weight: 0.132592 },
    { criterion_id: 'flow_accumulation', weight: 0.111538 },
    { criterion_id: 'drainage_density', weight: 0.066758 },
    { criterion_id: 'lulc', weight: 0.057282 },
    { criterion_id: 'elevation', weight: 0.034521 },
    { criterion_id: 'soil', weight: 0.031730 },
    { criterion_id: 'curvature', weight: 0.028179 },
    { criterion_id: 'ndvi', weight: 0.016624 },
  ];

  const maxW = Math.max(...weights.map(w => w.weight), 0.25);

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <SectionLabel>Spatial Knowledge Package Metadata</SectionLabel>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-1.5" style={{ borderBottom: '1px solid #111d33' }}>
            <span className="text-[10px] flex-shrink-0 w-28" style={{ color: '#374f6a' }}>{k}</span>
            <span className="text-[10px] text-right flex-1" style={{ color: '#647d9a', fontFamily: 'var(--font-mono)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div>
        <SectionLabel>AHP Weight Configuration (11 Criteria)</SectionLabel>
        {weights.map(r => (
          <div key={r.criterion_id} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] flex-1 truncate" style={{ color: '#647d9a' }}>
              {r.criterion_id.replace(/_/g, ' ')}
            </span>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#111d33' }}>
              <div className="h-full rounded-full" style={{ width: `${(r.weight / maxW) * 100}%`, background: '#2d9cdb' }} />
            </div>
            <Mono color="#c4d4e8">{(r.weight * 100).toFixed(2)}%</Mono>
          </div>
        ))}
        <div className="mt-2 p-2 rounded text-[10px]" style={{ background: '#111d33', color: '#00c896', fontFamily: 'var(--font-mono)' }}>
          Σ weights = 1.0000  ·  CR = 0.0158 (Passes Saaty consistency &lt; 0.10)
        </div>
      </div>

      <div>
        <SectionLabel>AHP Mathematical Methodology</SectionLabel>
        <div className="text-[11px] leading-relaxed" style={{ color: '#647d9a' }}>
          Multi-Criteria Decision Analysis (MCDA) based on the Analytic Hierarchy Process (Saaty, 1980). A pairwise comparison matrix (11×11) was evaluated to compute priority eigenvalue weights. Pairwise consistency validated with Principal Eigenvalue (λmax = 11.238), Consistency Index (CI = 0.0238), and Random Index (RI = 1.51), yielding a Consistency Ratio (CR) of 0.0158.
        </div>
      </div>
    </div>
  );
}
