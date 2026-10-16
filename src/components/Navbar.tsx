import { useState, useEffect, useRef, useCallback } from "react";
import { HIMACHAL_LOCATIONS } from "../data";
import type { ModelSummary } from "../lib/api/types";
import {
  IconSearch,
  IconCompare,
  IconLayers,
  IconExport,
  IconBot,
  IconHelp,
  IconChevronD,
  IconSidebar,
  IconSun,
  IconMoon,
  IconChart,
  IconX,
  IconMenu,
} from "../icons";

interface Props {
  sidebarOpen: boolean;
  onSidebar: () => void;
  layersOpen: boolean;
  onLayers: () => void;
  layerCount?: number;
  rightOpen: boolean;
  onRight: () => void;
  aiOpen: boolean;
  onAI: () => void;
  compareOpen: boolean;
  onCompare: () => void;
  onExport: () => void;
  onHelp?: () => void;
  model: string;
  onModel: (m: string) => void;
  modelsList?: ModelSummary[];
  coord?: string;
  onSearchLocation?: (loc: { lat: number; lng: number }) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  backendStatus?: "connected" | "connecting" | "offline";
  onReconnect?: () => void;
}

interface SearchSuggestion {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  type: "coordinate" | "place" | "external";
  isOutsideHp?: boolean;
}

// Bounding box for Himachal Pradesh roughly 30.3 to 33.3 N, 75.5 to 79.1 E
function isWithinHimachal(lat: number, lng: number): boolean {
  return lat >= 30.3 && lat <= 33.3 && lng >= 75.5 && lng <= 79.1;
}

