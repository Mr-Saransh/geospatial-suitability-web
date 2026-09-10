import type { SuitClass } from './types';
import { SUIT_META } from './data';

/* ── Suitability badge ─────────────────────────────────────────── */
export function SuitBadge({ cls, size = 'sm' }: { cls: SuitClass; size?: 'xs' | 'sm' }) {
  const m = SUIT_META[cls];
  const px = size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded font-medium ${px}`}
      style={{ color: m.color, background: m.bg }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

/* ── Score bar ─────────────────────────────────────────────────── */
export function ScoreBar({ value, color, height = 3 }: { value: number; color: string; height?: number }) {
  return (
    <div className="relative rounded-full overflow-hidden" style={{ background: '#1c2e48', height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value * 100}%`, background: color }} />
    </div>
  );
}

/* ── Section divider with label ────────────────────────────────── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium tracking-[0.1em] uppercase mb-2 mt-1"
      style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
      {children}
    </div>
  );
}

/* ── Panel row with hover ──────────────────────────────────────── */
export function PanelRow({ children, onClick, active }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean;
}) {
  return (
    <div onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      style={{ background: active ? 'rgba(0,180,216,0.08)' : 'transparent' }}>
      {children}
    </div>
  );
}

/* ── Icon button ───────────────────────────────────────────────── */
export function Btn({ children, onClick, active, title, variant = 'ghost', className = '', disabled }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean;
  title?: string; variant?: 'ghost' | 'primary' | 'danger' | 'outline';
  className?: string; disabled?: boolean;
}) {
  const base = 'flex items-center justify-center rounded transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';
  const styles: Record<string, React.CSSProperties> = {
    ghost:   { color: active ? '#00b4d8' : '#647d9a', background: active ? 'rgba(0,180,216,0.1)' : 'transparent' },
    primary: { color: '#fff', background: active ? '#0090b8' : '#00b4d8' },
    danger:  { color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' },
    outline: { color: '#c4d4e8', background: 'transparent', border: '1px solid #1c2e48' },
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`${base} ${className}`} style={styles[variant]}>
      {children}
    </button>
  );
}

/* ── Tab bar ───────────────────────────────────────────────────── */
export function TabBar({ tabs, active, onChange }: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex" style={{ borderBottom: '1px solid #1c2e48' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className="flex-1 py-2 text-[11px] font-medium capitalize transition-colors"
          style={{
            color: active === t.id ? '#00b4d8' : '#374f6a',
            borderBottom: active === t.id ? '2px solid #00b4d8' : '2px solid transparent',
            fontFamily: 'var(--font-body)',
          }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Mono value ────────────────────────────────────────────────── */
export function Mono({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', color: color || '#c4d4e8', fontSize: 12 }}>
      {children}
    </span>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────── */
export function StatTile({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="p-3 rounded" style={{ background: '#111d33', border: '1px solid #1c2e48' }}>
      <div className="text-[10px] mb-1" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div className="text-base font-semibold" style={{ fontFamily: 'var(--font-mono)', color: accent || '#c4d4e8' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: '#374f6a' }}>{sub}</div>}
    </div>
  );
}

/* ── Pill tag ──────────────────────────────────────────────────── */
export function Pill({ children, color = '#00b4d8' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex text-[10px] px-1.5 py-px rounded font-medium"
      style={{ color, background: `${color}18` }}>
      {children}
    </span>
  );
}

/* ── Kbd ───────────────────────────────────────────────────────── */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-px text-[10px] rounded"
      style={{ background: '#111d33', color: '#374f6a', border: '1px solid #1c2e48', fontFamily: 'var(--font-mono)' }}>
      {children}
    </kbd>
  );
}

/* ── Modal shell ───────────────────────────────────────────────── */
export function Modal({ children, onClose, title, width = 560 }: {
  children: React.ReactNode; onClose: () => void; title: string; width?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width, maxHeight: '90vh', background: '#0c1424', border: '1px solid #1c2e48' }}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid #1c2e48' }}>
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>{title}</span>
          <Btn onClick={onClose} title="Close" className="w-7 h-7">{
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          }</Btn>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────── */
export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: '#111d33', border: '1px solid #1c2e48', color: '#374f6a' }}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium mb-1" style={{ color: '#647d9a' }}>{title}</div>
        <div className="text-xs leading-relaxed" style={{ color: '#374f6a' }}>{body}</div>
      </div>
    </div>
  );
}
