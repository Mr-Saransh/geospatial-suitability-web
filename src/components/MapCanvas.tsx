import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Zone, Layer } from '../types';
import { SUIT_META } from '../data';
import { api } from '../lib/api/client';
import {
  IconZoomIn, IconZoomOut, IconLocate, IconMaximize,
  IconMeasure, IconBookmark, IconCompare, IconPrint, IconGlobe
} from '../icons';

interface Props {
  selectedZone: Zone | null;
  onPointClick: (lat: number, lon: number) => void;
  activeLayer: Layer | null;
  compareMode: boolean;
  onCompare: () => void;
  basemap: string;
  onCoordChange?: (coordStr: string) => void;
  centerTarget?: { lat: number; lng: number } | null;
  theme?: 'dark' | 'light';
}

// Custom neon pin icon for selected inspection point
const createInspectorIcon = (color: string = '#00b4d8') => {
  return L.divIcon({
    className: 'custom-inspector-marker',
    html: `
      <div style="position: relative; width: 24px; height: 24px; transform: translate(-12px, -12px);">
        <div style="position: absolute; inset: 0; border-radius: 50%; background: ${color}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; inset: 4px; border-radius: 50%; background: #0c1424; border: 2px solid ${color}; display: flex; items-center; justify-content: center;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></div>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const BASEMAP_URLS: Record<string, { url: string; referenceUrl?: string; attribution: string }> = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    referenceUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; HERE, Garmin, DeLorme, MapmyIndia',
  },
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    referenceUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; HERE, Garmin, DeLorme, MapmyIndia',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; Maxar, Earthstar Geographics',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap &copy; OpenStreetMap contributors',
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

// Render official state boundary outline
function StateBoundaryLayer({ data }: { data: any }) {
  const map = useMap();
  useEffect(() => {
    if (!data || !map) return;
    try {
      const layer = L.geoJSON(data, {
        style: {
          color: '#00b4d8',
          weight: 1.8,
          dashArray: '5, 4',
          fillColor: 'transparent',
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

// Map controller component to handle map events and imperative controls
function MapEventsHandler({
  onMouseMove,
  onMapClick,
  centerTarget,
}: {
  onMouseMove: (lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  centerTarget?: { lat: number; lng: number } | null;
}) {
  const map = useMapEvents({
    mousemove(e) {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
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
function MapZoomController({ action, onComplete }: { action: 'in' | 'out' | 'reset' | null; onComplete: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (action === 'in') {
      map.zoomIn();
      onComplete();
    } else if (action === 'out') {
      map.zoomOut();
      onComplete();
    } else if (action === 'reset') {
      map.flyTo([31.8, 77.2], 8, { duration: 1 });
      onComplete();
    }
  }, [action, map, onComplete]);
  return null;
}

export default function MapCanvas({
  selectedZone,
  onPointClick,
  activeLayer,
  compareMode,
  onCompare,
  basemap,
  onCoordChange,
  centerTarget,
  theme = 'dark',
}: Props) {
  const [zoom, setZoom] = useState(8);
  const [coord, setCoord] = useState({ lat: 31.1048, lng: 77.1734 });
  const [zoomAction, setZoomAction] = useState<'in' | 'out' | 'reset' | null>(null);
  const [comparePos, setComparePos] = useState(50);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const effectiveBasemap = (theme === 'light' && basemap === 'dark') ? 'light' : basemap;
  const bm = BASEMAP_URLS[effectiveBasemap] || BASEMAP_URLS.dark;

  const [boundaryGeoJson, setBoundaryGeoJson] = useState<any>(null);

  useEffect(() => {
    api.getBoundary()
      .then(data => {
        if (data && data.features && data.features.length > 0) {
          setBoundaryGeoJson(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleMouseMove = useCallback((lat: number, lng: number) => {
    setCoord({ lat, lng });
    const formatted = `${lat.toFixed(5)}°N  ${lng.toFixed(5)}°E`;
    if (onCoordChange) {
      onCoordChange(formatted);
    }
  }, [onCoordChange]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCoord({ lat, lng });
    onPointClick(lat, lng);
  }, [onPointClick]);

  // Construct tile URL for the active raster layer using centralized API client
  const tileUrl = activeLayer && activeLayer.visible
    ? api.getTileUrlTemplate(activeLayer.id)
    : null;

  const activeColor = selectedZone ? SUIT_META[selectedZone.cls]?.color || '#00b4d8' : '#00b4d8';

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={mapContainerRef} className="relative w-full h-full overflow-hidden select-none" style={{ background: '#080d18' }}>
      {/* Real Leaflet Map */}
      <MapContainer
        center={[31.8, 77.2]}
        zoom={8}
        minZoom={5}
        maxZoom={14}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
        style={{ background: '#080d18' }}
      >
        <MapEventsHandler
          onMouseMove={handleMouseMove}
          onMapClick={handleMapClick}
          centerTarget={centerTarget}
        />
        <MapZoomController action={zoomAction} onComplete={() => setZoomAction(null)} />

        {/* Base Map Tile Layer */}
        <TileLayer
          url={bm.url}
          attribution={bm.attribution}
          opacity={0.85}
        />

        {/* Real Backend Raster Layer Tiles */}
        {tileUrl && activeLayer && (
          <TileLayer
            key={`${activeLayer.id}-${activeLayer.opacity}`}
            url={tileUrl}
            opacity={(activeLayer.opacity ?? 85) / 100}
            zIndex={10}
            minZoom={5}
            maxZoom={16}
            tileSize={256}
            updateWhenZooming={false}
            updateWhenIdle={false}
            keepBuffer={4}
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

        {/* Inspector Pin Marker */}
        {selectedZone && (
          <Marker
            position={[selectedZone.lat, selectedZone.lng]}
            icon={createInspectorIcon(activeColor)}
          >
            <Popup className="mcgse-leaflet-popup">
              <div style={{ background: '#0c1424', color: '#c4d4e8', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid #1c2e48' }}>
                <div style={{ fontWeight: 600, color: activeColor }}>
                  {selectedZone.district || 'Inspected Point'}
                </div>
                <div style={{ color: '#c4d4e8', fontSize: '10px' }}>
                  Susceptibility Score: <strong style={{ color: activeColor }}>{selectedZone.score.toFixed(3)}</strong>
                </div>
                <div style={{ color: '#647d9a', fontSize: '10px' }}>
                  Class: {selectedZone.classifiedValue ? `Class ${selectedZone.classifiedValue} — ` : ''}{SUIT_META[selectedZone.cls]?.label}
                </div>
                <div style={{ color: '#00b4d8', fontSize: '9px', marginTop: '2px', fontStyle: 'italic' }}>
                  Modeled susceptibility index (not a flood prediction)
                </div>
                <div style={{ color: '#374f6a', fontSize: '9px', fontFamily: 'monospace', marginTop: '2px' }}>
                  {selectedZone.lat.toFixed(4)}°N, {selectedZone.lng.toFixed(4)}°E
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Map controls — right side */}
      <div className="absolute right-3 top-3 flex flex-col gap-1 z-[1000]">
        {[
          { Icon: IconZoomIn,   title: 'Zoom in',    onClick: () => setZoomAction('in') },
          { Icon: IconZoomOut,  title: 'Zoom out',   onClick: () => setZoomAction('out') },
          null,
          { Icon: IconLocate,   title: 'Reset to Himachal Pradesh', onClick: () => setZoomAction('reset') },
          { Icon: IconMaximize, title: 'Fullscreen', onClick: toggleFullscreen },
          null,
          { Icon: IconMeasure,  title: 'Measure distance / area' },
          { Icon: IconBookmark, title: 'Saved locations' },
          { Icon: IconCompare,  title: 'Compare layers', onClick: onCompare, active: compareMode },
          null,
          { Icon: IconPrint,    title: 'Print / Export raster view' },
        ].map((btn, i) =>
          btn === null
            ? <div key={i} className="h-px mx-1" style={{ background: 'var(--c-border)' }} />
            : (
              <button key={btn.title} onClick={btn.onClick} title={btn.title}
                className="w-7 h-7 flex items-center justify-center rounded transition-all backdrop-blur-sm shadow-md"
                style={{
                  background: btn.active ? 'rgba(0,180,216,0.2)' : 'var(--c-chip-bg)',
                  border: `1px solid ${btn.active ? 'rgba(0,180,216,0.5)' : 'var(--c-border)'}`,
                  color: btn.active ? '#00b4d8' : 'var(--c-text2)',
                }}>
                <btn.Icon size={13} />
              </button>
            )
        )}
      </div>

      {/* Layer legend badge */}
      <div className="absolute top-3 left-3 z-[1000]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] backdrop-blur-md shadow-lg"
          style={{ background: 'var(--c-chip-bg)', border: '1px solid var(--c-border)', fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#00c896' }} />
          <span className="font-semibold text-[#00b4d8]">Himachal Pradesh</span>
          <span style={{ color: 'var(--c-text3)' }}>·</span>
          <span style={{ color: 'var(--c-text2)' }}>
            {activeLayer ? activeLayer.name : '11-Factor Flood Susceptibility'}
          </span>
          <span style={{ color: 'var(--c-text3)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'var(--c-text3)' }}>30 m EPSG:4326</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-3 py-1.5 z-[1000] backdrop-blur-sm"
        style={{ background: 'var(--c-chip-bg)', borderTop: '1px solid var(--c-border)' }}>
        <span className="text-[10px]" style={{ color: '#00b4d8', fontFamily: 'var(--font-mono)' }}>
          {coord.lat.toFixed(5)}°N  {coord.lng.toFixed(5)}°E
        </span>
        <span className="text-[10px]" style={{ color: 'var(--c-border)' }}>|</span>
        <span className="text-[10px]" style={{ color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>
          Zoom {zoom}  ·  11 Criteria AHP Model
        </span>
        <span className="text-[10px]" style={{ color: 'var(--c-border)' }}>|</span>
        <span className="text-[10px]" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>EPSG:4326 / EPSG:32643 UTM 43N</span>
        <div className="flex-1" />
        {/* Scale bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col">
            <div className="flex items-center h-2">
              <div className="w-px h-2" style={{ background: 'var(--c-text3)' }} />
              <div className="flex-1 h-px" style={{ width: 40, background: 'var(--c-text3)' }} />
              <div className="w-px h-2" style={{ background: 'var(--c-text3)' }} />
            </div>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--c-text2)', fontFamily: 'var(--font-mono)' }}>10 km</span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
          © SRTM · CHIRPS · ESA WorldCover · HydroRIVERS
        </span>
      </div>
    </div>
  );
}
