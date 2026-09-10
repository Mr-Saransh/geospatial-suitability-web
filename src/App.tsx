import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MapCanvas from './components/MapCanvas';
import RightPanel from './components/RightPanel';
import AIPanel from './components/AIPanel';
import ExportCenter from './components/ExportCenter';
import ResultPopup from './components/ResultPopup';
import MobileApp from './components/MobileApp';
import { LAYERS } from './data';
import type { Zone, AppModal } from './types';

type Layer = (typeof LAYERS)[number];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 900);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

export default function App() {
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [rightOpen, setRightOpen]       = useState(false);
  const [aiOpen, setAiOpen]             = useState(false);
  const [compareOpen, setCompareOpen]   = useState(false);
  const [modal, setModal]               = useState<AppModal>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [layers, setLayers]             = useState<Layer[]>(LAYERS);
  const [model, setModel]               = useState('Groundwater Recharge Potential v2.1');
  const [basemap, setBasemap]           = useState('dark');
  const [coord, setCoord]               = useState('26.53180°N  88.72140°E');

  if (isMobile) return <MobileApp />;

  const handleZoneClick = (z: Zone) => {
    setSelectedZone(z);
    setRightOpen(true);
  };

  const handleLayerEvidence = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: true } : l));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#080d18' }}>
      {/* Navbar */}
      <Navbar
        sidebarOpen={sidebarOpen}  onSidebar={() => setSidebarOpen(v => !v)}
        rightOpen={rightOpen}      onRight={() => setRightOpen(v => !v)}
        aiOpen={aiOpen}            onAI={() => setAiOpen(v => !v)}
        compareOpen={compareOpen}  onCompare={() => setCompareOpen(v => !v)}
        onExport={() => setModal('export')}
        model={model}              onModel={setModel}
        coord={coord}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <Sidebar
          open={sidebarOpen}
          layers={layers}
          setLayers={ls => setLayers(ls)}
          onLayerEvidence={handleLayerEvidence}
          basemap={basemap}
          onBasemap={setBasemap}
        />

        {/* Map + popup */}
        <div className="relative flex-1 overflow-hidden">
          <MapCanvas
            selectedZone={selectedZone}
            onZoneClick={handleZoneClick}
            compareMode={compareOpen}
            onCompare={() => setCompareOpen(v => !v)}
            basemap={basemap}
          />

          {/* Result popup (shown when zone selected but right panel not open) */}
          {selectedZone && !rightOpen && (
            <ResultPopup
              zone={selectedZone}
              onClose={() => setSelectedZone(null)}
              onDetails={() => setRightOpen(true)}
              onAsk={() => { setAiOpen(true); }}
              onWhy={() => { setRightOpen(true); }}
            />
          )}

          {/* Compare controls overlay */}
          {compareOpen && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: '#0c1424', border: '1px solid rgba(0,180,216,0.3)' }}>
              <span className="text-xs" style={{ color: '#647d9a' }}>Layer A:</span>
              <select className="text-xs" style={{ width: 100 }}>
                <option>Slope</option><option>Elevation</option><option>TWI</option><option>NDVI</option>
              </select>
              <span className="text-xs" style={{ color: '#374f6a' }}>vs.</span>
              <select className="text-xs" style={{ width: 100 }}>
                <option>Elevation</option><option>Slope</option><option>Rainfall</option><option>LULC</option>
              </select>
              <span className="text-[10px] px-1.5 py-px rounded"
                style={{ background: 'rgba(0,180,216,0.1)', color: '#00b4d8', fontFamily: 'var(--font-mono)', border: '1px solid rgba(0,180,216,0.25)' }}>
                DRAG ◁▷
              </span>
              <button onClick={() => setCompareOpen(false)} className="text-xs px-2 py-0.5 rounded"
                style={{ color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                Exit
              </button>
            </div>
          )}
        </div>

        {/* Right analysis panel */}
        {rightOpen && (
          <RightPanel
            zone={selectedZone}
            onLayerEvidence={handleLayerEvidence}
          />
        )}

        {/* AI assistant panel */}
        {aiOpen && (
          <AIPanel
            zone={selectedZone}
            onClose={() => setAiOpen(false)}
            onLayerEvidence={handleLayerEvidence}
          />
        )}
      </div>

      {/* Modals */}
      {modal === 'export' && <ExportCenter onClose={() => setModal(null)} />}
    </div>
  );
}
