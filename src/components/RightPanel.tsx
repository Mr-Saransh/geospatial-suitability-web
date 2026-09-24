import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { SUIT_META, INITIAL_STATS } from '../data';
import type { Zone, RightTab } from '../types';
import type { AnalysisStatistics, ModelDetail } from '../lib/api/types';
import { SuitBadge, ScoreBar, SectionLabel, StatTile, TabBar, EmptyState, Mono, Pill } from '../ui';
import { IconAnalyze, IconChart } from '../icons';

interface Props {
  zone: Zone | null;
  onLayerEvidence: (id: string) => void;
  statistics?: AnalysisStatistics | null;
  modelDetail?: ModelDetail | null;
  onTabChange?: (t: RightTab) => void;
  onClose?: () => void;
}

const TABS = [
  { id: 'statistics', label: 'Statistics' },
  { id: 'criteria',   label: 'Criteria' },
  { id: 'overview',   label: 'Overview' },
  { id: 'evidence',   label: 'Evidence' },
  { id: 'metadata',   label: 'Metadata' },
];

export default function RightPanel({ zone, onLayerEvidence, statistics, modelDetail, onClose }: Props) {
  const [tab, setTab] = useState<RightTab>('statistics');
  const stats = statistics || (INITIAL_STATS as any);

  return (
    <div className="flex flex-col overflow-hidden z-20 w-full sm:w-80 md:w-[320px] shrink-0" style={{ background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)' }}>
      {/* Panel header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ background: 'var(--c-panel)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2">
            <IconAnalyze size={13} style={{ color: '#00b4d8' }} />
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase"
              style={{ fontFamily: 'var(--font-mono)', color: '#00b4d8' }}>Point Inspection & Analytics</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded hover:opacity-75 transition-opacity text-xs"
              style={{ color: 'var(--c-text2)' }}
              title="Close panel"
            >
              ✕
            </button>
          )}
        </div>
        {zone ? (
          <>
            <div className="flex items-start justify-between mt-1">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-text)' }}>
                    {zone.label || `${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E`}
                  </span>
                  <SuitBadge cls={zone.cls} />
                </div>
                <div className="text-[11px]" style={{ color: 'var(--c-text2)' }}>
                  {zone.district} · {zone.region}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-right font-medium" style={{ color: 'var(--c-text3)' }}>
                  Susceptibility Score
                </div>
                <div className="text-2xl font-semibold text-right" style={{ fontFamily: 'var(--font-mono)', color: SUIT_META[zone.cls]?.color || '#00b4d8' }}>
                  {zone.score ? zone.score.toFixed(2) : 'N/A'}
                </div>
                <div className="text-[9px] text-right font-semibold" style={{ color: SUIT_META[zone.cls]?.color || '#00b4d8', fontFamily: 'var(--font-mono)' }}>
                  {zone.classifiedValue ? `Class ${zone.classifiedValue} / 5` : 'NoData'}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <ScoreBar value={(zone.score ?? 0) / 5.0} color={SUIT_META[zone.cls]?.color || '#00b4d8'} height={4} />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Pill color="#00b4d8">{zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E</Pill>
              <Pill color="#374f6a">30 m pixel</Pill>
              {zone.finalStatus === 'VALID' && (
                <Pill color="#00c896">Valid Sample (11/11)</Pill>
              )}
              {zone.finalStatus === 'PARTIAL_EVIDENCE' && (
                <Pill color="#f97316">Partial Evidence ({zone.evidenceCount ?? 10}/11)</Pill>
              )}
              {zone.finalStatus === 'OUTSIDE_ANALYSIS_AREA' && (
                <Pill color="#ef4444">Outside Analysis Area</Pill>
              )}
              {zone.finalStatus === 'NODATA' && (
                <Pill color="#ef4444">NoData (&lt;8 Criteria)</Pill>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs mt-1" style={{ color: 'var(--c-text2)' }}>
            Viewing statewide statistics. Click any map point to inspect pixel ratings.
          </div>
        )}
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={tab} onChange={t => setTab(t as RightTab)} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'statistics' && <StatisticsTab stats={stats} />}
        {tab === 'metadata'   && <MetadataTab modelDetail={modelDetail} />}
        {!zone && tab !== 'statistics' && tab !== 'metadata' ? (
          <EmptyState icon={<IconAnalyze size={18} />}
            title="No coordinates selected"
            body="Click anywhere on the Himachal Pradesh map to inspect real-time pixel values across all 11 criteria and susceptibility models." />
        ) : (
          <>
            {tab === 'overview'   && zone && <OverviewTab zone={zone} />}
            {tab === 'criteria'   && zone && <CriteriaTab zone={zone} onEvidence={onLayerEvidence} />}
            {tab === 'evidence'   && zone && <EvidenceTab zone={zone} onEvidence={onLayerEvidence} />}
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
  const positive = criteria.filter(c => c.cls === 'positive' && c.status === 'VALID');
  const limiting = criteria.filter(c => c.cls === 'limiting' && c.status === 'VALID');

  const topContributors = [...criteria]
    .filter(c => c.status === 'VALID' && c.contribution !== null)
    .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
    .slice(0, 5)
    .map(c => ({
      name: c.name.replace('Terrain ', '').replace('Distance to ', 'Dist. ').replace('Topographic ', '').replace('Annual ', ''),
      fullName: c.name,
      v: +((c.contribution ?? 0) * 100).toFixed(1),
      cls: c.cls,
    }));

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Overview UX Clarity Callout */}
      <div className="p-3 rounded flex flex-col gap-1.5" style={{ background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.22)' }}>
        <div className="text-xs font-semibold text-[#00b4d8]">
          Understanding Flood Susceptibility
        </div>
        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--c-text2)' }}>
          Flood susceptibility indicates how strongly the selected environmental factors combine to indicate susceptibility under this model. It is NOT a probability of flooding and does NOT mean flooding is impossible or guaranteed.
        </div>
      </div>

      {/* Partial Evidence Callout */}
      {zone.finalStatus === 'PARTIAL_EVIDENCE' && (
        <div className="p-3 rounded flex flex-col gap-1.5" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f97316]">Partial Evidence Analysis</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}>
              {zone.evidenceCount ?? 10} / 11 Criteria
            </span>
          </div>
          <div className="text-[11px] leading-relaxed flex flex-col gap-1" style={{ color: 'var(--c-text2)' }}>
            <div><span style={{ color: 'var(--c-text3)' }}>Evidence: </span><strong style={{ color: 'var(--c-text)' }}>{zone.evidenceCount ?? 10} / 11 criteria</strong></div>
            <div><span style={{ color: 'var(--c-text3)' }}>Missing: </span><strong style={{ color: '#f97316' }}>{zone.missingCriteria && zone.missingCriteria.length > 0 ? zone.missingCriteria.map(c => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ')).join(', ') : 'None'}</strong></div>
            <div><span style={{ color: 'var(--c-text3)' }}>Strict: </span><strong style={{ color: 'var(--c-text)' }}>NoData</strong></div>
            <div><span style={{ color: 'var(--c-text3)' }}>Available Evidence: </span><strong style={{ color: '#00b4d8' }}>{zone.score.toFixed(3)}</strong></div>
            <div><span style={{ color: 'var(--c-text3)' }}>Scoring: </span><strong style={{ color: '#00c896' }}>Available-Evidence Renormalized</strong></div>
          </div>
        </div>
      )}

      {/* Outside Boundary Callout */}
      {zone.finalStatus === 'OUTSIDE_ANALYSIS_AREA' && (
        <div className="p-3 rounded" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="text-xs font-semibold text-[#ef4444] mb-1">Outside Analysis Area</div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--c-text2)' }}>
            The selected point ({zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E) lies outside the published Himachal Pradesh analysis boundary and raster mask.
          </div>
        </div>
      )}

      {/* Point Evaluation Summary */}
      {zone.finalStatus !== 'OUTSIDE_ANALYSIS_AREA' && (
        <div className="p-3 rounded" style={{ background: `${m.color}0d`, border: `1px solid ${m.color}25` }}>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--c-text)' }}>
            This coordinate ({zone.lat.toFixed(4)}°N, {zone.lng.toFixed(4)}°E) is evaluated with <strong style={{ color: m.color }}>{m.label.toLowerCase()}</strong>.
          </div>
          <div className="mt-2 text-[11px] flex flex-col gap-1.5 pt-2 border-t border-[var(--c-border)]" style={{ color: 'var(--c-text2)' }}>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--c-text3)' }}>Susceptibility Score:</span>
              <strong style={{ color: m.color, fontFamily: 'var(--font-mono)' }}>{zone.score ? zone.score.toFixed(3) : 'N/A'} / 5.00</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--c-text3)' }}>Susceptibility Class:</span>
              <strong style={{ color: m.color, fontFamily: 'var(--font-mono)' }}>Class {zone.classifiedValue ?? 'N/A'} — {m.label}</strong>
            </div>
          </div>
          <div className="mt-2 pt-1.5 text-[10px] leading-relaxed border-t border-[var(--c-border)]" style={{ color: 'var(--c-text3)' }}>
            <em>Result is a multi-criteria model score, not a flood/no-flood prediction.</em>
          </div>
        </div>
      )}

      {/* Top contributors mini chart */}
      {topContributors.length > 0 && (
        <div>
          <SectionLabel>Top Criterion Contributions</SectionLabel>
          <ResponsiveContainer width="100%" height={145}>
            <BarChart data={topContributors} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10, fill: 'var(--c-text2)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: 'var(--c-text)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--c-text2)' }}
                formatter={(val: any) => [`${val}%`, 'Contribution']}
              />
              <Bar dataKey="v" radius={[0, 3, 3, 0]}>
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
              <div className="text-xs" style={{ color: 'var(--c-text2)' }}>
                <span style={{ color: 'var(--c-text)' }}>{c.name}</span> — raw {c.rawScore !== null ? c.rawScore.toFixed(1) : 'N/A'}{c.unit ? ` ${c.unit}` : ''} (Rating {c.rating ?? 1}, w={c.weight.toFixed(3)})
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
              <div className="text-xs" style={{ color: 'var(--c-text2)' }}>
                <span style={{ color: 'var(--c-text)' }}>{c.name}</span> — raw {c.rawScore !== null ? c.rawScore.toFixed(1) : 'N/A'}{c.unit ? ` ${c.unit}` : ''} (Rating {c.rating ?? 5}, w={c.weight.toFixed(3)})
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
  const chartData = criteria
    .filter(c => c.status === 'VALID' && c.rating !== null)
    .map(c => ({
      name: c.name
        .replace('Terrain ', '')
        .replace('Distance to ', 'Dist. ')
        .replace('Topographic ', '')
        .replace('Annual ', ''),
      fullName: c.name,
      weight: +(c.weight * 100).toFixed(1),
      rating: +((c.rating ?? 1) * 20).toFixed(0),
      contrib: +((c.contribution ?? 0) * 100).toFixed(1),
    }));

  return (
    <div className="p-4 flex flex-col gap-4">
      {chartData.length > 0 && (
        <div>
          <SectionLabel>AHP Weight (%) vs Normalised Rating (%)</SectionLabel>
          <ResponsiveContainer width="100%" height={235}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 65 }}>
              <CartesianGrid strokeDasharray="2,3" stroke="var(--c-border)" vertical={false} />
              <XAxis
                dataKey="name"
                height={60}
                tick={{ fontSize: 9, fill: 'var(--c-text2)' }}
                angle={-40}
                textAnchor="end"
                interval={0}
                dx={-3}
                dy={6}
              />
              <YAxis tick={{ fontSize: 9, fill: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: 'var(--c-text)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--c-text2)' }}
                formatter={(val: any, name: any) => [`${val}%`, name]}
              />
              <Bar dataKey="weight" fill="#2d9cdb" opacity={0.85} radius={[3, 3, 0, 0]} name="AHP Weight %" />
              <Bar dataKey="rating"  fill="#00b4d8" opacity={0.95} radius={[3, 3, 0, 0]} name="Rating (norm %)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <SectionLabel>Criterion Sample Values ({criteria.length})</SectionLabel>
      {criteria.map(c => {
        const isNoData = c.status === 'NODATA' || c.status === 'OUTSIDE_ANALYSIS_AREA' || c.rawScore === null;
        return (
          <div key={c.name} className="mb-3 p-2.5 rounded transition-colors"
            style={{
              background: isNoData ? 'rgba(239,68,68,0.04)' : 'var(--c-panel)',
              border: isNoData ? '1px dashed rgba(239,68,68,0.35)' : '1px solid var(--c-border)'
            }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: isNoData ? 'var(--c-text2)' : 'var(--c-text)' }}>
                {c.name}
              </span>
              <div className="flex items-center gap-2">
                <Mono color={isNoData ? '#ef4444' : (c.cls === 'positive' ? '#00c896' : '#f97316')}>
                  {!isNoData && c.rawScore !== null ? `${c.rawScore.toFixed(1)}${c.unit ? ` ${c.unit}` : ''}` : 'NoData'}
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
                <ScoreBar
                  value={!isNoData && c.rating !== null ? c.rating / 5.0 : 0}
                  color={isNoData ? '#374f6a' : (c.cls === 'positive' ? '#00b4d8' : '#f97316')}
                  height={3}
                />
              </div>
              <span className="text-[10px] w-12 text-right" style={{ color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>
                w={(c.weight * 100).toFixed(1)}%
              </span>
            </div>
            <div className="text-[10px] mt-1 flex justify-between" style={{ color: 'var(--c-text3)' }}>
              <span>
                Rating: {!isNoData && c.rating !== null ? `${c.rating.toFixed(1)}/5` : 'N/A'} · Contrib: {!isNoData && c.contribution !== null ? `${((c.contribution ?? 0) * 100).toFixed(1)}%` : 'N/A'}
              </span>
              <span className={isNoData ? 'text-[#f97316]' : ''}>
                {isNoData ? 'Missing in Mask' : c.source}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Statistics ─────────────────────────────────────────────── */
function StatisticsTab({ stats }: { stats: AnalysisStatistics }) {
  const classDist = stats.class_distribution || [];
  const distChartData = classDist.map(d => ({
    name: d.label,
    value: d.percentage,
    area: d.area_km2,
    color: d.class_value === 1 ? '#00c896' : d.class_value === 2 ? '#4ade80' : d.class_value === 3 ? '#fbbf24' : d.class_value === 4 ? '#f97316' : '#ef4444',
  }));

  const maxArea = Math.max(...classDist.map(d => d.area_km2), 1);
  const evidenceDist = stats.evidence_distribution || [];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Statewide summary statistics */}
      <div>
        <SectionLabel>Analysis Statistics (Statewide HP — Run #56)</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Total Grid Pixels" value={`${(stats.total_pixels / 1e6).toFixed(1)} M`} sub="30 m grid" />
          <StatTile label="Valid Area (HP)"   value={`${((stats.valid_pixels * 900) / 1e6).toFixed(0)} km²`} accent="#00c896" />
          <StatTile label="Score Min"        value={stats.score_min?.toFixed(2) || '1.06'} sub="pixel minimum" />
          <StatTile label="Score Max"        value={stats.score_max?.toFixed(2) || '4.87'} sub="pixel maximum" />
          <StatTile label="Mean Score"       value={stats.score_mean?.toFixed(2) || '1.74'} sub="μ (Available)" accent="#00b4d8" />
          <StatTile label="Std Dev"          value={stats.score_std?.toFixed(3) || '0.352'} sub="σ" />
          <StatTile label="Valid Coverage"   value={`${stats.valid_coverage_pct?.toFixed(1)}%`} sub="within HP bounds" />
          <StatTile label="AHP CR"           value="0.0158" sub="validated consistent" accent="#00c896" />
        </div>
      </div>

      {/* Suitability class pie */}
      <div>
        <SectionLabel>Susceptibility Distribution — Available Evidence</SectionLabel>
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
                <span className="text-[10px] flex-1" style={{ color: 'var(--c-text2)' }}>{d.name}</span>
                <Mono color="var(--c-text)">{d.value.toFixed(1)}%</Mono>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence criteria distribution */}
      {evidenceDist.length > 0 && (
        <div>
          <SectionLabel>Evidence Criteria Distribution</SectionLabel>
          <div className="flex flex-col gap-2">
            {evidenceDist.map(e => (
              <div key={e.criteria_count} className="p-2 rounded" style={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)' }}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span style={{ color: e.criteria_count === 11 ? '#00c896' : '#00b4d8' }}>{e.label}</span>
                  <Mono color="var(--c-text)">{e.percentage.toFixed(2)}%</Mono>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-track)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${e.percentage}%`,
                      background: e.criteria_count === 11 ? '#00c896' : '#00b4d8'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Area by class */}
      <div>
        <SectionLabel>Area by Susceptibility Class (km²)</SectionLabel>
        {distChartData.map(d => (
          <div key={d.name} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] w-16 flex-shrink-0" style={{ color: 'var(--c-text2)' }}>{d.name}</span>
            <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: 'var(--c-track)' }}>
              <div className="h-full rounded-sm" style={{ width: `${(d.area / maxArea) * 100}%`, background: d.color, opacity: 0.85 }} />
            </div>
            <Mono color="var(--c-text2)">{d.area.toFixed(0)}</Mono>
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
          Why is this coordinate evaluated as {m.label}?
        </div>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--c-text2)' }}>
          Evaluated under the canonical 11-Factor AHP Flood Model (Run #56). Multi-criteria aggregation formula:
          <div className="my-1.5 font-mono text-[10px] px-2 py-1 rounded" style={{ background: 'var(--c-panel)', color: '#00b4d8', border: '1px solid var(--c-border)' }}>
            S = Σ (wᵢ × rᵢ) = {zone.score ? zone.score.toFixed(3) : 'N/A'}
          </div>
          The combination of high terrain slopes and distance from river banks reduces flood accumulation risk, despite high regional monsoon rainfall.
        </div>
      </div>

      {/* Per-criterion evidence */}
      <SectionLabel>Criterion Evidence & Sources</SectionLabel>
      {criteria.map(c => {
        const isNoData = c.status === 'NODATA' || c.rawScore === null;
        return (
          <div key={c.name} className="mb-3 p-3 rounded" style={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)' }}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--c-text)' }}>{c.name}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Mono color={isNoData ? '#ef4444' : (c.cls === 'positive' ? '#00c896' : '#f97316')}>
                  {!isNoData && c.rawScore !== null ? c.rawScore.toFixed(1) : 'NoData'}{!isNoData && c.unit ? ` ${c.unit}` : ''}
                </Mono>
                <span className="text-[9px]" style={{ color: 'var(--c-text3)' }}>w={c.weight.toFixed(3)}</span>
              </div>
            </div>
            <div className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--c-text2)' }}>
              {isNoData ? 'This criterion is missing at this pixel and was dynamically handled via Available-Evidence Renormalization.' : c.evidence}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => onEvidence(c.layerId)}
                className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 hover:bg-[#00b4d822]"
                style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
                <IconChart size={9} /> Show Layer on Map
              </button>
              <span className="text-[10px]" style={{ color: 'var(--c-border)' }}>·</span>
              <span className="text-[10px]" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>{c.source}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Metadata ───────────────────────────────────────────────── */
function MetadataTab({ modelDetail }: { modelDetail?: ModelDetail | null }) {
  const rows = [
    ['Model',           '11-Factor Flood Susceptibility AHP'],
    ['Model ID',        'flood_11_factor_v1'],
    ['Canonical Run',   'Run #56'],
    ['Published Rasters','28 Published Rasters (11 F + 11 R + 4 Res + 2 Q)'],
    ['AHP Method',      'Saaty (1980) Pairwise Matrix'],
    ['CR (Consistency)','0.0158  <  0.10 ✓ (Consistent)'],
    ['Criteria Count',  '11 Biophysical Criteria'],
    ['Min. Criteria',   '8 Criteria (Available-Evidence Threshold)'],
    ['Scoring Modes',   'Available-Evidence Renormalized & Strict 11-of-11'],
    ['Validation',      'PASSED (Checksum & Boundary Verified)'],
    ['Kappa Metric',    'N/A (Independent reference data unavailable)'],
    ['DEM Source',      'SRTM 30 m DEM (NASA)'],
    ['Climate',         'CHIRPS v2.0 (IMD / UCSB)'],
    ['LULC',            'ESA WorldCover 10 m (2021)'],
    ['Hydrology',       'HydroRIVERS + OSM Hydrology'],
    ['Soil',            'SoilGrids v2.0 (ISRIC 250 m)'],
    ['Vegetation',      'Sentinel-2 L2A Annual Composite'],
    ['Output CRS',      'EPSG:4326'],
    ['Spatial Res.',    '30 m spatial resolution'],
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
        <SectionLabel>Spatial Knowledge Package Metadata (Run #56)</SectionLabel>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-1.5" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <span className="text-[10px] flex-shrink-0 w-28" style={{ color: 'var(--c-text3)' }}>{k}</span>
            <span className="text-[10px] text-right flex-1" style={{ color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div>
        <SectionLabel>AHP Weight Configuration (11 Criteria)</SectionLabel>
        {weights.map(r => (
          <div key={r.criterion_id} className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--c-text)' }}>
              {r.criterion_id.replace(/_/g, ' ')}
            </span>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-track)' }}>
              <div className="h-full rounded-full" style={{ width: `${(r.weight / maxW) * 100}%`, background: '#2d9cdb' }} />
            </div>
            <Mono color="var(--c-text)">{(r.weight * 100).toFixed(2)}%</Mono>
          </div>
        ))}
        <div className="mt-2 p-2 rounded text-[10px]" style={{ background: 'var(--c-panel)', color: '#00c896', border: '1px solid var(--c-border)', fontFamily: 'var(--font-mono)' }}>
          Σ weights = 1.0000  ·  CR = 0.0158 (Passes Saaty consistency &lt; 0.10)
        </div>
      </div>

      <div>
        <SectionLabel>AHP Mathematical Methodology</SectionLabel>
        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--c-text2)' }}>
          Multi-Criteria Decision Analysis (MCDA) based on the Analytic Hierarchy Process (Saaty, 1980). A pairwise comparison matrix (11×11) was evaluated to compute priority eigenvalue weights. Consistency validated with Principal Eigenvalue (λmax = 11.238), Consistency Index (CI = 0.0238), and Random Index (RI = 1.51), yielding a Consistency Ratio (CR) of 0.0158.
        </div>
      </div>
    </div>
  );
}
