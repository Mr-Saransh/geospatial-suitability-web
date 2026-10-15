import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import MapCanvas from "./components/MapCanvas";
import RightPanel from "./components/RightPanel";
import MapLayersPanel from "./components/MapLayersPanel";
import AIPanel from "./components/AIPanel";
import ExportCenter from "./components/ExportCenter";
import HelpModal from "./components/HelpModal";
import ResultPopup from "./components/ResultPopup";
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
import { IconMap, IconLayers, IconAnalyze, IconChart, IconBot } from "./icons";

function useViewport() {
  const [viewport, setViewport] = useState({
    isMobile: typeof window !== "undefined" ? window.innerWidth < 768 : false,
    isTablet:
      typeof window !== "undefined" ? window.innerWidth >= 768 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setViewport({
        isMobile: w < 768,
        isTablet: w >= 768 && w < 1024,
        isDesktop: w >= 1024,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}

export default function App() {
  const { isMobile, isTablet: _isTablet, isDesktop } = useViewport();

  // On smaller screens, start with panels closed so the map is primary
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("overview");
  const [compareOpen, setCompareOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [modal, setModal] = useState<AppModal>(null);
  const [helpSection, setHelpSection] = useState<"guide" | "data-models">("guide");

  // Auto-close overlay drawers when switching to small screens
  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  }, [isDesktop]);

  // Backend state
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [activeModelId, setActiveModelId] = useState("flood_11_factor_v1");
  const [activeModelName, setActiveModelName] = useState("Flood");
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null);
  const [statistics, setStatistics] = useState<AnalysisStatistics | null>(null);
  const [backendStatus, setBackendStatus] = useState<"connected" | "connecting" | "offline">("connecting");

  // Layers state — default to the canonical available-evidence classified product
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState(
    "flood_11_factor_v1_available_evidence_suitability_classified",
  );

  // ── SINGLE SOURCE OF TRUTH FOR MAP LOCATION ────────────────────────────────
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
  const [coordinateSelected, setCoordinateSelected] = useState<boolean>(false);
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

  // ── Fetch backend models, layers, stats, and metadata on load ─────────────────
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
      const currentTarget = selectedMapCoordinateRef.current || {
        lat: 31.8645,
        lon: 76.792,
      };

      // Fetch models, model details, statistics, layers, and point inspection in parallel for rapid fast load
      const [modelsRes, detailRes, statsRes, layersRes, ptRes] = await Promise.all([
        api.getModels().catch(() => []),
        api.getModel(activeModelId).catch(() => null),
        api.getStatistics(activeModelId).catch(() => null),
        api.getLayers(activeModelId).catch(() => []),
        api.inspectPoint(activeModelId, currentTarget.lat, currentTarget.lon).catch(() => null),
      ]);

      const isLive = modelsRes.length > 0 || !!detailRes || !!statsRes || layersRes.length > 0;
      if (isLive) {
        setBackendStatus("connected");
      } else {
        setBackendStatus("connecting");
      }

      if (modelsRes.length > 0) {
        setModels(modelsRes);
        const currentValid = modelsRes.some((m) => m.model_id === activeModelId);
        if (!currentValid) {
          const defaultId = modelsRes[0].model_id;
          setActiveModelId(defaultId);
          setActiveModelName(defaultId.includes("landslide") ? "Landslide" : "Flood");
        }
      }

      if (detailRes) {
        setModelDetail(detailRes);
      }

      if (statsRes) {
        setStatistics(statsRes);
      }

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

      if (ptRes) {
        handlePointInspectionResult(ptRes, currentTarget.lat, currentTarget.lon);
      }
    } catch (err) {
      console.warn("Backend loading note (fallback in use):", err);
      setBackendStatus("offline");
    }
  }, [activeModelId]);

  // Initial load
  useEffect(() => {
    loadBackend();
  }, [loadBackend]);

  // Smart auto-sync polling: pings health every 1.5s when disconnected so data renders immediately when backend starts
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    const poll = async () => {
      try {
        const health = await api.getHealth();
        if (health?.status === "healthy" && !isCancelled) {
          if (backendStatus !== "connected") {
            await loadBackend();
          }
        }
      } catch {
        if (!isCancelled && backendStatus === "connected") {
          setBackendStatus("offline");
        }
      }
    };

    const intervalMs = backendStatus === "connected" ? 20000 : 1500;
    timer = setInterval(poll, intervalMs);

    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [backendStatus, loadBackend]);

  // Transform backend point inspection response to Zone structure
  const handlePointInspectionResult = (pt: PointInspectionResponse, lat: number, lon: number) => {
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

  // ── Handle map point click (Live Backend Inspection) ──────────────────────
  const handlePointClick = useCallback(
    async (lat: number, lon: number) => {
      setSelectedMapCoordinate({ lat, lon });
      selectedMapCoordinateRef.current = { lat, lon };

      if (activeModelId === "cyclone" || activeModelId === "drought") {
        return;
      }

      setLoadingInspection(true);
      setCoordinateSelected(true);
      try {
        const pt = await api.inspectPoint(activeModelId, lat, lon);
        handlePointInspectionResult(pt, lat, lon);
      } catch (err) {
        console.error("Point inspection failed:", err);
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
      } finally {
        setLoadingInspection(false);
      }
    },
    [activeModelId],
  );

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
    setActiveModelName("Flood");
    setActiveModelId("flood_11_factor_v1");
  };

  const handleLocationFly = (loc: { lat: number; lng: number }) => {
    setCenterTarget({ lat: loc.lat, lng: loc.lng });
    setCoordinateSelected(true);
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

  const handleToggleAI = () => {
    setAiOpen((v) => !v);
  };

  const activeLayer =
    layers.find((l) => l.id === activeLayerId) || layers.find((l) => l.visible) || null;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--c-base)" }}>
      {/* Navbar with simplified navigation and functional search & help */}
      <Navbar
        sidebarOpen={sidebarOpen}
        onSidebar={() => setSidebarOpen((v) => !v)}
        layersOpen={layersOpen}
        onLayers={() => setLayersOpen((v) => !v)}
        layerCount={layers.filter((l) => l.visible).length}
        rightOpen={rightOpen && rightTab === "statistics"}
        onRight={handleToggleAnalytics}
        aiOpen={aiOpen}
        onAI={handleToggleAI}
        compareOpen={compareOpen}
        onCompare={() => setCompareOpen((v) => !v)}
        onExport={() => setModal("export")}
        onHelp={() => {
          setHelpSection("guide");
          setModal("help");
        }}
        model={activeModelName}
        onModel={handleModelChange}
        modelsList={models}
        coord={coord}
        onSearchLocation={handleLocationFly}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        backendStatus={backendStatus}
        onReconnect={loadBackend}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative z-0">
        {/* Left Sidebar (Desktop: Flex column, Tablet/Mobile: Slide-over Drawer) */}
        {isDesktop ? (
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
            onCollapse={() => setSidebarOpen(false)}
          />
        ) : (
          sidebarOpen && (
            <div className="fixed inset-x-0 top-12 bottom-14 z-[1250] flex pointer-events-none">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity pointer-events-auto"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="relative z-10 w-[265px] max-w-[75vw] h-full shadow-2xl flex flex-col overflow-hidden pointer-events-auto border-r border-[var(--c-border)]">
                <Sidebar
                  open={true}
                  isMobile={true}
                  layers={layers}
                  setLayers={setLayers}
                  activeLayerId={activeLayerId}
                  onSelectLayer={handleSelectLayer}
                  onLayerEvidence={handleLayerEvidence}
                  basemap={basemap}
                  onBasemap={setBasemap}
                  onSelectLocation={(loc) => {
                    handleLocationFly(loc);
                    setSidebarOpen(false);
                  }}
                  modelName={activeModelName}
                  onModelChange={handleModelChange}
                  activeModelId={activeModelId}
                  onRefresh={loadBackend}
                  onCollapse={() => setSidebarOpen(false)}
                />
              </div>
            </div>
          )
        )}

        {/* Map Canvas (Dominant centerpiece) */}
        <div className="relative flex-1 overflow-hidden">
          <MapCanvas
            selectedZone={selectedZone}
            selectedMapCoordinate={selectedMapCoordinate}
            onPointClick={handlePointClick}
            activeLayer={activeLayer}
            compareMode={compareOpen}
            onCompare={() => setCompareOpen((v) => !v)}
            layersOpen={layersOpen}
            onToggleLayers={() => setLayersOpen((v) => !v)}
            basemap={basemap}
            onCoordChange={setCoord}
            centerTarget={centerTarget}
            theme={theme}
            activeModelId={activeModelId}
            activeModelName={activeModelName}
          />

          {/* Floating Map Layers Panel */}
          <MapLayersPanel
            open={layersOpen}
            onClose={() => setLayersOpen(false)}
            layers={layers}
            setLayers={setLayers}
            activeLayerId={activeLayerId}
            onSelectLayer={handleSelectLayer}
            onLayerEvidence={handleLayerEvidence}
            modelName={activeModelName}
            isMobile={isMobile}
          />

          {/* Independent Floating AI Assistant Panel */}
          {aiOpen && (
            <AIPanel
              zone={selectedZone}
              activeLayer={activeLayer}
              onClose={() => setAiOpen(false)}
              onLayerEvidence={handleLayerEvidence}
              onSelectLayer={handleSelectLayer}
              activeModelId={activeModelId}
              activeModelName={activeModelName}
              isMobile={isMobile}
            />
          )}

          {/* Quick Floating inspection result chip if coordinate selected and right panel closed */}
          {coordinateSelected && selectedZone && !rightOpen && (
            <ResultPopup
              zone={selectedZone}
              onClose={() => {
                setCoordinateSelected(false);
                setSelectedZone(null);
              }}
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
        </div>

        {/* Unified Right-Side Workspace */}
        {/* Desktop: Inline flex panel */}
        {/* Tablet: Side-over drawer from right */}
        {/* Mobile: Bottom sheet sliding up */}
        {isDesktop
          ? rightOpen && (
              <div style={{ borderLeft: "1px solid var(--c-border)" }}>
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
                  onSelectLayer={handleSelectLayer}
                  onOpenHelp={(sec) => {
                    setHelpSection(sec || "guide");
                    setModal("help");
                  }}
                />
              </div>
            )
          : rightOpen &&
            (isMobile ? (
              /* ── Mobile Bottom Sheet (docked above bottom nav, fully scrollable) ── */
              <div className="fixed inset-x-0 top-0 bottom-14 z-[1250] flex flex-col justify-end pointer-events-none">
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity pointer-events-auto"
                  onClick={() => setRightOpen(false)}
                />
                <div
                  className="relative z-10 flex flex-col shadow-2xl bottom-sheet-enter mobile-bottom-sheet overflow-hidden pointer-events-auto"
                  style={{
                    background: "var(--c-surface)",
                    borderRadius: "16px 16px 0 0",
                    height: "75vh",
                    maxHeight: "calc(100dvh - 120px)",
                    minHeight: "45vh",
                    border: "1px solid var(--c-border)",
                    borderBottom: "none",
                  }}
                >
                  {/* Drag handle */}
                  <div className="drag-handle flex-shrink-0" />
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
                    onSelectLayer={handleSelectLayer}
                    onOpenHelp={(sec) => {
                      setHelpSection(sec || "guide");
                      setModal("help");
                    }}
                  />
                </div>
              </div>
            ) : (
              /* ── Tablet Side Drawer ── */
              <div className="fixed inset-0 z-[1250] flex justify-end">
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                  onClick={() => setRightOpen(false)}
                />
                <div className="relative z-10 w-[420px] max-w-[85vw] h-full shadow-2xl flex flex-col">
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
                    onSelectLayer={handleSelectLayer}
                    onOpenHelp={(sec) => {
                      setHelpSection(sec || "guide");
                      setModal("help");
                    }}
                  />
                </div>
              </div>
            ))}
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) — Touch Friendly */}
      {isMobile && (
        <nav
          className="mobile-bottom-nav flex-shrink-0 z-[1200] flex items-stretch h-14 border-t select-none"
          style={{
            background: "var(--c-surface)",
            borderColor: "var(--c-border)",
          }}
        >
          {[
            {
              id: "map",
              label: "Map",
              Icon: IconMap,
              active: !sidebarOpen && !rightOpen,
              onClick: () => {
                setSidebarOpen(false);
                setRightOpen(false);
              },
            },
            {
              id: "layers",
              label: "Layers",
              Icon: IconLayers,
              active: layersOpen,
              onClick: () => {
                setRightOpen(false);
                setAiOpen(false);
                setLayersOpen((v) => !v);
              },
            },
            {
              id: "location",
              label: "Location",
              Icon: IconAnalyze,
              active: rightOpen && rightTab === "overview",
              onClick: () => {
                setSidebarOpen(false);
                setLayersOpen(false);
                setAiOpen(false);
                setRightTab("overview");
                setRightOpen(true);
              },
            },
            {
              id: "summary",
              label: "Summary",
              Icon: IconChart,
              active: rightOpen && rightTab === "statistics",
              onClick: () => {
                setSidebarOpen(false);
                setLayersOpen(false);
                setAiOpen(false);
                setRightTab("statistics");
                setRightOpen(true);
              },
            },
            {
              id: "ai",
              label: "AI",
              Icon: IconBot,
              active: aiOpen,
              onClick: () => {
                setSidebarOpen(false);
                setLayersOpen(false);
                setRightOpen(false);
                setAiOpen((v) => !v);
              },
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${item.active ? "mobile-nav-active" : ""}`}
              style={{
                color: item.active ? "var(--c-accent)" : "var(--c-text3)",
                minHeight: 48,
              }}
            >
              <item.Icon size={18} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Export modal dialog */}
      {modal === "export" && (
        <ExportCenter
          onClose={() => setModal(null)}
          zone={selectedZone}
          layers={layers}
          activeLayer={activeLayer}
        />
      )}

      {/* Help modal dialog with full model details */}
      {modal === "help" && (
        <HelpModal
          onClose={() => setModal(null)}
          modelDetail={modelDetail}
          activeModelId={activeModelId}
          activeModelName={activeModelName}
          defaultSection={helpSection}
          backendStatus={backendStatus}
          onReconnect={loadBackend}
        />
      )}
    </div>
  );
}
