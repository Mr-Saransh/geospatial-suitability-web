import { useState } from 'react';
import { MODELS } from '../data';
import { IconSearch, IconCompare, IconExport, IconBot, IconHelp, IconChevronD, IconSidebar } from '../icons';
import { Btn, Mono } from '../ui';

interface Props {
  sidebarOpen: boolean; onSidebar: () => void;
  rightOpen: boolean;   onRight: () => void;
  aiOpen: boolean;      onAI: () => void;
  compareOpen: boolean; onCompare: () => void;
  onExport: () => void;
  model: string;        onModel: (m: string) => void;
  coord: string;
}

export default function Navbar({ sidebarOpen, onSidebar, aiOpen, onAI, compareOpen, onCompare, onExport, model, onModel, coord }: Props) {
  const [modelOpen, setModelOpen] = useState(false);

  return (
    <header className="flex-shrink-0 z-40 relative" style={{ background: '#080d18', borderBottom: '1px solid #1c2e48', height: 44 }}>
      <div className="flex items-center h-full px-3 gap-2">

        {/* Logo */}
        <button onClick={onSidebar} className="flex items-center gap-2.5 flex-shrink-0 group" title="Toggle sidebar">
          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
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
              style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>MCGSE</div>
            <div className="text-[9px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>GIS SUITABILITY ENGINE</div>
          </div>
          <div className="hidden lg:flex items-center gap-1 ml-1">
            <IconSidebar size={13} style={{ color: sidebarOpen ? '#00b4d8' : '#374f6a' }} />
          </div>
        </button>

        <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#1c2e48' }} />

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 max-w-72 h-7 px-2.5 rounded"
          style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
          <IconSearch size={12} style={{ color: '#374f6a', flexShrink: 0 }} />
          <input placeholder="Search location, district, coordinates…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[#374f6a]"
            style={{ color: '#c4d4e8' }} />
          <Mono color="#2a3f58">/</Mono>
        </div>

        {/* Model selector */}
        <div className="relative hidden md:block">
          <button onClick={() => setModelOpen(v => !v)}
            className="flex items-center gap-2 h-7 px-3 rounded text-xs transition-colors"
            style={{ background: '#0e1828', border: `1px solid ${modelOpen ? '#00b4d8' : '#1c2e48'}`, color: '#c4d4e8' }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00c896' }} />
            <span className="max-w-[200px] truncate" style={{ fontFamily: 'var(--font-body)' }}>{model}</span>
            <IconChevronD size={10} style={{ color: '#374f6a', flexShrink: 0 }} />
          </button>
          {modelOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 shadow-2xl min-w-[240px]"
              style={{ background: '#0c1424', border: '1px solid #1c2e48' }}>
              {MODELS.map(m => (
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
          style={{ background: '#0c1424', border: '1px solid #162038', fontFamily: 'var(--font-mono)', color: '#374f6a' }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="4" r="3" stroke="#374f6a" strokeWidth="1"/>
            <circle cx="4" cy="4" r="1" fill="#374f6a"/>
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
          <button className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#023e8a,#0096c7)', color: 'white', fontFamily: 'var(--font-display)' }}>
            PK
          </button>
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
