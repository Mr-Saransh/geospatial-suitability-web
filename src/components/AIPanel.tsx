import { useState, useRef, useEffect } from 'react';
import { AI_PRESETS, AI_ANSWERS } from '../data';
import type { Zone, AIMessage } from '../types';
import { IconBot, IconSend, IconX, IconInfo } from '../icons';
import { Btn, Pill, Mono } from '../ui';

interface Props {
  zone: Zone | null;
  onClose: () => void;
  onLayerEvidence: (id: string) => void;
}

const SYSTEM_INIT: AIMessage = {
  role: 'assistant',
  text: 'I have loaded scientific context for the **11-Factor Flood Susceptibility AHP Model** (Himachal Pradesh, run ID 56). I can analyze multi-criteria flood susceptibility, AHP weights, pairwise consistency (CR = 0.0158), and point inspections. Click any location on the map or ask an analytical question below.',
  actions: [],
};

function formatText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--c-text)">$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin-top:6px">')
    .replace(/\n/g, '<br/>');
}

export default function AIPanel({ zone, onClose, onLayerEvidence }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>([SYSTEM_INIT]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (q: string) => {
    if (!q.trim() || loading) return;
    const userMsg: AIMessage = { role: 'user', text: q };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      let ans = AI_ANSWERS[q];
      if (!ans) {
        if (q.toLowerCase().includes('cr') || q.toLowerCase().includes('consistency')) {
          ans = AI_ANSWERS['What is the Consistency Ratio (CR) of this model?'];
        } else if (q.toLowerCase().includes('slope')) {
          ans = AI_ANSWERS['How does terrain slope affect flood susceptibility?'] || AI_ANSWERS['default'];
        } else if (q.toLowerCase().includes('weight') || q.toLowerCase().includes('highest')) {
          ans = AI_ANSWERS['Which criterion has the highest AHP weight?'];
        } else if (zone) {
          ans = AI_ANSWERS['Why is this location classified with its current flood susceptibility?'];
        } else {
          ans = AI_ANSWERS['default'];
        }
      }
      setMessages(m => [...m, { role: 'assistant', text: ans.text, actions: ans.actions }]);
      setLoading(false);
    }, 700);
  };

  const contextPresets = AI_PRESETS.filter(p => !p.context || p.context === 'model' || (p.context === 'zone' && zone));

  return (
    <div className="flex flex-col z-20" style={{ width: 340, background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--c-panel)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: 'rgba(0,180,216,0.12)', border: '1px solid rgba(0,180,216,0.3)', color: '#00b4d8' }}>
            <IconBot size={12} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-text)' }}>MCGSE AI Assistant</div>
            <div className="text-[10px]" style={{ color: '#00b4d8', fontFamily: 'var(--font-mono)' }}>
              Himachal Spatial Context · AHP Flood Engine
            </div>
          </div>
        </div>
        <Btn onClick={onClose} className="w-7 h-7" title="Close"><IconX size={13} /></Btn>
      </div>

      {/* Context bar */}
      <div className="px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap"
        style={{ background: 'var(--c-panel)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00c896' }} />
          <Mono color="#00b4d8">Flood AHP v1.0</Mono>
        </div>
        {zone
          ? <><span style={{ color: 'var(--c-border)' }}>·</span><Pill color="#00b4d8">{zone.district || `${zone.lat.toFixed(2)}°N`} · Score {zone.score.toFixed(2)}</Pill></>
          : <><span style={{ color: 'var(--c-border)' }}>·</span><Mono color="var(--c-text2)">Statewide Coverage</Mono></>
        }
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center"
                style={{ background: 'rgba(0,180,216,0.12)', border: '1px solid rgba(0,180,216,0.25)', color: '#00b4d8' }}>
                <IconBot size={11} />
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-[88%]">
              <div className="px-3 py-2.5 rounded-lg text-[11px] leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'rgba(0,180,216,0.1)' : 'var(--c-panel)',
                  color: msg.role === 'user' ? '#00b4d8' : 'var(--c-text)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(0,180,216,0.25)' : 'var(--c-border)'}`,
                }}>
                <p dangerouslySetInnerHTML={{ __html: `<p>${formatText(msg.text)}</p>` }}
                  style={{ margin: 0 }} />
              </div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {msg.actions.map(a => (
                    <button key={a.label} onClick={() => a.type === 'layer' && onLayerEvidence(a.target)}
                      className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors hover:bg-[#00b4d822]"
                      style={{ color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', background: 'rgba(0,180,216,0.06)' }}>
                      {a.type === 'layer' && '⊞ '}
                      {a.type === 'stats' && '↗ '}
                      {a.type === 'evidence' && '🔬 '}
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-2 items-center">
            <div className="w-5 h-5 rounded flex items-center justify-center"
              style={{ background: 'rgba(0,180,216,0.12)', border: '1px solid rgba(0,180,216,0.25)', color: '#00b4d8' }}>
              <IconBot size={11} />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 rounded-lg"
              style={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: '#00b4d8',
                    animation: 'pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                    opacity: 0.5,
                  }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)' }}>
          <div className="text-[10px] mb-1.5" style={{ color: 'var(--c-text3)', fontFamily: 'var(--font-mono)' }}>
            SUGGESTED QUESTIONS
          </div>
          <div className="flex flex-col gap-1">
            {contextPresets.slice(0, 4).map(p => (
              <button key={p.q} onClick={() => send(p.q)}
                className="text-left text-[11px] px-2.5 py-1.5 rounded transition-colors hover:opacity-80"
                style={{ color: 'var(--c-text)', background: 'var(--c-panel)', border: '1px solid var(--c-border)' }}>
                {p.q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-2 px-3 rounded-lg"
          style={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)', height: 36 }}>
          <input
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--c-text)', fontFamily: 'var(--font-body)' }}
            placeholder="Ask about Himachal flood susceptibility, AHP weights, criteria…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="flex-shrink-0 transition-opacity disabled:opacity-30"
            style={{ color: '#00b4d8' }}>
            <IconSend size={13} />
          </button>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <IconInfo size={9} style={{ color: 'var(--c-text3)' }} />
          <span className="text-[9px]" style={{ color: 'var(--c-text2)' }}>
            Connected to Himachal Pradesh Spatial Knowledge Package
          </span>
        </div>
      </div>
    </div>
  );
}
