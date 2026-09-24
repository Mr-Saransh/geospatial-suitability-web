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

  // Layers state — default to the new canonical available-evidence classified product
  const [layers, setLayers]             = useState<Layer[]>(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('flood_11_factor_v1_available_evidence_suitability_classified');

  // Inspection state
  const [selectedZone, setSelectedZone] = useState<Zone | null>(INITIAL_ZONE);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // Map state
  const [basemap, setBasemap]           = useState('dark');
  const [coord, setCoord]               = useState('31.86450°N  76.79200°E');
  const [centerTarget, setCenterTarget] = useState<{ lat: number; lng: number } | null>(null);

  // Theme state
  const [theme, setTheme]               = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── 1. Fetch backend models, layers, stats, and metadata on load ─────────────────
  const loadBackend = useCallback(async () => {
    try {
      // Fetch models
      const modelsRes = await api.getModels().catch(() => []);
      if (modelsRes.length > 0) {
        setModels(modelsRes);
        setActiveModelId(modelsRes[0].model_id);
        setActiveModelName(modelsRes[0].name);
      }

      // Fetch model details
      const detailRes = await api.getModel(activeModelId).catch(() => null);
      if (detailRes) {
        setModelDetail(detailRes);
      }

      // Fetch statistics
      const statsRes = await api.getStatistics(activeModelId).catch(() => null);
      if (statsRes) {
        setStatistics(statsRes);
      }

      // Fetch real canonical layers
      const layersRes = await api.getLayers().catch(() => []);
      if (layersRes.length > 0) {
        const mappedLayers: Layer[] = layersRes.map((l: LayerInfo) => {
          const isResult = l.type === 'RESULT' || l.layer_type === 'result_raster';
          const isQuality = l.type === 'QUALITY' || l.layer_type === 'quality_mask';
          const critKey = l.criterion_id || '';
          const critMeta = CRITERIA_INFO[critKey];

          let group: Layer['group'] = 'composite';
          let groupLabel = 'Analysis Results';
          if (isQuality) {
            group = 'quality';
            groupLabel = 'Quality & Coverage';
          } else if (!isResult) {
            if (l.category.toLowerCase().includes('hydro')) {
              group = 'hydrological';
              groupLabel = 'Hydrological Criteria';
            } else if (l.category.toLowerCase().includes('topo')) {
              group = 'topographic';
              groupLabel = 'Topographic Criteria';
            } else if (l.category.toLowerCase().includes('environ')) {
              group = 'environmental';
              groupLabel = 'Environmental Criteria';
            } else if (critMeta) {
              group = critMeta.group;
              groupLabel = critMeta.groupLabel;
            }
          }

          const isDefaultVisible = l.product_id === 'flood_11_factor_v1_available_evidence_suitability_classified';

          return {
            id: l.product_id,
            name: l.display_name, // Guaranteed unique semantic name from backend!
            layer_name: l.product_id,
            layerType: l.type,
            criterion_id: l.criterion_id,
            group,
            groupLabel,
            visible: isDefaultVisible,
            opacity: isResult ? 85 : 75,
            unit: l.unit || critMeta?.unit || '',
            source: l.description || critMeta?.source || 'Himachal Spatial Knowledge Package (Run #56)',
            resolution: l.resolution || '30 m',
            date: '2026-09',
            description: l.description || critMeta?.description || '',
            scoring_mode: l.scoring_mode,
          };
        });

        setLayers(mappedLayers);
      }

      // Run initial point inspection at a valid sample point (31.8645, 76.7920)
      const ptRes = await api.inspectPoint(activeModelId, 31.8645, 76.7920).catch(() => null);
      if (ptRes) {
        handlePointInspectionResult(ptRes, 31.8645, 76.7920);
      }
    } catch (err) {
      console.warn('Backend loading note (fallback in use):', err);
    }
  }, [activeModelId]);

  useEffect(() => {
    loadBackend();
  }, [loadBackend]);

  // Transform backend point inspection response to Zone structure
  const handlePointInspectionResult = (pt: PointInspectionResponse, lat: number, lon: number) => {
    const rawScore = pt.continuous_score ?? 1.78;
    const classifiedVal = pt.classified_value ?? (pt.class_label === 'Very High' ? 5 : pt.class_label === 'High' ? 4 : pt.class_label === 'Moderate' ? 3 : pt.class_label === 'Low' ? 2 : 1);
    const cls = classValueToSuitClass(classifiedVal);

    const criteriaRows: CriterionRow[] = (pt.criteria || []).map(c => {
      const critMeta = CRITERIA_INFO[c.criterion];
      const isLimiting = (c.rating !== null && c.rating >= 4) || (c.contribution !== null && c.contribution > 0.3);
      return {
        name: c.display_name || critMeta?.label || c.criterion.replace(/_/g, ' '),
        criterionId: c.criterion,
        weight: c.weight,
        rawScore: c.raw_value,
        rating: c.rating,
        contribution: c.contribution,
        unit: c.unit || critMeta?.unit || '',
        cls: isLimiting ? 'limiting' : 'positive',
        layerId: c.criterion,
        source: c.source || critMeta?.source || 'Canonical Package (Run #56)',
        evidence: c.status === 'NODATA'
          ? (c.nodata_reason || 'Factor missing in mask — dynamic Available-Evidence mode applied')
          : (critMeta?.evidence || `Sampled value: ${c.raw_value}`),
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
      evidenceCount: pt.evidence_count,
      evidenceTotal: pt.evidence_total,
      missingCriteria: pt.missing_criteria,
      scoringMode: pt.scoring_mode ?? undefined,
      strictScore: pt.strict_score,
      availableEvidenceScore: pt.available_evidence_score,
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
      // Fallback
      setSelectedZone({
        id: `pt-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        label: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`,
        cls: 'very-low',
        score: 1.78,
        classifiedValue: 1,
        lat,
        lng: lon,
        district: 'Himachal Pradesh',
        region: 'Himalayan Basin',
        area: 44.3,
        finalStatus: 'OUTSIDE_ANALYSIS_AREA',
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
          onRefresh={loadBackend}
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

          {/* Quick Floating inspection result chip if right panel closed */}
          {selectedZone && !rightOpen && (
            <ResultPopup
              zone={selectedZone}
              onOpenDetails={() => setRightOpen(true)}
              onDismiss={() => setSelectedZone(null)}
              loading={loadingInspection}
            />
          )}

          {/* Map floating controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 pointer-events-auto">
            <div className="px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-2"
              style={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              <span className="w-2 h-2 rounded-full bg-[#00b4d8] animate-pulse" />
              <span>{activeLayer ? activeLayer.name : 'No Layer Active'}</span>
              <span className="opacity-40">|</span>
              <span className="text-[10px] opacity-75">{coord}</span>
            </div>
          </div>
        </div>

        {/* Right side analytical inspector */}
        {rightOpen && (
          <RightPanel
            zone={selectedZone}
            onLayerEvidence={handleLayerEvidence}
            statistics={statistics}
            modelDetail={modelDetail}
            onClose={() => setRightOpen(false)}
          />
        )}

        {/* AI copilot floating panel */}
        {aiOpen && (
          <AIPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            zone={selectedZone}
            activeLayer={activeLayer}
            onSelectLayer={handleSelectLayer}
            onLayerEvidence={handleLayerEvidence}
          />
        )}
      </div>

      {/* Export modal dialog */}
      {modal === 'export' && (
        <ExportCenter
          onClose={() => setModal(null)}
          zone={selectedZone}
          layers={layers}
          activeLayer={activeLayer}
        />
      )}
    </div>
  );
}
