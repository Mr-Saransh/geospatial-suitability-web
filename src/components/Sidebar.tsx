import { useState, type ReactNode } from 'react';
import { SUIT_META, SUIT_ORDER, HIMACHAL_LOCATIONS } from '../data';
import type { Layer } from '../types';
import { IconEye, IconEyeOff, IconInfo, IconChevronD, IconChevronR, IconFilter, IconSettings, IconRefresh, IconGlobe } from '../icons';
import { Btn, Pill } from '../ui';

const LAYER_GROUPS = [
  { id: 'composite',     label: 'Analysis Results' },
  { id: 'hydrological',  label: 'Hydrological Criteria' },
  { id: 'topographic',   label: 'Topographic Criteria' },
  { id: 'environmental', label: 'Environmental Criteria' },
];

const BASEMAPS = [
  { id: 'dark',      label: 'Dark Canvas', color: '#080d18' },
  { id: 'satellite', label: 'Satellite',   color: '#1a2e1a' },
  { id: 'topo',      label: 'Topographic', color: '#1e1a2e' },
  { id: 'streets',   label: 'OpenStreet',  color: '#1a1e2e' },
];

interface Props {
  open: boolean;
  layers: Layer[];
  setLayers: (l: Layer[]) => void;
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onLayerEvidence: (id: string) => void;
  basemap: string;
  onBasemap: (b: string) => void;
  onSelectLocation?: (loc: { lat: number; lng: number }) => void;
  modelName?: string;
}