// Coordinate parser handling various formats
function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const clean = input.trim().replace(/[°NSEWnsew]/g, "");
  // Matches "31.1048, 77.1734" or "31.1048 77.1734" or "31.1048; 77.1734"
  const match = clean.match(/^(-?\d+(?:\.\d+)?)[,\s;]+(-?\d+(?:\.\d+)?)$/);
  if (match) {
    let lat = parseFloat(match[1]);
    let lng = parseFloat(match[2]);
    // If user inverted lon/lat (e.g. 77.17, 31.10), auto-correct for India coordinates
    if (lat > 65 && lat < 90 && lng > 20 && lng < 40) {
      const temp = lat;
      lat = lng;
      lng = temp;
    }
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export default function Navbar({
  sidebarOpen,
  onSidebar,
  layersOpen,
  onLayers,
  layerCount,
  rightOpen,
  onRight,
  aiOpen,
  onAI,
  compareOpen,
  onCompare,
  onExport,
  onHelp,
  model,
  onModel,
  modelsList: _modelsList,
  coord: _coord,
  onSearchLocation,
  theme,
  onToggleTheme,
  backendStatus = "connecting",
  onReconnect,
}: Props) {
  const [modelOpen, setModelOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const publicModels = ["Flood", "Landslide", "Cyclone", "Drought"] as const;

  // Search suggestions generator
  const updateSuggestions = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    const results: SearchSuggestion[] = [];

    // 1. Direct coordinate parsing
    const parsed = parseCoordinates(query);
    if (parsed) {
      const within = isWithinHimachal(parsed.lat, parsed.lng);
      results.push({
        id: `coord-${parsed.lat}-${parsed.lng}`,
        title: `${parsed.lat.toFixed(4)}°N, ${parsed.lng.toFixed(4)}°E`,
        subtitle: within
          ? "Parsed Geographic Coordinates (Active Grid)"
          : "Coordinates outside active analysis boundary",
        lat: parsed.lat,
        lng: parsed.lng,
        type: "coordinate",
        isOutsideHp: !within,
      });
    }

    // 2. Match preset focus locations
    const localMatches = HIMACHAL_LOCATIONS.filter(
      (loc) => loc.name.toLowerCase().includes(q) || loc.district.toLowerCase().includes(q),
    );

    for (const loc of localMatches) {
      results.push({
        id: `loc-${loc.name}`,
        title: loc.name,
        subtitle: `${loc.district} District · ${loc.lat.toFixed(4)}°N, ${loc.lng.toFixed(4)}°E`,
        lat: loc.lat,
        lng: loc.lng,
        type: "place",
      });
    }

    setSuggestions(results);
    setSelectedIndex(-1);
  }, []);

  // Debounced search query handler
  useEffect(() => {
    updateSuggestions(searchQuery);

    const q = searchQuery.trim();
    if (q.length >= 3 && !parseCoordinates(q)) {
      setIsSearchingExternal(true);
      const timer = setTimeout(() => {
        // Safe OpenStreetMap Nominatim query across India
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            q + " India",
          )}&limit=4`,
        )
          .then((res) => (res.ok ? res.json() : []))
          .then(
            (data: Array<{ place_id: number; display_name: string; lat: string; lon: string }>) => {
              if (Array.isArray(data) && data.length > 0) {
                setSuggestions((prev) => {
                  const existingIds = new Set(prev.map((s) => s.id));
                  const newItems: SearchSuggestion[] = [];
                  for (const item of data) {
                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    const id = `osm-${item.place_id}`;
                    if (!existingIds.has(id) && !isNaN(lat) && !isNaN(lng)) {
                      newItems.push({
                        id,
                        title: item.display_name.split(",")[0],
                        subtitle: item.display_name.split(",").slice(1, 3).join(",").trim(),
                        lat,
                        lng,
                        type: "external",
                        isOutsideHp: !isWithinHimachal(lat, lng),
                      });
                    }
                  }
                  return [...prev, ...newItems].slice(0, 6);
                });
              }
            },
          )
          .catch(() => {
            // Silently fallback to local suggestions
          })
          .finally(() => {
            setIsSearchingExternal(false);
          });
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setIsSearchingExternal(false);
    }
  }, [searchQuery, updateSuggestions]);

  // Click outside listener for search suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (s: SearchSuggestion) => {
    setSearchQuery(s.title);
    setShowSuggestions(false);
    onSearchLocation?.({ lat: s.lat, lng: s.lng });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter" && searchQuery.trim()) {
        e.preventDefault();
        const parsed = parseCoordinates(searchQuery);
        if (parsed) {
          onSearchLocation?.(parsed);
          setShowSuggestions(false);
          return;
        }
        const firstMatch = HIMACHAL_LOCATIONS.find((l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
        if (firstMatch) {
          onSearchLocation?.({ lat: firstMatch.lat, lng: firstMatch.lng });
          setShowSuggestions(false);
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        selectSuggestion(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <header
      className="flex-shrink-0 z-[1200] relative h-[52px] sm:h-14 transition-all"
      style={{
        background: "var(--c-surface)",
        borderBottom: "1px solid var(--c-border)",
      }}
    >
      <div className="flex items-center h-full px-2.5 sm:px-4 gap-2 sm:gap-3 justify-between">
        {/* Left: Brand + Sidebar toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          <button
            onClick={onSidebar}
            className="flex items-center gap-2 p-1 sm:p-1.5 rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.06)] text-[var(--c-text)] focus:outline-none"
            title="Toggle Explore Map Panel"
            aria-label="Toggle Explore Map Panel"
          >
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #88B59A 0%, #457358 100%)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <polygon
                  points="10,1 19,6 19,14 10,19 1,14 1,6"
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                />
                <circle cx="10" cy="10" r="2.5" fill="white" />
                <line x1="10" y1="3.5" x2="10" y2="7" stroke="white" strokeWidth="1.2" />
                <line x1="10" y1="13" x2="10" y2="16.5" stroke="white" strokeWidth="1.2" />
              </svg>
            </div>
            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span
                className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[var(--c-text)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                MCGSE
              </span>
              <span className="text-[11px] text-[var(--c-text3)] font-mono font-medium">Web-GIS</span>
            </div>
            <IconSidebar size={15} style={{ color: sidebarOpen ? "var(--c-accent)" : "var(--c-text3)" }} />
          </button>

          {/* Model selector dropdown */}
          <div className="relative z-[1210]">
            <button
              onClick={() => setModelOpen((v) => !v)}
              className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2 sm:px-3 rounded-lg text-xs sm:text-[13px] font-medium transition-colors hover:border-[var(--c-border2)] cursor-pointer"
              style={{
                background: "var(--c-panel)",
                border: `1px solid ${modelOpen ? "var(--c-accent)" : "var(--c-border)"}`,
                color: "var(--c-text)",
              }}
              title="Select Hazard Model"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: model === "Cyclone" || model === "Drought" ? "var(--c-sand)" : "var(--c-accent)",
                }}
              />
              <span className="font-semibold">{model}</span>
              <IconChevronD
                size={11}
                style={{
                  color: "var(--c-text2)",
                  transform: modelOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
            </button>
            {modelOpen && (
              <div
                className="absolute left-0 top-full mt-2 z-[1220] rounded-xl py-1.5 shadow-2xl min-w-[210px]"
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  className="px-3.5 py-1.5 text-[11px] uppercase tracking-wider font-semibold border-b text-[var(--c-text3)] font-mono"
                  style={{ borderColor: "var(--c-border)" }}
                >
                  Susceptibility Model
                </div>
                {publicModels.map((m) => {
                  const isSelected = m === model;
                  const isPlaceholder = m === "Cyclone" || m === "Drought";
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        onModel(m);
                        setModelOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-[13px] flex items-center justify-between gap-2.5 transition-colors hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"
                      style={{
                        color: isSelected ? "var(--c-accent)" : "var(--c-text)",
                        background: isSelected ? "var(--c-accent-dim)" : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: isSelected
                              ? "var(--c-accent)"
                              : isPlaceholder
                                ? "var(--c-text3)"
                                : "var(--c-accent)",
                          }}
                        />
                        <span className="font-medium">{m}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[12px] font-bold text-[var(--c-accent)]">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center: Search input + Map Tools beside it */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 max-w-[620px] mx-1 sm:mx-3">
          {/* Global Location Search */}
          <div className="relative flex-1 min-w-0" ref={searchContainerRef}>
            <div
              className="flex items-center gap-2 sm:gap-2.5 h-9 sm:h-10 px-2 sm:px-3 rounded-lg transition-all"
              style={{
                background: "var(--c-panel)",
                border: `1px solid ${showSuggestions && suggestions.length > 0 ? "var(--c-accent)" : "var(--c-border)"}`,
              }}
            >
              <IconSearch size={15} style={{ color: "var(--c-text3)", flexShrink: 0 }} />
              <input
                placeholder="Search place..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-xs sm:text-[13px] outline-none text-[var(--c-text)] placeholder:text-[var(--c-text3)] min-w-0"
              />
              {isSearchingExternal && (
                <span className="w-3 h-3 rounded-full border border-[var(--c-accent)] border-t-transparent animate-spin flex-shrink-0" />
              )}
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="w-5 h-5 flex items-center justify-center rounded text-[var(--c-text3)] hover:text-[var(--c-text)] transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>

            {/* Search suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 z-[1300] rounded-xl py-1.5 shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
                }}
              >
                <div className="px-3.5 py-1.5 text-[11px] uppercase font-mono tracking-wider text-[var(--c-text3)] border-b border-[var(--c-border)]">
                  Suggested Locations & Coordinates
                </div>
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    style={{
                      background: selectedIndex === idx ? "var(--c-accent-dim)" : "transparent",
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-semibold text-[var(--c-text)] truncate">
                        {s.title}
                      </span>
                      <span className="text-xs text-[var(--c-text2)] truncate">{s.subtitle}</span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-mono flex-shrink-0 font-medium"
                      style={{
                        background: s.isOutsideHp ? "rgba(239,68,68,0.15)" : "var(--c-panel)",
                        color: s.isOutsideHp ? "#ef4444" : "var(--c-text3)",
                        border: "1px solid var(--c-border)",
                      }}
                    >
                      {s.isOutsideHp ? "Outside Bounds" : s.type === "coordinate" ? "Coords" : "Location"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map Layers Action Button (Beside Search on Desktop/Tablet) */}
          <button
            onClick={onLayers}
            title="Map Layers (Toggle Floating Panel)"
            className="hidden md:flex items-center gap-2 h-9 sm:h-10 px-3 rounded-lg text-xs sm:text-[13px] font-semibold transition-all cursor-pointer flex-shrink-0"
            style={{
              background: layersOpen ? "var(--c-accent-dim)" : "var(--c-panel)",
              border: `1px solid ${layersOpen ? "var(--c-accent)" : "var(--c-border)"}`,
              color: layersOpen ? "var(--c-accent)" : "var(--c-text)",
            }}
          >
            <IconLayers size={15} style={{ color: layersOpen ? "var(--c-accent)" : "var(--c-text2)" }} />
            <span>Layers</span>
            {layerCount !== undefined && (
              <span
                className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: layersOpen ? "var(--c-accent)" : "var(--c-border2)",
                  color: layersOpen ? "var(--c-base)" : "var(--c-text2)",
                }}
              >
                {layerCount}
              </span>
            )}
          </button>

          {/* Compare Layers Action Button (Beside Search on Desktop/Tablet) */}
          <button
            onClick={onCompare}
            title="Compare Layers"
            className="hidden md:flex items-center gap-2 h-9 sm:h-10 px-3 rounded-lg text-xs sm:text-[13px] font-semibold transition-all cursor-pointer flex-shrink-0"
            style={{
              background: compareOpen ? "var(--c-accent-dim)" : "var(--c-panel)",
              border: `1px solid ${compareOpen ? "var(--c-accent)" : "var(--c-border)"}`,
              color: compareOpen ? "var(--c-accent)" : "var(--c-text2)",
            }}
          >
            <IconCompare size={15} style={{ color: compareOpen ? "var(--c-accent)" : "var(--c-text2)" }} />
            <span>Compare</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Analytics — Desktop */}
          <div className="hidden md:flex">
            <NavBtn label="Analytics" Icon={IconChart} active={rightOpen} onClick={onRight} />
          </div>

          {/* MCGSE AI — Desktop */}
          <div className="hidden md:flex">
            <NavBtn label="MCGSE AI" Icon={IconBot} active={aiOpen} onClick={onAI} />
          </div>

          {/* Secondary actions (Desktop) */}
          <div className="hidden lg:flex items-center gap-1.5">
            <NavBtn label="Export" Icon={IconExport} onClick={onExport} />
            <NavBtn label="Help" Icon={IconHelp} onClick={onHelp} />
          </div>

          {/* Theme Switcher */}
          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-9 sm:w-10 h-9 sm:h-10 flex items-center justify-center rounded-lg text-xs transition-colors hover:bg-[rgba(255,255,255,0.06)] cursor-pointer"
            style={{ color: theme === "dark" ? "#f59e0b" : "#0284c7" }}
          >
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>

          {/* Burger / Tools Menu for smaller screens (Mobile & Tablet) */}
          <div className="relative lg:hidden">
            <button
              onClick={() => setOverflowOpen((v) => !v)}
              className="w-9 sm:w-10 h-9 sm:h-10 flex items-center justify-center rounded-lg text-xs transition-all hover:bg-[rgba(255,255,255,0.06)] cursor-pointer flex-shrink-0"
              style={{
                border: `1px solid ${overflowOpen ? "var(--c-accent)" : "var(--c-border)"}`,
                background: overflowOpen ? "var(--c-accent-dim)" : "var(--c-panel)",
                color: overflowOpen ? "var(--c-accent)" : "var(--c-text2)",
              }}
              title="Navigation and tools menu"
              aria-label="Toggle navigation menu"
            >
              {overflowOpen ? <IconX size={17} /> : <IconMenu size={17} />}
            </button>
            {overflowOpen && (
              <div
                className="fixed right-2.5 sm:right-4 top-[56px] z-[1300] w-[min(290px,calc(100vw-20px))] max-h-[calc(100vh-70px)] overflow-y-auto rounded-2xl py-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                  boxShadow: "0 20px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="px-3.5 py-1.5 text-[11px] uppercase font-mono tracking-wider font-semibold border-b text-[var(--c-text3)] flex items-center justify-between"
                  style={{ borderColor: "var(--c-border)" }}
                >
                  <span>Navigation & Tools</span>
                  <button
                    onClick={() => setOverflowOpen(false)}
                    className="p-1 rounded hover:bg-[rgba(255,255,255,0.08)] text-[var(--c-text3)] hover:text-[var(--c-text)] cursor-pointer"
                    aria-label="Close menu"
                  >
                    <IconX size={13} />
                  </button>
                </div>

                {/* 1. Map Layers (Mobile) */}
                <button
                  onClick={() => {
                    onLayers();
                    setOverflowOpen(false);
                  }}
                  className="md:hidden w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors"
                  style={{
                    color: layersOpen ? "var(--c-accent)" : "var(--c-text)",
                    background: layersOpen ? "var(--c-accent-dim)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <IconLayers size={16} style={{ color: layersOpen ? "var(--c-accent)" : "var(--c-text2)" }} />
                    <span className="font-medium">Map Layers</span>
                  </div>
                  {layerCount !== undefined && (
                    <span
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: layersOpen ? "var(--c-accent)" : "var(--c-border2)",
                        color: layersOpen ? "var(--c-base)" : "var(--c-text2)",
                      }}
                    >
                      {layerCount}
                    </span>
                  )}
                </button>

                {/* 2. Compare Layers (Mobile) */}
                <button
                  onClick={() => {
                    onCompare();
                    setOverflowOpen(false);
                  }}
                  className="md:hidden w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors"
                  style={{
                    color: compareOpen ? "var(--c-accent)" : "var(--c-text)",
                    background: compareOpen ? "var(--c-accent-dim)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <IconCompare size={16} style={{ color: compareOpen ? "var(--c-accent)" : "var(--c-text2)" }} />
                    <span className="font-medium">Compare Layers</span>
                  </div>
                  {compareOpen && (
                    <span className="w-2 h-2 rounded-full bg-[var(--c-accent)]" />
                  )}
                </button>

                {/* 3. Analytics (Mobile) */}
                <button
                  onClick={() => {
                    onRight();
                    setOverflowOpen(false);
                  }}
                  className="md:hidden w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors"
                  style={{
                    color: rightOpen ? "var(--c-accent)" : "var(--c-text)",
                    background: rightOpen ? "var(--c-accent-dim)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <IconChart size={16} style={{ color: rightOpen ? "var(--c-accent)" : "var(--c-text2)" }} />
                    <span className="font-medium">Analytics & Stats</span>
                  </div>
                  {rightOpen && (
                    <span className="w-2 h-2 rounded-full bg-[var(--c-accent)]" />
                  )}
                </button>

                {/* 4. MCGSE AI (Mobile) */}
                <button
                  onClick={() => {
                    onAI();
                    setOverflowOpen(false);
                  }}
                  className="md:hidden w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors"
                  style={{
                    color: aiOpen ? "var(--c-accent)" : "var(--c-text)",
                    background: aiOpen ? "var(--c-accent-dim)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <IconBot size={16} style={{ color: aiOpen ? "var(--c-accent)" : "var(--c-text2)" }} />
                    <span className="font-medium">MCGSE AI Assistant</span>
                  </div>
                  {aiOpen && (
                    <span className="w-2 h-2 rounded-full bg-[var(--c-accent)]" />
                  )}
                </button>

                {/* Divider on mobile before secondary actions */}
                <div
                  className="md:hidden my-1.5 border-t"
                  style={{ borderColor: "var(--c-border)" }}
                />

                {/* 5. Export Data */}
                <button
                  onClick={() => {
                    onExport();
                    setOverflowOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors text-[var(--c-text)]"
                >
                  <IconExport size={16} style={{ color: "var(--c-text2)" }} />
                  <span className="font-medium">Export Data</span>
                </button>

                {/* 6. Help & Guide */}
                <button
                  onClick={() => {
                    onHelp?.();
                    setOverflowOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-[13px] flex items-center gap-2.5 hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors text-[var(--c-text)]"
                >
                  <IconHelp size={16} style={{ color: "var(--c-text2)" }} />
                  <span className="font-medium">Help & Guide</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Backdrop for mobile burger menu */}
      {overflowOpen && (
        <div
          className="fixed inset-0 z-[1290] bg-black/60 backdrop-blur-[2px]"
          onClick={() => setOverflowOpen(false)}
        />
      )}

      {/* Backdrop for model selector dropdown */}
      {modelOpen && (
        <div
          className="fixed inset-0 z-[1200]"
          onClick={() => setModelOpen(false)}
        />
      )}
    </header>
  );
}

function NavBtn({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: (p: { size?: number; style?: React.CSSProperties }) => React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-2 h-9 sm:h-10 px-2.5 sm:px-3 rounded-lg text-xs sm:text-[13px] font-semibold transition-all cursor-pointer"
      style={{
        color: active ? "var(--c-accent)" : "var(--c-text2)",
        background: active ? "var(--c-accent-dim)" : "transparent",
        border: active ? "1px solid var(--c-accent)" : "1px solid transparent",
      }}
    >
      <Icon size={16} style={{ color: active ? "var(--c-accent)" : "currentColor" }} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
