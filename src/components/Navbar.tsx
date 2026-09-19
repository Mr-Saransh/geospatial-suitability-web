import { useState } from 'react';
import { HIMACHAL_LOCATIONS } from '../data';
import type { ModelSummary } from '../lib/api/types';
import { IconSearch, IconCompare, IconExport, IconBot, IconHelp, IconChevronD, IconSidebar } from '../icons';
import { Mono } from '../ui';

interface Props {
  sidebarOpen: boolean; onSidebar: () => void;
  rightOpen: boolean;   onRight: () => void;
  aiOpen: boolean;      onAI: () => void;
  compareOpen: boolean; onCompare: () => void;
  onExport: () => void;
  model: string;        onModel: (m: string) => void;
  modelsList?: ModelSummary[];
  coord: string;
  onSearchLocation?: (loc: { lat: number; lng: number }) => void;
}

export default function Navbar({
  sidebarOpen, onSidebar,
  aiOpen, onAI,
  compareOpen, onCompare,
  onExport,
  model, onModel,
  modelsList,
  coord,
  onSearchLocation,
}: Props) {
  const [modelOpen, setModelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const availableModels = modelsList && modelsList.length > 0
    ? modelsList.map(m => m.name)
    : [
        '11-Factor Flood Suitability AHP',
        'Groundwater Recharge Potential v2.1',
        'Urban Expansion Suitability v1.3',
      ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !onSearchLocation) return;

    // Check if query is lat, lon format e.g. "31.1, 77.2"
    const coordMatch = searchQuery.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        onSearchLocation({ lat, lng });
        return;
      }
    }

    // Check for Himachal location match
    const loc = HIMACHAL_LOCATIONS.find(l =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.district.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (loc) {
      onSearchLocation({ lat: loc.lat, lng: loc.lng });
    }
  };

  return (
    <header className="flex-shrink-0 z-40 relative" style={{ background: '#080d18', borderBottom: '1px solid #1c2e48', height: 44 }}>
      <div className="flex items-center h-full px-3 gap-2">

        {/* Logo */}
        <button onClick={onSidebar} className="flex items-center gap-2.5 flex-shrink-0 group" title="Toggle sidebar">
          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 shadow-md"
            style={{ background: 'linear-gradient(145deg,#00b4d8 0%,#0096c7 40%,#023e8a 100%)' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="white" strokeWidth="1.4" fill="none"/>
              <circle cx="10" cy="10" r="2.5" fill="white"/>
              <line x1="10" y1="3.5" x2="10" y2="7" stroke="white" strokeWidth="1"/>
              <line x1="10" y1="13" x2="10" y2="16.5" stroke="white" strokeWidth="1"/>
            </svg>
          </div>
          <div className="hidden sm:block leading-none">
            <div className="text-sm font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>MCGSE Web-GIS</div>
            <div className="text-[9px]" style={{ color: '#00b4d8', fontFamily: 'var(--font-mono)' }}>HIMACHAL SPATIAL ENGINE</div>
          </div>
          <div className="hidden lg:flex items-center gap-1 ml-1">
            <IconSidebar size={13} style={{ color: sidebarOpen ? '#00b4d8' : '#374f6a' }} />
          </div>
        </button>

        <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#1c2e48' }} />

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-72 h-7 px-2.5 rounded"
          style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
          <IconSearch size={12} style={{ color: '#374f6a', flexShrink: 0 }} />
          <input
            placeholder="Search Shimla, Manali, 31.1, 77.2…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[#374f6a]"
            style={{ color: '#c4d4e8' }} />
          <Mono color="#2a3f58">↵</Mono>
        </form>

        {/* Model selector */}
        <div className="relative hidden md:block">
          <button onClick={() => setModelOpen(v => !v)}
            className="flex items-center gap-2 h-7 px-3 rounded text-xs transition-colors"
            style={{ background: '#0e1828', border: `1px solid ${modelOpen ? '#00b4d8' : '#1c2e48'}`, color: '#c4d4e8' }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00c896' }} />
            <span className="max-w-[220px] truncate" style={{ fontFamily: 'var(--font-body)' }}>{model}</span>
            <IconChevronD size={10} style={{ color: '#647d9a', flexShrink: 0 }} />
          </button>
          {modelOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 shadow-2xl min-w-[260px]"
              style={{ background: '#0c1424', border: '1px solid #1c2e48' }}>
              {availableModels.map(m => (
                <button key={m} onClick={() => { onModel(m); setModelOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:bg-[#111d33]"
                  style={{ color: m === model ? '#00b4d8' : '#c4d4e8' }}>
                  {m === model && <span style={{ color: '#00b4d8' }}>✓</span>}
                  {m !== model && <span className="w-4" />}
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Coordinate readout */}
        <div className="hidden xl:flex items-center gap-1.5 h-6 px-2 rounded text-[10px]"
          style={{ background: '#0c1424', border: '1px solid #162038', fontFamily: 'var(--font-mono)', color: '#00b4d8' }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="4" r="3" stroke="#00b4d8" strokeWidth="1"/>
            <circle cx="4" cy="4" r="1" fill="#00b4d8"/>
          </svg>
          {coord}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <NavBtn label="Compare" Icon={IconCompare} active={compareOpen} onClick={onCompare} />
          <NavBtn label="AI Assistant" Icon={IconBot} active={aiOpen} onClick={onAI} accent />
          <NavBtn label="Export" Icon={IconExport} onClick={onExport} />
          <NavBtn label="Help" Icon={IconHelp} />
          <div className="w-px h-5 mx-1" style={{ background: '#1c2e48' }} />
          <div className="px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)', fontFamily: 'var(--font-mono)' }}>
            ONLINE
          </div>
        </div>
      </div>

      {/* Close model dropdown backdrop */}
      {modelOpen && <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />}
    </header>
  );
}

function NavBtn({ label, Icon, active, onClick, accent }: {
  label: string; Icon: (p: { size?: number; style?: React.CSSProperties }) => React.ReactNode;
  active?: boolean; onClick?: () => void; accent?: boolean;
}) {
  return (
    <button onClick={onClick} title={label}
      className="flex items-center gap-1.5 h-7 px-2 rounded text-[11px] font-medium transition-all"
      style={{
        color: active ? (accent ? '#00b4d8' : '#c4d4e8') : '#647d9a',
        background: active ? (accent ? 'rgba(0,180,216,0.1)' : '#111d33') : 'transparent',
        border: active ? `1px solid ${accent ? 'rgba(0,180,216,0.3)' : '#1c2e48'}` : '1px solid transparent',
      }}>
      <Icon size={13} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
