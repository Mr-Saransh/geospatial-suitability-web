import { useState } from 'react';
import { Modal, SectionLabel, Btn, Mono } from '../ui';
import { IconDownload, IconFile, IconImage, IconDatabase, IconGrid, IconChart, IconCheck } from '../icons';

interface Props { onClose: () => void; }

const FORMATS = [
  {
    id: 'csv', label: 'Summary CSV', icon: IconFile, desc: 'Zone scores, classifications and key statistics',
    size: '~48 KB', ext: '.csv',
  },
  {
    id: 'spatial-csv', label: 'Spatial Assessment CSV', icon: IconGrid, desc: 'Full pixel-level assessment with coordinates and criterion scores',
    size: '~12.4 MB', ext: '.csv',
  },
  {
    id: 'geotiff', label: 'GeoTIFF Raster', icon: IconDatabase, desc: 'Single-band suitability index raster in GeoTIFF format',
    size: '~38 MB', ext: '.tif',
  },
  {
    id: 'map-image', label: 'Map Image', icon: IconImage, desc: 'High-resolution composite map with legend and metadata',
    size: '~4.2 MB', ext: '.png',
  },
  {
    id: 'report', label: 'Suitability Report', icon: IconChart, desc: 'Full scientific PDF report with methodology, AHP weights and validation',
    size: '~2.1 MB', ext: '.pdf',
  },
  {
    id: 'metadata', label: 'Metadata / Evidence', icon: IconFile, desc: 'ISO 19115 metadata, dataset provenance and evidence documentation',
    size: '~120 KB', ext: '.xml / .json',
  },
];

const RESOLUTIONS = [
  { id: '10', label: '10 m (Sentinel-2)' },
  { id: '30', label: '30 m (SRTM)' },
  { id: '100', label: '100 m (Aggregated)' },
  { id: '250', label: '250 m (Regional)' },
];

const PROJECTIONS = ['EPSG:32645 (UTM 45N)', 'EPSG:4326 (WGS84)', 'EPSG:3857 (Web Mercator)'];

export default function ExportCenter({ onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(['csv', 'report']));
  const [resolution, setResolution] = useState('30');
  const [projection, setProjection] = useState(PROJECTIONS[0]);
  const [area, setArea] = useState('study');
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (id: string) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => { setDownloading(false); setDone(true); }, 1800);
  };

  return (
    <Modal title="Export Center" onClose={onClose} width={600}>
      <div className="p-5 flex flex-col gap-5">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.3)', color: '#00c896' }}>
              <IconCheck size={22} />
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--c-text)', fontFamily: 'var(--font-display)' }}>
              Export Complete
            </div>
            <div className="text-xs" style={{ color: 'var(--c-text3)' }}>
              {selected.size} file{selected.size > 1 ? 's' : ''} prepared for download
            </div>
            <button onClick={onClose}
              className="mt-2 h-8 px-5 rounded text-xs font-medium"
              style={{ background: 'rgba(0,180,216,0.12)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }}>
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Format selection */}
            <div>
              <SectionLabel>Export Formats ({selected.size} selected)</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map(f => {
                  const Icon = f.icon;
                  const sel = selected.has(f.id);
                  return (
                    <button key={f.id} onClick={() => toggle(f.id)}
                      className="flex items-start gap-3 p-3 rounded text-left transition-all"
                      style={{
                        background: sel ? 'rgba(0,180,216,0.08)' : 'var(--c-panel)',
                        border: `1px solid ${sel ? 'rgba(0,180,216,0.35)' : 'var(--c-border)'}`,
                      }}>
                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: sel ? 'rgba(0,180,216,0.12)' : 'var(--c-surface)', color: sel ? '#00b4d8' : 'var(--c-text2)', border: `1px solid ${sel ? 'rgba(0,180,216,0.25)' : 'var(--c-border)'}` }}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium" style={{ color: sel ? 'var(--c-text)' : 'var(--c-text2)' }}>{f.label}</span>
                          {sel && <IconCheck size={11} style={{ color: '#00b4d8', flexShrink: 0 }} />}
                        </div>
                        <div className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--c-text3)' }}>{f.desc}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Mono color="var(--c-text3)">{f.ext}</Mono>
                          <Mono color="var(--c-text2)">{f.size}</Mono>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionLabel>Spatial Resolution</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {RESOLUTIONS.map(r => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="resolution" value={r.id} checked={resolution === r.id}
                        onChange={() => setResolution(r.id)} className="w-3.5 h-3.5" style={{ accentColor: '#00b4d8' }} />
                      <span className="text-xs" style={{ color: resolution === r.id ? 'var(--c-text)' : 'var(--c-text2)' }}>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <SectionLabel>Area of Interest</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: 'study', label: 'Full study area' },
                    { id: 'visible', label: 'Current map extent' },
                    { id: 'zone', label: 'Selected zone only' },
                  ].map(a => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="area" value={a.id} checked={area === a.id}
                        onChange={() => setArea(a.id)} className="w-3.5 h-3.5" style={{ accentColor: '#00b4d8' }} />
                      <span className="text-xs" style={{ color: area === a.id ? 'var(--c-text)' : 'var(--c-text2)' }}>{a.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-3">
                  <SectionLabel>Projection</SectionLabel>
                  <select value={projection} onChange={e => setProjection(e.target.value)} className="w-full">
                    {PROJECTIONS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Summary + action */}
            <div className="flex items-center justify-between pt-3"
              style={{ borderTop: '1px solid var(--c-border)' }}>
              <div className="text-[11px]" style={{ color: 'var(--c-text3)' }}>
                Model: GRP v2.1 · {RESOLUTIONS.find(r => r.id === resolution)?.label} · {area === 'study' ? 'Full area' : area}
              </div>
              <button onClick={handleDownload}
                disabled={selected.size === 0 || downloading}
                className="flex items-center gap-2 h-8 px-4 rounded text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: '#00b4d8', color: '#080d18' }}>
                {downloading ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-[#080d18] border-t-transparent animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <><IconDownload size={12} /> Download {selected.size} file{selected.size > 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