export default function Sidebar({
  open,
  layers,
  setLayers,
  activeLayerId,
  onSelectLayer,
  onLayerEvidence,
  basemap,
  onBasemap,
  onSelectLocation,
  modelName = '11-Factor Flood Suitability AHP',
}: Props) {
  const [section, setSection] = useState<Record<string, boolean>>({
    analysis: true, layers: true, legend: true, filters: false, basemap: false, options: false,
  });
  const [selectedDistrict, setSelectedDistrict] = useState('Shimla');

  const toggle = (k: string) => setSection(s => ({ ...s, [k]: !s[k] }));

  const toggleLayer = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    onSelectLayer(id);
  };

  const setOpacity = (id: string, v: number) => {
    setLayers(layers.map(l => l.id === id ? { ...l, opacity: v } : l));
  };

  const showAll = () => setLayers(layers.map(l => ({ ...l, visible: true })));
  const hideAll = () => setLayers(layers.map(l => ({ ...l, visible: false })));

  const handleDistrictChange = (distName: string) => {
    setSelectedDistrict(distName);
    const loc = HIMACHAL_LOCATIONS.find(l => l.name.toLowerCase() === distName.toLowerCase() || l.district.toLowerCase() === distName.toLowerCase());
    if (loc && onSelectLocation) {
      onSelectLocation({ lat: loc.lat, lng: loc.lng });
    }
  };

  return (
    <aside className="flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 z-20"
      style={{ width: open ? 300 : 0, minWidth: open ? 300 : 0, background: 'var(--c-surface)', borderRight: '1px solid var(--c-border)' }}>
      {open && (
        <div className="flex flex-col h-full overflow-y-auto" style={{ minWidth: 300 }}>

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
            style={{ background: 'var(--c-panel)', borderBottom: '1px solid var(--c-border)' }}>
            <div className="text-xs font-semibold" style={{ fontFamily: 'var(--font-mono)', color: '#00b4d8', letterSpacing: '0.08em' }}>
              GIS CONTROL PANEL
            </div>
            <div className="flex items-center gap-1">
              <Btn title="Refresh Layer Catalog" className="w-6 h-6"><IconRefresh size={11} /></Btn>
              <Btn title="Settings" className="w-6 h-6"><IconSettings size={11} /></Btn>
            </div>
          </div>

          {/* Analysis / Study area */}
          <SideSection label="Study Area & Model" open={section.analysis} onToggle={() => toggle('analysis')}>
            <div className="px-4 pb-4 flex flex-col gap-2.5">
              <Field label="Analysis Domain">
                <select className="w-full" value="Himachal Pradesh, India" disabled>
                  <option>Himachal Pradesh, India</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="District / Focus Area">
                  <select
                    className="w-full"
                    value={selectedDistrict}
                    onChange={e => handleDistrictChange(e.target.value)}
                  >
                    {HIMACHAL_LOCATIONS.map(loc => (
                      <option key={loc.name} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Spatial Extent">
                  <select className="w-full">
                    <option>Statewide (135M px)</option>
                    <option>Valley Focus</option>
                    <option>River Corridors</option>
                  </select>
                </Field>
              </div>
              <Field label="Suitability Model">
                <select className="w-full" value={modelName} disabled>
                  <option>{modelName}</option>
                </select>
              </Field>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleDistrictChange(selectedDistrict)}
                  className="flex-1 h-7 rounded text-xs font-medium transition-colors hover:brightness-110"
                  style={{ background: 'rgba(0,180,216,0.15)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.35)' }}>
                  Locate Area
                </button>
                <button
                  onClick={() => handleDistrictChange('Shimla')}
                  className="h-7 px-3 rounded text-xs transition-colors hover:opacity-80"
                  style={{ color: 'var(--c-text2)', border: '1px solid var(--c-border)', background: 'var(--c-panel)' }}>
                  Reset
                </button>
              </div>
            </div>
          </SideSection>

          {/* Layers */}
          <SideSection label="Raster Layers (24)" open={section.layers} onToggle={() => toggle('layers')}
            actions={
              <div className="flex items-center gap-1">
                <button onClick={showAll} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)' }}>All</button>
                <button onClick={hideAll} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--c-text2)', border: '1px solid var(--c-border)' }}>None</button>
              </div>
            }>
            <div className="pb-3">
              {LAYER_GROUPS.map(g => {
                const gl = layers.filter(l => l.group === g.id);
                if (!gl.length) return null;
                return (
                  <LayerGroup key={g.id} label={g.label}>
                    {gl.map(l => (
                      <LayerRow
                        key={l.id}
                        layer={l}
                        isActive={activeLayerId === l.id}
                        onToggle={toggleLayer}
                        onSelect={onSelectLayer}
                        onOpacity={setOpacity}
                        onInfo={onLayerEvidence}
                      />
                    ))}
                  </LayerGroup>
                );
              })}
            </div>
          </SideSection>

          {/* Legend */}
          <SideSection label="Suitability Legend" open={section.legend} onToggle={() => toggle('legend')}>
            <div className="px-4 pb-4">
              <div className="text-[10px] mb-2" style={{ color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>
                11-Factor AHP Flood Suitability (Class 1–5)
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {SUIT_ORDER.map(cls => {
                  const m = SUIT_META[cls];
                  return (
                    <div key={cls} className="flex items-center gap-2.5">
                      <div className="w-7 h-3 rounded-sm flex-shrink-0" style={{ background: m.color, opacity: 0.9 }} />
                      <div className="flex-1 text-xs" style={{ color: 'var(--c-text)' }}>{m.label}</div>
                      <div className="text-[10px]" style={{ color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>{m.range}</div>
                    </div>
                  );
                })}
              </div>
              {/* Gradient bar */}
              <div className="h-2.5 rounded-sm mb-1" style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #fbbf24, #4ade80, #00c896)' }} />
              <div className="flex justify-between text-[9px]" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
                <span>1 (Very Low)</span><span>2</span><span>3</span><span>4</span><span>5 (Very High)</span>
              </div>
            </div>
          </SideSection>

          {/* Basemap Selector */}
          <SideSection label="Basemap" open={section.basemap} onToggle={() => toggle('basemap')}>
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {BASEMAPS.map(b => (
                <button key={b.id} onClick={() => onBasemap(b.id)}
                  className="h-14 rounded text-xs font-medium transition-all flex flex-col items-center justify-center gap-1"
                  style={{
                    background: 'var(--c-panel)', color: 'var(--c-text)',
                    border: basemap === b.id ? '2px solid #00b4d8' : '1px solid var(--c-border)',
                    boxShadow: basemap === b.id ? '0 0 0 1px rgba(0,180,216,0.3)' : 'none',
                  }}>
                  <IconGlobe size={14} style={{ color: basemap === b.id ? '#00b4d8' : 'var(--c-text2)' }} />
                  {b.label}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Footer Metadata */}
          <div className="mt-auto px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-panel)' }}>
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <Pill color="#00b4d8">Run ID: 51</Pill>
              <Pill color="#00c896">CR: 0.0158 ✓</Pill>
              <Pill color="#374f6a">11 Criteria</Pill>
            </div>
            <div className="text-[10px]" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
              Himachal Pradesh Spatial Knowledge · v1.0
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
    <div style={{ borderBottom: '1px solid var(--c-border)' }}>
      <button onClick={onToggle}
        className="flex items-center w-full px-4 py-2.5 transition-colors hover:opacity-80"
        style={{ color: 'var(--c-text2)' }}>
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
        style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
        <span className="flex-shrink-0" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          <IconChevronR size={9} />
        </span>
        {label.toUpperCase()}
      </button>
      {open && <div className="pl-2">{children}</div>}
    </div>
  );
}

function LayerRow({ layer, isActive, onToggle, onSelect, onOpacity, onInfo }: {
  layer: Layer;
  isActive: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onOpacity: (id: string, v: number) => void;
  onInfo: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-2 rounded mx-2 mb-0.5 transition-colors"
      style={{
        background: isActive ? 'rgba(0,180,216,0.1)' : expanded ? 'var(--c-panel)' : 'transparent',
        border: isActive ? '1px solid rgba(0,180,216,0.3)' : '1px solid transparent',
      }}>
      <div className="flex items-center gap-1 py-1.5">
        <button
          onClick={() => onToggle(layer.id)}
          className="flex-shrink-0 transition-opacity w-5 h-5 flex items-center justify-center"
          style={{ color: layer.visible ? '#00b4d8' : 'var(--c-text3)' }}>
          {layer.visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
        </button>
        <span
          className="flex-1 text-xs truncate cursor-pointer select-none"
          style={{ color: layer.visible ? 'var(--c-text)' : 'var(--c-text2)', fontWeight: isActive ? 600 : 400 }}
          onClick={() => { onSelect(layer.id); onToggle(layer.id); }}>
          {layer.name}
          {layer.unit && <span className="ml-1 text-[10px]" style={{ color: 'var(--c-text3)' }}>({layer.unit})</span>}
        </span>
        <button onClick={() => onInfo(layer.id)} title="Layer info"
          className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--c-text3)' }}>
          <IconInfo size={11} />
        </button>
        <button onClick={() => setExpanded(v => !v)}
          className="w-5 h-5 flex items-center justify-center" style={{ color: 'var(--c-text3)' }}>
          <IconChevronR size={10} style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} />
        </button>
      </div>
      {expanded && (
        <div className="pb-2.5 pl-5 pr-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] w-12 flex-shrink-0 font-medium" style={{ color: 'var(--c-text2)' }}>Opacity</span>
            <div className="relative flex-1 flex items-center h-4">
              <input
                type="range"
                min={10}
                max={100}
                value={layer.opacity}
                onChange={e => onOpacity(layer.id, +e.target.value)}
                className="w-full opacity-slider cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #00b4d8 0%, #00b4d8 ${layer.opacity}%, rgba(100,125,154,0.3) ${layer.opacity}%, rgba(100,125,154,0.3) 100%)`,
                }}
              />
            </div>
            <span className="text-[10px] w-8 text-right font-semibold" style={{ color: '#00b4d8', fontFamily: 'var(--font-mono)' }}>
              {layer.opacity}%
            </span>
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: 'var(--c-text2)' }}>
            {layer.source}
            {layer.resolution && <span> · {layer.resolution}</span>}
          </div>
          <button onClick={() => onInfo(layer.id)}
            className="text-[10px] h-5 px-2 rounded flex items-center gap-1 self-start"
            style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
            Render Layer on Map
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px]" style={{ color: 'var(--c-text2)' }}>{label}</div>
      {children}
    </div>
  );
}
