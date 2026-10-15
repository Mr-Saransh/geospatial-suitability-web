import { useState, useCallback, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Zone, Layer } from "../types";
import { SUIT_META } from "../data";
import { api } from "../lib/api/client";
import {
  IconZoomIn,
  IconZoomOut,
  IconLocate,
  IconMaximize,
  IconLayers,
  IconBookmark,
  IconPrint,
} from "../icons";

interface Props {
  selectedZone: Zone | null;
  selectedMapCoordinate?: { lat: number; lon: number } | null;
  onPointClick: (lat: number, lon: number) => void;
  activeLayer: Layer | null;
  compareMode: boolean;
  onCompare: () => void;
  layersOpen?: boolean;
  onToggleLayers?: () => void;
  basemap: string;
  onCoordChange?: (coordStr: string) => void;
  centerTarget?: { lat: number; lng: number } | null;
  theme?: "dark" | "light";
  activeModelId?: string;
  activeModelName?: string;
}

// Custom neon pin icon for selected inspection point
const createInspectorIcon = (color: string = "#88B59A") => {
  return L.divIcon({
    className: "custom-inspector-marker",
    html: `
      <div style="position: relative; width: 24px; height: 24px; transform: translate(-12px, -12px);">
        <div style="position: absolute; inset: 0; border-radius: 50%; background: ${color}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; inset: 4px; border-radius: 50%; background: #19231F; border: 2px solid ${color}; display: flex; items-center; justify-content: center;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></div>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const BASEMAP_URLS: Record<
  string,
  {
    url: string;
    referenceUrl?: string;
    attribution: string;
  }
> = {
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    referenceUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &copy; HERE, Garmin, DeLorme, MapmyIndia",
  },
  light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    referenceUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &copy; HERE, Garmin, DeLorme, MapmyIndia",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &copy; Maxar, Earthstar Geographics",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap &copy; OpenStreetMap contributors",
  },
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
};

// Render official state boundary outline
function StateBoundaryLayer({ data }: { data: GeoJSON.GeoJsonObject }) {
  const map = useMap();
  useEffect(() => {
    if (!data || !map) return;
    try {
      const layer = L.geoJSON(data, {
        style: {
          color: "#88B59A",
          weight: 1.8,
          dashArray: "5, 4",
          fillColor: "transparent",
          fillOpacity: 0,
        },
      }).addTo(map);
      return () => {
        map.removeLayer(layer);
      };
    } catch {
      // ignore
    }
  }, [data, map]);
  return null;
}

// Custom Authenticated Tile Layer that fetches tiles via fetch() with ngrok-skip-browser-warning
// Standard <img> elements cannot send custom headers, causing ngrok free tier to return HTML error pages instead of PNG raster tiles.
const AuthenticatedTileLayer = L.TileLayer.extend({
  createTile(coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement("img");
    tile.alt = "";
    tile.setAttribute("role", "presentation");

    const url = (this as unknown as { getTileUrl: (coords: L.Coords) => string }).getTileUrl(coords);
    const controller = new AbortController();
    (tile as unknown as { _abortController: AbortController })._abortController = controller;

    fetch(url, {
      signal: controller.signal,
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Tile fetch failed: ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        const objectUrl = URL.createObjectURL(blob);
        (tile as unknown as { _objectUrl: string })._objectUrl = objectUrl;
        tile.onload = () => {
          done(undefined, tile);
        };
        tile.onerror = () => {
          done(new Error("Image decode error"), tile);
        };
        tile.src = objectUrl;
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          done(err, tile);
        }
      });

    return tile;
  },

  _abortLoading() {
    const tiles = (this as unknown as { _tiles?: Record<string, { el?: HTMLElement }> })._tiles;
    if (tiles) {
      for (const key of Object.keys(tiles)) {
        const tile = tiles[key];
        const el = tile?.el as unknown as { _objectUrl?: string; _abortController?: AbortController } | undefined;
        if (el) {
          if (el._abortController) {
            el._abortController.abort();
            el._abortController = undefined;
          }
          if (el._objectUrl) {
            URL.revokeObjectURL(el._objectUrl);
            el._objectUrl = undefined;
          }
        }
      }
    }
    return (L.TileLayer.prototype as unknown as { _abortLoading?: () => void })._abortLoading?.call(this);
  },

  _removeTile(key: string) {
    const tiles = (this as unknown as { _tiles?: Record<string, { el?: HTMLElement }> })._tiles;
    const tile = tiles?.[key];
    if (tile?.el) {
      const t = tile.el as unknown as { _objectUrl?: string; _abortController?: AbortController };
      if (t._abortController) {
        t._abortController.abort();
        t._abortController = undefined;
      }
      if (t._objectUrl) {
        URL.revokeObjectURL(t._objectUrl);
        t._objectUrl = undefined;
      }
    }
    return (L.TileLayer.prototype as unknown as { _removeTile: (key: string) => void })._removeTile.call(
      this,
      key,
    );
  },
});

function RasterTileLayer({
  url,
  opacity,
  zIndex = 10,
}: {
  url: string;
  opacity: number;
  zIndex?: number;
}) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!map || !url) return;

    const layer = new (AuthenticatedTileLayer as unknown as new (
      urlTemplate: string,
      options: L.TileLayerOptions,
    ) => L.TileLayer)(url, {
      opacity,
      zIndex,
      minZoom: 5,
      maxZoom: 16,
      tileSize: 256,
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [map, url, zIndex]);

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
}

// Map controller component to handle map events and imperative controls
function MapEventsHandler({
  onMouseMove,
  onMapClick,
  centerTarget,
  onZoomChange,
}: {
  onMouseMove: (lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  centerTarget?: { lat: number; lng: number } | null;
  onZoomChange?: (zoom: number) => void;
}) {
  const map = useMapEvents({
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    zoomend(e) {
      onZoomChange?.(e.target.getZoom());
    },
  });

  useEffect(() => {
    if (centerTarget) {
      map.flyTo([centerTarget.lat, centerTarget.lng], 10, { duration: 1.2 });
    }
  }, [centerTarget, map]);

  return null;
}

// Controller for custom zoom buttons
function MapZoomController({
  action,
  onComplete,
}: {
  action: "in" | "out" | "reset" | null;
  onComplete: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (action === "in") {
      map.zoomIn();
      onComplete();
    } else if (action === "out") {
      map.zoomOut();
      onComplete();
    } else if (action === "reset") {
      map.flyTo([31.8, 77.2], 8, { duration: 1 });
      onComplete();
    }
  }, [action, map, onComplete]);
  return null;
}

export default function MapCanvas({
  selectedZone,
  selectedMapCoordinate,
  onPointClick,
  activeLayer,
  compareMode: _compareMode,
  onCompare: _onCompare,
  layersOpen,
  onToggleLayers,
  basemap,
  onCoordChange,
  centerTarget,
  theme = "dark",
  activeModelId,
  activeModelName,
}: Props) {
  const [zoom, setZoom] = useState(8);
  const [coord, setCoord] = useState({ lat: 31.1048, lng: 77.1734 });
  const [zoomAction, setZoomAction] = useState<"in" | "out" | "reset" | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const isLandslide =
    (activeModelId || "").toLowerCase().includes("landslide") ||
    (activeModelName || "").toLowerCase().includes("landslide");
  const hazardName = isLandslide ? "Landslide" : activeModelName || "Flood";
  const hazardLower = isLandslide ? "landslide" : activeModelName?.toLowerCase() || "flood";

  const effectiveBasemap = theme === "light" && basemap === "dark" ? "light" : basemap;
  const bm = BASEMAP_URLS[effectiveBasemap] || BASEMAP_URLS.dark;

  const [boundaryGeoJson, setBoundaryGeoJson] = useState<GeoJSON.GeoJsonObject | null>(null);

  useEffect(() => {
    api
      .getBoundary()
      .then((data) => {
        if (data && data.features && data.features.length > 0) {
          setBoundaryGeoJson(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleMouseMove = useCallback(
    (lat: number, lng: number) => {
      setCoord({ lat, lng });
      const formatted = `${lat.toFixed(5)}°N  ${lng.toFixed(5)}°E`;
      if (onCoordChange) {
        onCoordChange(formatted);
      }
    },
    [onCoordChange],
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setCoord({ lat, lng });
      onPointClick(lat, lng);
    },
    [onPointClick],
  );

  // Construct tile URL for the active raster layer using centralized API client
  const tileUrl =
    activeLayer && activeLayer.visible ? api.getTileUrlTemplate(activeLayer.id) : null;

  const activeColor = selectedZone ? SUIT_META[selectedZone.cls]?.color || "#00b4d8" : "#00b4d8";

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Marker anchor coordinate: canonical selectedMapCoordinate is the single source of truth
  const markerCoord =
    selectedMapCoordinate ||
    (selectedZone ? { lat: selectedZone.lat, lon: selectedZone.lng } : null);

  return (
    <div
      ref={mapContainerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: "#080d18" }}
    >
      {/* Real Leaflet Map */}
      <MapContainer
        center={[31.8, 77.2]}
        zoom={8}
        minZoom={5}
        maxZoom={14}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
        style={{ background: "#080d18" }}
      >
        <MapEventsHandler
          onMouseMove={handleMouseMove}
          onMapClick={handleMapClick}
          centerTarget={centerTarget}
          onZoomChange={setZoom}
        />
        <MapZoomController action={zoomAction} onComplete={() => setZoomAction(null)} />

        {/* Base Map Tile Layer */}
        <TileLayer url={bm.url} attribution={bm.attribution} opacity={0.85} />

        {/* Real Backend Raster Layer Tiles (authenticated to bypass ngrok warning) */}
        {tileUrl && activeLayer && (
          <RasterTileLayer
            key={`${activeLayer.id}`}
            url={tileUrl}
            opacity={(activeLayer.opacity ?? 85) / 100}
            zIndex={10}
          />
        )}

        {/* State Boundary Outline */}
        {boundaryGeoJson && <StateBoundaryLayer data={boundaryGeoJson} />}

        {/* Basemap Reference Labels (rendered on top of raster so district labels remain visible) */}
        {bm.referenceUrl && (
          <TileLayer
            key={`${basemap}-reference`}
            url={bm.referenceUrl}
            opacity={0.65}
            zIndex={15}
          />
        )}

        {/* ── 8. POINTER RENDERING ────────────────────────────────────────────── */}
        {/* The marker is rendered directly from selectedMapCoordinate using Leaflet's */}
        {/* standard geographic coordinate API. It remains anchored during panning/zooming, */}
        {/* layer switching (Continuous <-> Classified), and model changes. */}
        {markerCoord && (
          <Marker
            position={[markerCoord.lat, markerCoord.lon]}
            icon={createInspectorIcon(activeColor)}
          >
            {selectedZone && (
              <Popup className="mcgse-leaflet-popup">
                <div
                  style={{
                    background: "#0c1424",
                    color: "#c4d4e8",
                    padding: "7px 11px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    border: "1px solid #1c2e48",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: activeColor,
                      fontSize: "13px",
                    }}
                  >
                    {selectedZone.district || "Inspected Point"}
                  </div>
                  <div
                    style={{
                      color: "#c4d4e8",
                      fontSize: "11px",
                      marginTop: "2px",
                    }}
                  >
                    Susceptibility Score:{" "}
                    <strong style={{ color: activeColor }}>
                      {selectedZone.score !== null && selectedZone.score !== undefined
                        ? `${selectedZone.score.toFixed(2)} / 5.00`
                        : "N/A"}
                    </strong>
                  </div>
                  <div style={{ color: "#647d9a", fontSize: "11px" }}>
                    Class:{" "}
                    {selectedZone.classifiedValue
                      ? `Class ${selectedZone.classifiedValue} / 5 — `
                      : ""}
                    {SUIT_META[selectedZone.cls]?.label}
                  </div>
                  <div
                    style={{
                      color: "var(--c-accent)",
                      fontSize: "10px",
                      marginTop: "3px",
                      fontStyle: "italic",
                    }}
                  >
                    Modeled susceptibility index (not a {hazardLower} prediction)
                  </div>
                  <div
                    style={{
                      color: "#374f6a",
                      fontSize: "10px",
                      fontFamily: "monospace",
                      marginTop: "2px",
                    }}
                  >
                    {markerCoord.lat.toFixed(4)}°N, {markerCoord.lon.toFixed(4)}
                    °E
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        )}
      </MapContainer>

      {/* Map controls — right side */}
      <div className="absolute right-2 sm:right-3 top-2 sm:top-3 flex flex-col gap-1 z-[1000]">
        {[
          {
            Icon: IconZoomIn,
            title: "Zoom in",
            onClick: () => setZoomAction("in"),
            essential: true,
          },
          {
            Icon: IconZoomOut,
            title: "Zoom out",
            onClick: () => setZoomAction("out"),
            essential: true,
          },
          null,
          {
            Icon: IconLocate,
            title: "Reset to Himachal Pradesh",
            onClick: () => setZoomAction("reset"),
            essential: true,
          },
          {
            Icon: IconMaximize,
            title: "Fullscreen",
            onClick: toggleFullscreen,
            essential: true,
          },
          {
            Icon: IconLayers,
            title: "Map layers",
            onClick: onToggleLayers,
            active: layersOpen,
            essential: true,
          },
          null,
          { Icon: IconBookmark, title: "Saved locations", essential: false },
          null,
          { Icon: IconPrint, title: "Print / Export raster view", essential: false },
        ].map((btn, i) => {
          if (btn === null) {
            return (
              <div
                key={i}
                className="h-px mx-1 hidden sm:block"
                style={{ background: "var(--c-border)" }}
              />
            );
          }
          return (
            <button
              key={btn.title}
              onClick={btn.onClick}
              title={btn.title}
              className={`w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center rounded transition-all backdrop-blur-sm shadow-md ${!btn.essential ? "hidden sm:flex" : ""}`}
              style={{
                background: btn.active ? "var(--c-accent-dim)" : "var(--c-chip-bg)",
                border: `1px solid ${btn.active ? "var(--c-accent)" : "var(--c-border)"}`,
                color: btn.active ? "var(--c-accent)" : "var(--c-text2)",
              }}
            >
              <btn.Icon size={14} />
            </button>
          );
        })}
      </div>

      {/* Active Layer Pill (Top Left) */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-[1000]">
        <div
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs backdrop-blur-md shadow-md max-w-[200px] sm:max-w-none"
          style={{
            background: "var(--c-chip-bg)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text)",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#00c896] flex-shrink-0" />
          <span className="font-medium text-[var(--c-text)] truncate">
            {activeLayer ? activeLayer.name : `${hazardName} Susceptibility`}
          </span>
          <span className="text-[var(--c-text3)] hidden sm:inline">·</span>
          <span className="text-[11px] font-mono text-[var(--c-text2)] hidden sm:inline">30m</span>
        </div>
      </div>


      {/* Clean Bottom Status Bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1 z-[980] backdrop-blur-sm text-[11px] font-mono text-[var(--c-text3)]"
        style={{
          background: "var(--c-chip-bg)",
          borderTop: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[var(--c-text2)]">
            {coord.lat.toFixed(4)}°N, {coord.lng.toFixed(4)}°E
          </span>
          <span className="hidden sm:inline text-[var(--c-border2)]">|</span>
          <span className="hidden sm:inline">Zoom {zoom}</span>
        </div>

        {/* Scale bar & attribution */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5">
            <div className="flex items-center h-2">
              <div className="w-px h-2 bg-[var(--c-text3)]" />
              <div className="w-8 h-px bg-[var(--c-text3)]" />
              <div className="w-px h-2 bg-[var(--c-text3)]" />
            </div>
            <span>10 km</span>
          </div>
          <span className="text-[10px] hidden lg:inline">© OpenStreetMap · SRTM · CHIRPS</span>
        </div>
      </div>
    </div>
  );
}
