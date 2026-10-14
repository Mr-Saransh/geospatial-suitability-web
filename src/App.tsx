import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import MapCanvas from "./components/MapCanvas";
import RightPanel from "./components/RightPanel";
import AIPanel from "./components/AIPanel";
import ExportCenter from "./components/ExportCenter";
import ResultPopup from "./components/ResultPopup";
import MobileApp from "./components/MobileApp";
import {
  INITIAL_LAYERS,
  INITIAL_ZONE,
  INITIAL_CRITERIA,
  CRITERIA_INFO,
  classValueToSuitClass,
} from "./data";
import type { Zone, AppModal, Layer, CriterionRow, RightTab } from "./types";
import { api } from "./lib/api/client";
import type {
  ModelSummary,
  ModelDetail,
  AnalysisStatistics,
  LayerInfo,
  PointInspectionResponse,
  CriterionSample,
} from "./lib/api/types";
import { getCoverageInfo } from "./utils/coverage";

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

export default function App() {
  const isMobile = useIsMobile();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("overview");
  const [aiOpen, setAiOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [modal, setModal] = useState<AppModal>(null);

  // Backend state
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [activeModelId, setActiveModelId] = useState("flood_11_factor_v1");
  const [activeModelName, setActiveModelName] = useState("Flood");
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null);
  const [statistics, setStatistics] = useState<AnalysisStatistics | null>(null);

  // Layers state — default to the canonical available-evidence classified product
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState(
    "flood_11_factor_v1_available_evidence_suitability_classified",
  );

  // ── 2. SINGLE SOURCE OF TRUTH FOR MAP LOCATION ────────────────────────────────
  // There is ONE selected coordinate for the entire map (WGS84 EPSG:4326).
  // It belongs to the MAP, not to any raster layer.
  // Switching between Continuous and Classified raster layers must NEVER change this.
  const [selectedMapCoordinate, setSelectedMapCoordinate] = useState<{
    lat: number;
    lon: number;
  }>({
    lat: 31.8645,
    lon: 76.792,
  });
  const selectedMapCoordinateRef = useRef(selectedMapCoordinate);
  useEffect(() => {
    selectedMapCoordinateRef.current = selectedMapCoordinate;
  }, [selectedMapCoordinate]);

  // Inspection state
  const [selectedZone, setSelectedZone] = useState<Zone | null>(INITIAL_ZONE);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // Map state
  const [basemap, setBasemap] = useState("dark");
  const [coord, setCoord] = useState("31.86450°N  76.79200°E");
  const [centerTarget, setCenterTarget] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ── 1. Fetch backend models, layers, stats, and metadata on load ─────────────────
  // NOTE: activeLayerId is deliberately excluded from dependencies to ensure switching
  // layers NEVER reloads the backend or overwrites the user's selectedMapCoordinate!
  const loadBackend = useCallback(async () => {
    if (activeModelId === "cyclone" || activeModelId === "drought") {
      setLayers([]);
      setActiveLayerId("");
      setModelDetail(null);
      setStatistics(null);
      setSelectedZone(null);
      return;
    }
    try {
      // Fetch models
      const modelsRes = await api.getModels().catch(() => []);
      if (modelsRes.length > 0) {
        setModels(modelsRes);
        const currentValid = modelsRes.some((m) => m.model_id === activeModelId);
        if (!currentValid) {
          const defaultId = modelsRes[0].model_id;
          setActiveModelId(defaultId);
          setActiveModelName(defaultId.includes("landslide") ? "Landslide" : "Flood");
        }
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

      // Fetch real canonical layers for active model
      const layersRes = await api.getLayers(activeModelId).catch(() => []);
      if (layersRes.length > 0) {
        // Filter out internal bitmask raster from public layers
        const publicLayersRes = layersRes.filter(
          (l: LayerInfo) => !l.product_id.includes("bitmask") && !l.layer_name?.includes("bitmask"),
        );

        const defaultClassifiedId = publicLayersRes.find(
          (l) => l.type === "RESULT" && l.product_id.includes("classified"),
        )?.product_id;

        setActiveLayerId((prev) => {
          const currentActiveStillValid = publicLayersRes.some((l) => l.product_id === prev);
          return currentActiveStillValid
            ? prev
            : defaultClassifiedId || publicLayersRes[0].product_id;
        });

        const mappedLayers: Layer[] = publicLayersRes.map((l: LayerInfo) => {
          const isResult = l.type === "RESULT" || l.layer_type === "result_raster";
          const isQuality = l.type === "QUALITY" || l.layer_type === "quality_mask";
          const critKey = l.criterion_id || "";
          const critMeta = CRITERIA_INFO[critKey];

          let group: Layer["group"] = "composite";
          let groupLabel = "Analysis Results";
          if (isQuality) {
            group = "quality";
            groupLabel = "Quality & Coverage";
          } else if (isResult) {
            group = "composite";
            groupLabel = "Analysis Results";
          } else {
            const cat = (l.category || "").toLowerCase();
            if (cat.includes("hydro")) {
              group = "hydrological";
              groupLabel = "Hydrological Criteria";
            } else if (cat.includes("topo")) {
              group = "topographic";
              groupLabel = "Topographic Criteria";
            } else if (cat.includes("geo")) {
              group = "geological";
              groupLabel = "Geological Criteria";
            } else if (critMeta) {
              group = critMeta.group;
              groupLabel = critMeta.groupLabel;
            } else {
              group = "environmental";
              groupLabel = "Environmental Criteria";
            }
          }

          return {
            id: l.product_id,
            name: l.display_name,
            layer_name: l.product_id,
            layerType: l.type,
            criterion_id: l.criterion_id,
            group,
            groupLabel,
            visible: l.product_id === (defaultClassifiedId || layersRes[0].product_id),
            opacity: isResult ? 85 : 75,
            unit: l.unit || critMeta?.unit || "",
            source: l.description || critMeta?.source || "Canonical Spatial Package",
            resolution: l.resolution || "30 m",
            date: "2026-09",
            description: l.description || critMeta?.description || "",
            scoring_mode: l.scoring_mode,
          };
        });

        setLayers(mappedLayers);
      }

      // Query point inspection at currently selected canonical map coordinate
      const currentTarget = selectedMapCoordinateRef.current || {
        lat: 31.8645,
        lon: 76.792,
      };
      const ptRes = await api
        .inspectPoint(activeModelId, currentTarget.lat, currentTarget.lon)
        .catch(() => null);
      if (ptRes) {
        handlePointInspectionResult(ptRes, currentTarget.lat, currentTarget.lon);
      }
    } catch (err) {
      console.warn("Backend loading note (fallback in use):", err);
    }
  }, [activeModelId]);

  useEffect(() => {
    loadBackend();
  }, [loadBackend]);

  // Transform backend point inspection response to Zone structure
  const handlePointInspectionResult = (pt: PointInspectionResponse, lat: number, lon: number) => {
    if (import.meta.env?.DEV) {
      console.log(
        `[Canonical Map Point Sync] lat=${lat}, lon=${lon}, continuous_score=${pt.continuous_score}, classified_value=${pt.classified_value}`,
      );
    }

    const rawScore =
      pt.continuous_score !== null && pt.continuous_score !== undefined ? pt.continuous_score : 0;
    const classifiedVal =
      pt.classified_value ??
      (pt.class_label === "Very High"
        ? 5
        : pt.class_label === "High"
          ? 4
          : pt.class_label === "Moderate"
            ? 3
            : pt.class_label === "Low"
              ? 2
              : 1);
    const cls = classValueToSuitClass(classifiedVal);

    // Support both Array and Object criteria from backend
    type CriterionEntry = CriterionSample & { [key: string]: unknown };
    const rawCriteria: CriterionEntry[] = Array.isArray(pt.criteria)
      ? (pt.criteria as CriterionEntry[])
      : Object.entries((pt.criteria as Record<string, unknown>) || {}).map(([key, rawVal]) => {
          const val = (rawVal && typeof rawVal === "object" ? rawVal : {}) as Record<
            string,
            unknown
          >;
          return {
            criterion: key,
            display_name:
              (val.display_name as string) ||
              key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            raw_value: (val.raw_value as number | null) ?? null,
            rating: (val.rating as number | null) ?? null,
            weight: typeof val.weight === "number" ? val.weight : 0,
            status: (val.status as string) || "VALID",
            unit: (val.unit as string) || "",
            source: (val.source as string) || "Canonical Spatial Package",
            nodata_reason: (val.nodata_reason as string | null) ?? null,
            contribution:
              val.rating !== null && val.rating !== undefined && typeof val.weight === "number"
                ? (val.rating as number) * val.weight
                : null,
          };
        });

    const criteriaRows: CriterionRow[] = rawCriteria.map((c) => {
      const critMeta = CRITERIA_INFO[c.criterion];
      const isLimiting =
        (c.rating !== null && c.rating >= 4) || (c.contribution !== null && c.contribution > 0.3);
      return {
        name: c.display_name || critMeta?.label || c.criterion.replace(/_/g, " "),
        criterionId: c.criterion,
        weight: c.weight,
        rawScore: c.raw_value,
        rating: c.rating,
        contribution: c.contribution,
        unit: c.unit || critMeta?.unit || "",
        cls: isLimiting ? "limiting" : "positive",
        layerId: c.criterion,
        source: c.source || critMeta?.source || "Canonical Spatial Package",
        evidence:
          c.status === "NODATA"
            ? c.nodata_reason ||
              "Factor not available for this location — susceptibility calculated from valid criteria."
            : critMeta?.evidence || `Sampled value: ${c.raw_value}`,
        status: c.status,
      };
    });

    const coverage = getCoverageInfo(pt.final_status, pt.evidence_count, pt.evidence_total);

    const newZone: Zone = {
      id: `pt-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      label: `Coord (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
      cls,
      score: rawScore,
      classifiedValue: classifiedVal,
      lat,
      lng: lon,
      district: "Himachal Pradesh",
      region: "Himalayan Basin",
      area: 44.3,
      finalStatus: pt.final_status,
      coverageStatus: coverage.status,
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
  const handlePointClick = useCallback(
    async (lat: number, lon: number) => {
      // Instantly set canonical coordinate single source of truth
      setSelectedMapCoordinate({ lat, lon });
      selectedMapCoordinateRef.current = { lat, lon };

      if (activeModelId === "cyclone" || activeModelId === "drought") {
        // Placeholder model: do not make API calls or fabricate fake data
        return;
      }

      setLoadingInspection(true);
      try {
        const pt = await api.inspectPoint(activeModelId, lat, lon);
        handlePointInspectionResult(pt, lat, lon);
        // Auto open right panel on inspection overview
        setRightTab("overview");
        setRightOpen(true);
      } catch (err) {
        console.error("Point inspection failed:", err);
        // Fallback preserves clicked geographic coordinates
        setSelectedZone({
          id: `pt-${lat.toFixed(4)}-${lon.toFixed(4)}`,
          label: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
          cls: "very-low",
          score: 0,
          classifiedValue: 1,
          lat,
          lng: lon,
          district: "Himachal Pradesh",
          region: "Himalayan Basin",
          area: 44.3,
          finalStatus: "OUTSIDE_ANALYSIS_AREA",
          coverageStatus: "UNAVAILABLE",
          criteria: INITIAL_CRITERIA,
        });
        setRightTab("overview");
        setRightOpen(true);
      } finally {
        setLoadingInspection(false);
      }
    },
    [activeModelId],
  );

  // ── 3. Handle layer selection for map rendering ──────────────────────────────
  // Switching between Continuous and Classified NEVER changes selectedMapCoordinate!
  const handleSelectLayer = (id: string) => {
    setActiveLayerId(id);
    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        visible: l.id === id,
      })),
    );
  };

  const handleLayerEvidence = (id: string) => {
    setActiveLayerId(id);
    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        visible: l.id === id,
      })),
    );
  };

  const handleModelChange = (modelName: string) => {
    const lower = modelName.toLowerCase();
    if (lower.includes("cyclone")) {
      setActiveModelName("Cyclone");
      setActiveModelId("cyclone");
      setLayers([]);
      setActiveLayerId("");
      setModelDetail(null);
      setStatistics(null);
      setSelectedZone(null);
      return;
    }
    if (lower.includes("drought")) {
      setActiveModelName("Drought");
      setActiveModelId("drought");
      setLayers([]);
      setActiveLayerId("");
      setModelDetail(null);
      setStatistics(null);
      setSelectedZone(null);
      return;
    }
    if (lower.includes("landslide")) {
      setActiveModelName("Landslide");
      setActiveModelId("landslide_14_factor_v1");
      return;
    }
    // Default to Flood
    setActiveModelName("Flood");
    setActiveModelId("flood_11_factor_v1");
  };

  const handleLocationFly = (loc: { lat: number; lng: number }) => {
    setCenterTarget({ lat: loc.lat, lng: loc.lng });
    handlePointClick(loc.lat, loc.lng);
  };

  const handleToggleAnalytics = () => {
    if (!rightOpen) {
      setRightTab("statistics");
      setRightOpen(true);
    } else if (rightTab !== "statistics") {
      setRightTab("statistics");
    } else {
      setRightOpen(false);
    }
  };

  const activeLayer =
    layers.find((l) => l.id === activeLayerId) || layers.find((l) => l.visible) || null;

  if (isMobile) return <MobileApp />;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--c-base)" }}>
      {/* Navbar */}
      <Navbar
        sidebarOpen={sidebarOpen}
        onSidebar={() => setSidebarOpen((v) => !v)}
        rightOpen={rightOpen}
        onRight={handleToggleAnalytics}
        aiOpen={aiOpen}
        onAI={() => setAiOpen((v) => !v)}
        compareOpen={compareOpen}
        onCompare={() => setCompareOpen((v) => !v)}
        onExport={() => setModal("export")}
        model={activeModelName}
        onModel={handleModelChange}
        modelsList={models}
        coord={coord}
        onSearchLocation={handleLocationFly}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative z-0">
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
          onModelChange={handleModelChange}
          activeModelId={activeModelId}
          onRefresh={loadBackend}
        />

        {/* Map + popup */}
        <div className="relative flex-1 overflow-hidden">
          <MapCanvas
            selectedZone={selectedZone}
            selectedMapCoordinate={selectedMapCoordinate}
            onPointClick={handlePointClick}
            activeLayer={activeLayer}
            compareMode={compareOpen}
            onCompare={() => setCompareOpen((v) => !v)}
            basemap={basemap}
            onCoordChange={setCoord}
            centerTarget={centerTarget}
            theme={theme}
            activeModelId={activeModelId}
            activeModelName={activeModelName}
          />

          {/* Quick Floating inspection result chip if right panel closed */}
          {selectedZone && !rightOpen && (
            <ResultPopup
              zone={selectedZone}
              onClose={() => setSelectedZone(null)}
              onDetails={() => {
                setRightTab("overview");
                setRightOpen(true);
              }}
              onWhy={() => {
                setRightTab("evidence");
                setRightOpen(true);
              }}
              onAsk={() => {
                setAiOpen(true);
              }}
              loading={loadingInspection}
            />
          )}

          {/* Map floating controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 pointer-events-auto">
            <div
              className="px-3 py-1.5 rounded text-[12px] font-mono flex items-center gap-2"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
                color: "var(--c-text2)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-[#00b4d8] animate-pulse" />
              <span>{activeLayer ? activeLayer.name : "No Layer Active"}</span>
              <span className="opacity-40">|</span>
              <span className="text-[11px] opacity-75">{coord}</span>
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
            activeModelId={activeModelId}
            activeModelName={activeModelName}
            activeTab={rightTab}
            onTabChange={setRightTab}
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
            activeModelId={activeModelId}
            activeModelName={activeModelName}
          />
        )}
      </div>

      {/* Export modal dialog */}
      {modal === "export" && (
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
