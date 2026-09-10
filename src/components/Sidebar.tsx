import { useState, type ReactNode } from 'react';
import { LAYERS, SUIT_META, SUIT_ORDER } from '../data';
import type { Layer } from '../types';
import { IconEye, IconEyeOff, IconInfo, IconChevronD, IconChevronR, IconFilter, IconSettings, IconRefresh, IconGlobe } from '../icons';
import { SectionLabel, Btn, Pill } from '../ui';

const LAYER_GROUPS = [
  { id: 'composite',    label: 'Composite' },
  { id: 'topographic',  label: 'Topographic' },
  { id: 'hydrological', label: 'Hydrological' },
  { id: 'environmental',label: 'Environmental' },
];

const BASEMAPS = [
  { id: 'dark',      label: 'Dark',      color: '#080d18' },
  { id: 'satellite', label: 'Satellite', color: '#1a2e1a' },
  { id: 'topo',      label: 'Topo',      color: '#1e1a2e' },
  { id: 'streets',   label: 'Streets',   color: '#1a1e2e' },
];

interface Props {
  open: boolean;
  layers: Layer[];
  setLayers: (l: Layer[]) => void;
  onLayerEvidence: (id: string) => void;
  basemap: string;
  onBasemap: (b: string) => void;
}

export default function Sidebar({ open, layers, setLayers, onLayerEvidence, basemap, onBasemap }: Props) {
  const [section, setSection] = useState<Record<string, boolean>>({
    analysis: true, layers: true, legend: true, filters: false, basemap: false, options: false,
  });
  const toggle = (k: string) => setSection(s => ({ ...s, [k]: !s[k] }));

  const toggleLayer = (id: string) =>
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  const setOpacity = (id: string, v: number) =>
    setLayers(layers.map(l => l.id === id ? { ...l, opacity: v } : l));
  const showAll = () => setLayers(layers.map(l => ({ ...l, visible: true })));
  const hideAll = () => setLayers(layers.map(l => ({ ...l, visible: false, ...(l.id === 'suitability' ? { visible: true } : {}) })));

  return (
    <aside className="flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300"
      style={{ width: open ? 300 : 0, minWidth: open ? 300 : 0, background: '#0c1424', borderRight: '1px solid #1c2e48' }}>
      {open && (
        <div className="flex flex-col h-full overflow-y-auto" style={{ minWidth: 300 }}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
            style={{ background: '#080d18', borderBottom: '1px solid #1c2e48' }}>
            <div className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: '#647d9a', letterSpacing: '0.08em' }}>
              GIS CONTROL PANEL
            </div>
            <div className="flex items-center gap-1">
              <Btn title="Refresh" className="w-6 h-6"><IconRefresh size={11} /></Btn>
              <Btn title="Settings" className="w-6 h-6"><IconSettings size={11} /></Btn>
            </div>
          </div>

          {/* Analysis / Study area */}
          <SideSection label="Study Area & Model" open={section.analysis} onToggle={() => toggle('analysis')}>
            <div className="px-4 pb-4 flex flex-col gap-2.5">
              <Field label="Analysis Domain">
                <select className="w-full">
                  <option>West Bengal, India</option>
                  <option>Karnataka, India</option>
                  <option>Maharashtra, India</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="District">
                  <select className="w-full"><option>Jalpaiguri</option><option>Alipurduar</option><option>Darjeeling</option></select>
                </Field>
                <Field label="Sub-district">
                  <select className="w-full"><option>Sadar</option><option>Nagrakata</option><option>Madarihat</option></select>
                </Field>
              </div>
              <Field label="Suitability Model">
                <select className="w-full">
                  <option>Groundwater Recharge Potential v2.1</option>
                  <option>Urban Expansion Suitability v1.3</option>
                  <option>Flood Hazard Risk Index v3.0</option>
                </select>
              </Field>
              <div className="flex gap-2 mt-1">
                <button className="flex-1 h-7 rounded text-xs font-medium transition-colors"
                  style={{ background: 'rgba(0,180,216,0.12)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }}>
                  Apply
                </button>
                <button className="h-7 px-3 rounded text-xs"
                  style={{ color: '#647d9a', border: '1px solid #1c2e48' }}>
                  Reset
                </button>
              </div>
            </div>
          </SideSection>

          {/* Layers */}
          <SideSection label="Layers" open={section.layers} onToggle={() => toggle('layers')}
            actions={
              <div className="flex items-center gap-1">
                <button onClick={showAll} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)' }}>All</button>
                <button onClick={hideAll} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#647d9a', border: '1px solid #1c2e48' }}>None</button>
              </div>
            }>
            <div className="pb-3">
              {LAYER_GROUPS.map(g => {
                const gl = layers.filter(l => l.group === g.id);
                if (!gl.length) return null;
                return (
                  <LayerGroup key={g.id} label={g.label}>
                    {gl.map(l => (
                      <LayerRow key={l.id} layer={l} onToggle={toggleLayer} onOpacity={setOpacity} onInfo={onLayerEvidence} />
                    ))}
                  </LayerGroup>
                );
              })}
            </div>
          </SideSection>

          {/* Legend */}
          <SideSection label="Legend" open={section.legend} onToggle={() => toggle('legend')}>
            <div className="px-4 pb-4">
              <div className="text-[10px] mb-2" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
                Composite Suitability Index · AHP weighted
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {SUIT_ORDER.map(cls => {
                  const m = SUIT_META[cls];
                  return (
                    <div key={cls} className="flex items-center gap-2.5">
                      <div className="w-8 h-3 rounded-sm flex-shrink-0" style={{ background: m.color, opacity: 0.85 }} />
                      <div className="flex-1 text-xs" style={{ color: '#c4d4e8' }}>{m.label}</div>
                      <div className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>{m.range}</div>
                    </div>
                  );
                })}
              </div>
              {/* Gradient bar */}
              <div className="h-2.5 rounded-sm mb-1" style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #fbbf24, #4ade80, #00c896)' }} />
              <div className="flex justify-between text-[9px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
                <span>0.0</span><span>0.25</span><span>0.5</span><span>0.75</span><span>1.0</span>
              </div>
            </div>
          </SideSection>

          {/* Filters */}
          <SideSection label="Filters" open={section.filters} onToggle={() => toggle('filters')}>
            <div className="px-4 pb-4 flex flex-col gap-3">
              <Field label="Score range">
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} defaultValue={0} className="flex-1" />
                  <span className="text-[10px] w-8 text-right" style={{ color: '#647d9a', fontFamily: 'var(--font-mono)' }}>0.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} defaultValue={100} className="flex-1" />
                  <span className="text-[10px] w-8 text-right" style={{ color: '#647d9a', fontFamily: 'var(--font-mono)' }}>1.0</span>
                </div>
              </Field>
              <Field label="Suitability class">
                <div className="flex flex-wrap gap-1.5">
                  {SUIT_ORDER.map(cls => (
                    <label key={cls} className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: SUIT_META[cls].color }}>
                      <input type="checkbox" defaultChecked className="w-3 h-3" />
                      {SUIT_META[cls].label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Minimum area">
                <div className="flex items-center gap-2">
                  <input type="number" defaultValue={50} min={0} className="flex-1 h-7 px-2 text-xs rounded"
                    style={{ background: '#111d33', border: '1px solid #1c2e48', color: '#c4d4e8', outline: 'none' }} />
                  <span className="text-xs" style={{ color: '#374f6a' }}>km²</span>
                </div>
              </Field>
              <button className="h-7 w-full rounded text-xs flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(0,180,216,0.1)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)' }}>
                <IconFilter size={11} /> Apply Filters
              </button>
            </div>
          </SideSection>

          {/* Basemap */}
          <SideSection label="Basemap" open={section.basemap} onToggle={() => toggle('basemap')}>
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {BASEMAPS.map(b => (
                <button key={b.id} onClick={() => onBasemap(b.id)}
                  className="h-14 rounded text-xs font-medium transition-all"
                  style={{
                    background: b.color, color: '#c4d4e8',
                    border: basemap === b.id ? '2px solid #00b4d8' : '1px solid #1c2e48',
                    boxShadow: basemap === b.id ? '0 0 0 1px rgba(0,180,216,0.3)' : 'none',
                  }}>
                  <IconGlobe size={14} style={{ display: 'block', margin: '0 auto 4px' }} />
                  {b.label}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Map options */}
          <SideSection label="Map Options" open={section.options} onToggle={() => toggle('options')}>
            <div className="px-4 pb-4 flex flex-col gap-2">
              {[
                { label: 'Show graticule', checked: true },
                { label: 'Show district labels', checked: true },
                { label: 'Show settlement markers', checked: true },
                { label: 'Show scale bar', checked: true },
                { label: 'Show coordinates', checked: true },
                { label: 'Terrain hillshade', checked: false },
              ].map(opt => (
                <label key={opt.label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked={opt.checked} className="w-3.5 h-3.5" />
                  <span className="text-xs" style={{ color: '#c4d4e8' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </SideSection>

          {/* Footer */}
          <div className="mt-auto px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #1c2e48' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Pill color="#00b4d8">Run ID: GRP-2024-WB-0042</Pill>
              <Pill color="#00c896">ROC-AUC 0.87</Pill>
            </div>
            <div className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
              Processed 2024-11-08 03:47 UTC · v2.1
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/* Sub-components */
function SideSection({ label, open, onToggle, children, actions }: {
  label: string; open: boolean; onToggle: () => void; children: ReactNode; actions?: ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #111d33' }}>
      <button onClick={onToggle}
        className="flex items-center w-full px-4 py-2.5 transition-colors hover:bg-[#0e1828]"
        style={{ color: '#647d9a' }}>
        <span className="flex-1 text-left text-[10px] font-semibold tracking-[0.08em] uppercase"
          style={{ fontFamily: 'var(--font-mono)' }}>{label}</span>
        {actions && <span onClick={e => e.stopPropagation()}>{actions}</span>}
        <span className="ml-2 flex-shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <IconChevronD size={11} />
        </span>
      </button>
      {open && children}
    </div>
  );
}

function LayerGroup({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-1 text-[10px] font-medium"
        style={{ color: '#374f6a', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
        <span className="flex-shrink-0" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          <IconChevronR size={9} />
        </span>
        {label.toUpperCase()}
      </button>
      {open && <div className="pl-2">{children}</div>}
    </div>
  );
}

function LayerRow({ layer, onToggle, onOpacity, onInfo }: {
  layer: Layer;
  onToggle: (id: string) => void;
  onOpacity: (id: string, v: number) => void;
  onInfo: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-2 rounded mx-2 mb-0.5 transition-colors"
      style={{ background: expanded ? '#111d33' : 'transparent' }}>
      <div className="flex items-center gap-1 py-1.5">
        <button onClick={() => onToggle(layer.id)} className="flex-shrink-0 transition-opacity w-5 h-5 flex items-center justify-center"
          style={{ color: layer.visible ? '#00b4d8' : '#374f6a' }}>
          {layer.visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
        </button>
        <span className="flex-1 text-xs truncate cursor-pointer select-none"
          style={{ color: layer.visible ? '#c4d4e8' : '#374f6a' }}
          onClick={() => setExpanded(v => !v)}>
          {layer.name}
          {layer.unit && <span className="ml-1 text-[10px]" style={{ color: '#374f6a' }}>({layer.unit})</span>}
        </span>
        <button onClick={() => onInfo(layer.id)} title="Layer info"
          className="w-5 h-5 flex items-center justify-center" style={{ color: '#374f6a' }}>
          <IconInfo size={11} />
        </button>
        <button onClick={() => setExpanded(v => !v)}
          className="w-5 h-5 flex items-center justify-center" style={{ color: '#374f6a' }}>
          <IconChevronR size={10} />
        </button>
      </div>
      {expanded && (
        <div className="pb-2.5 pl-5 pr-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-12 flex-shrink-0" style={{ color: '#374f6a' }}>Opacity</span>
            <input type="range" min={10} max={100} value={layer.opacity}
              onChange={e => onOpacity(layer.id, +e.target.value)} className="flex-1" />
            <span className="text-[10px] w-7 text-right" style={{ color: '#647d9a', fontFamily: 'var(--font-mono)' }}>
              {layer.opacity}%
            </span>
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: '#374f6a' }}>
            {layer.source}
            {layer.resolution && <span> · {layer.resolution}</span>}
          </div>
          <button onClick={() => onInfo(layer.id)}
            className="text-[10px] h-5 px-2 rounded flex items-center gap-1 self-start"
            style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
            Show Evidence on Map
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px]" style={{ color: '#374f6a' }}>{label}</div>
      {children}
    </div>
  );
}
