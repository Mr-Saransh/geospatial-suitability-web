import { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MapCanvas from './components/MapCanvas';
import RightPanel from './components/RightPanel';
import AIPanel from './components/AIPanel';
import ExportCenter from './components/ExportCenter';
import ResultPopup from './components/ResultPopup';
import MobileApp from './components/MobileApp';
import {
  INITIAL_LAYERS,
  INITIAL_ZONE,
  INITIAL_CRITERIA,
  CRITERIA_INFO,
  scoreToClass,
  classValueToSuitClass,
} from './data';
import type { Zone, AppModal, Layer, CriterionRow } from './types';
import { api } from './lib/api/client';
import type { ModelSummary, ModelDetail, AnalysisStatistics, LayerInfo, PointInspectionResponse } from './lib/api/types';

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
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

  // Backend state
  const [models, setModels]             = useState<ModelSummary[]>([]);
  const [activeModelId, setActiveModelId] = useState('flood_11_factor_v1');
  const [activeModelName, setActiveModelName] = useState('11-Factor Flood Suitability AHP');
  const [modelDetail, setModelDetail]   = useState<ModelDetail | null>(null);
  const [statistics, setStatistics]     = useState<AnalysisStatistics | null>(null);

  // Layers state
  const [layers, setLayers]             = useState<Layer[]>(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('result_raster:flood_11_factor_v1_full_suitability_classified');

  // Inspection state
  const [selectedZone, setSelectedZone] = useState<Zone | null>(INITIAL_ZONE);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // Map state
  const [basemap, setBasemap]           = useState('dark');
  const [coord, setCoord]               = useState('31.10480°N  77.17340°E');
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number } | null>(null);

  // Theme state
  const [theme, setTheme]               = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── 1. Fetch backend models, layers, stats, and metadata on load ─────────────────
  useEffect(() => {
    let mounted = true;

    async function loadBackend() {
      try {
        // Fetch models
        const modelsRes = await api.getModels().catch(() => []);
        if (mounted && modelsRes.length > 0) {
          setModels(modelsRes);
          setActiveModelId(modelsRes[0].model_id);
          setActiveModelName(modelsRes[0].name);
        }

        // Fetch model details
        const detailRes = await api.getModel(activeModelId).catch(() => null);
        if (mounted && detailRes) {
          setModelDetail(detailRes);
        }

        // Fetch statistics
        const statsRes = await api.getStatistics(activeModelId).catch(() => null);
        if (mounted && statsRes) {
          setStatistics(statsRes);
        }

        // Fetch real layers
        const layersRes = await api.getLayers().catch(() => []);
        if (mounted && layersRes.length > 0) {
          const mappedLayers: Layer[] = layersRes.map((l: LayerInfo) => {
            const isResult = l.layer_type === 'result_raster';
            const critKey = l.criterion_id || l.layer_name.split(':').pop() || '';
            const critMeta = CRITERIA_INFO[critKey];

            let group: Layer['group'] = 'composite';
            let groupLabel = 'Analysis Results';
            if (!isResult && critMeta) {
              group = critMeta.group;
              groupLabel = critMeta.groupLabel;
            }

            const isDefaultVisible = l.layer_name.includes('suitability_classified');

            return {
              id: l.layer_name,
              name: isResult
                ? (l.layer_name.includes('classified') ? 'Flood Suitability (Classified 1–5)' : 'Flood Suitability (Continuous 1–5)')
                : (critMeta?.label || l.layer_name.replace(/_/g, ' ')),
              layer_name: l.layer_name,
              layer_type: l.layer_type,
              criterion_id: l.criterion_id,
              group,
              groupLabel,
              visible: isDefaultVisible,
              opacity: isResult ? 85 : 75,
              unit: critMeta?.unit || '',
              source: l.description || critMeta?.source || 'Himachal Spatial Knowledge Package',
              resolution: `${Math.round(l.resolution_x > 0 ? (l.resolution_x > 1 ? l.resolution_x : l.resolution_x * 111000) : 30)} m`,
              date: '2026-09',
              description: l.description || critMeta?.description || '',
            };
          });

          // Ensure classified result is at top
          mappedLayers.sort((a, b) => {
            if (a.id.includes('suitability_classified')) return -1;
            if (b.id.includes('suitability_classified')) return 1;
            return a.name.localeCompare(b.name);
          });

          setLayers(mappedLayers);
        }

        // Run initial point inspection at Shimla (31.1048, 77.1734)
        const ptRes = await api.inspectPoint(activeModelId, 31.1048, 77.1734).catch(() => null);
        if (mounted && ptRes) {
          handlePointInspectionResult(ptRes, 31.1048, 77.1734);
        }
      } catch (err) {
        console.warn('Backend loading note (fallback in use):', err);
      }
    }

    loadBackend();
    return () => { mounted = false; };
  }, [activeModelId]);

  // Transform backend point inspection response to Zone structure
  const handlePointInspectionResult = (pt: PointInspectionResponse, lat: number, lon: number) => {
    const rawScore = pt.continuous_score ?? 1.84;
    const classifiedVal = pt.classified_value ?? (pt.class_label === 'Very High' ? 5 : pt.class_label === 'High' ? 4 : pt.class_label === 'Moderate' ? 3 : pt.class_label === 'Low' ? 2 : 1);
    const cls = classValueToSuitClass(classifiedVal);

    const criteriaRows: CriterionRow[] = (pt.criteria || []).map(c => {
      const critMeta = CRITERIA_INFO[c.criterion];
      const isLimiting = (c.rating !== null && c.rating >= 4) || (c.contribution !== null && c.contribution > 0.3);
      return {
        name: critMeta?.label || c.criterion.replace(/_/g, ' '),
        criterionId: c.criterion,
        weight: c.weight,
        rawScore: c.raw_value,
        rating: c.rating,
        contribution: c.contribution,
        unit: critMeta?.unit || c.unit || '',
        cls: isLimiting ? 'limiting' : 'positive',
        layerId: `factor_raster:${c.criterion}`,
        source: c.source || critMeta?.source || 'Spatial Knowledge Package',
        evidence: critMeta?.evidence || (c.nodata_reason ? `NoData: ${c.nodata_reason}` : `Sampled value: ${c.raw_value}`),
        status: c.status,
      };
    });

    const newZone: Zone = {
      id: `pt-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      label: `Coord (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
      cls,
      score: rawScore,
      classifiedValue: classifiedVal,
      lat,
      lng: lon,
      district: 'Himachal Pradesh',
      region: 'Himalayan Basin',
      area: 44.3,
      finalStatus: pt.final_status,
      criteria: criteriaRows.length > 0 ? criteriaRows : INITIAL_CRITERIA,
    };

    setSelectedZone(newZone);
  };

  // ── 2. Handle map point click (Live Backend Inspection) ──────────────────────
  const handlePointClick = useCallback(async (lat: number, lon: number) => {
    setLoadingInspection(true);
    try {
      const pt = await api.inspectPoint(activeModelId, lat, lon);
      handlePointInspectionResult(pt, lat, lon);
      // Auto open right panel on inspection
      setRightOpen(true);
    } catch (err) {
      console.error('Point inspection failed:', err);
      // Fallback local estimation
      setSelectedZone({
        id: `pt-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        label: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`,
        cls: 'low',
        score: 1.84,
        classifiedValue: 2,
        lat,
        lng: lon,
        district: 'Himachal Pradesh',
        region: 'Himalayan Basin',
        area: 44.3,
        finalStatus: 'VALID',
        criteria: INITIAL_CRITERIA,
      });
      setRightOpen(true);
    } finally {
      setLoadingInspection(false);
    }
  }, [activeModelId]);

  // ── 3. Handle layer selection for map rendering ──────────────────────────────
  const handleSelectLayer = (id: string) => {
    setActiveLayerId(id);
    setLayers(prev => prev.map(l => ({
      ...l,
      visible: l.id === id,
    })));
  };

  const handleLayerEvidence = (id: string) => {
    setActiveLayerId(id);
    setLayers(prev => prev.map(l => ({
      ...l,
      visible: l.id === id ? true : false,
    })));
  };

  const handleModelChange = (modelName: string) => {
    setActiveModelName(modelName);
    const found = models.find(m => m.name === modelName);
    if (found) {
      setActiveModelId(found.model_id);
    }
  };

  const handleLocationFly = (loc: { lat: number; lng: number }) => {
    setCenterTarget({ lat: loc.lat, lng: loc.lng });
    handlePointClick(loc.lat, loc.lng);
  };

  const activeLayer = layers.find(l => l.id === activeLayerId) || layers.find(l => l.visible) || null;

  if (isMobile) return <MobileApp />;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--c-base)' }}>
      {/* Navbar */}
      <Navbar
        sidebarOpen={sidebarOpen}  onSidebar={() => setSidebarOpen(v => !v)}
        rightOpen={rightOpen}      onRight={() => setRightOpen(v => !v)}
        aiOpen={aiOpen}            onAI={() => setAiOpen(v => !v)}
        compareOpen={compareOpen}  onCompare={() => setCompareOpen(v => !v)}
        onExport={() => setModal('export')}
        model={activeModelName}    onModel={handleModelChange}
        modelsList={models}
        coord={coord}
        onSearchLocation={handleLocationFly}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left sidebar */}
        <Sidebar
          open={sidebarOpen}
          layers={layers}
          setLayers={setLayers}
          activeLayerId={activeLayerId}
          onSelectLayer={handleSelectLayer}
          onLayerEvidence={handleLayerEvidence}
          basemap={basemap}
          onBasemap={setBasemap}
          onSelectLocation={handleLocationFly}
          modelName={activeModelName}
        />

        {/* Map + popup */}
        <div className="relative flex-1 overflow-hidden">
          <MapCanvas
            selectedZone={selectedZone}
            onPointClick={handlePointClick}
            activeLayer={activeLayer}
            compareMode={compareOpen}
            onCompare={() => setCompareOpen(v => !v)}
            basemap={basemap}
            onCoordChange={setCoord}
            centerTarget={centerTarget}
            theme={theme}
          />

          {/* Result popup (shown when point selected but right panel not open) */}
          {selectedZone && !rightOpen && (
            <ResultPopup
              zone={selectedZone}
              onClose={() => setSelectedZone(null)}
              onDetails={() => setRightOpen(true)}
              onAsk={() => setAiOpen(true)}
              onWhy={() => setRightOpen(true)}
            />
          )}

          {/* Loading Inspection Indicator */}
          {loadingInspection && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg flex items-center gap-2"
              style={{ background: 'var(--c-surface)', border: '1px solid #00b4d8', color: '#00b4d8', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <div className="w-2 h-2 rounded-full bg-[#00b4d8] animate-ping" />
              Sampling 24 Spatial Rasters…
            </div>
          )}

          {/* Compare controls overlay */}
          {compareOpen && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <span className="text-xs" style={{ color: 'var(--c-text3)' }}>Layer A:</span>
              <select
                className="text-xs"
                style={{ width: 120 }}
                onChange={e => handleSelectLayer(e.target.value)}
              >
                <option value="factor_raster:slope">Slope</option>
                <option value="factor_raster:rainfall">Rainfall</option>
                <option value="factor_raster:twi">TWI</option>
                <option value="factor_raster:elevation">Elevation</option>
              </select>
              <span className="text-xs" style={{ color: 'var(--c-text3)' }}>vs.</span>
              <select
                className="text-xs"
                style={{ width: 140 }}
                onChange={e => handleSelectLayer(e.target.value)}
              >
                <option value="result_raster:flood_11_factor_v1_full_suitability_classified">Flood Suitability</option>
                <option value="factor_raster:distance_to_rivers">Distance to Rivers</option>
                <option value="factor_raster:flow_accumulation">Flow Accumulation</option>
              </select>
              <span className="text-[10px] px-1.5 py-px rounded"
                style={{ background: 'rgba(0,180,216,0.1)', color: '#00b4d8', fontFamily: 'var(--font-mono)', border: '1px solid rgba(0,180,216,0.25)' }}>
                DUAL TILE VIEW
              </span>
              <button onClick={() => setCompareOpen(false)} className="text-xs px-2 py-0.5 rounded hover:bg-[#f9731622]"
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
            statistics={statistics}
            modelDetail={modelDetail}
            onClose={() => setRightOpen(false)}
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
