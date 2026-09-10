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
  text: 'I have loaded scientific context for the **Groundwater Recharge Potential v2.1** model (West Bengal — Jalpaiguri region, run GRP-2024-WB-0042). I can analyse suitability factors, criterion weights, evidence links, and compare study zones. Select a zone or ask a question below.',
  actions: [],
};

function formatText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#c4d4e8">$1</strong>')
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
      const ans = AI_ANSWERS[q] || AI_ANSWERS['default'];
      setMessages(m => [...m, { role: 'assistant', text: ans.text, actions: ans.actions }]);
      setLoading(false);
    }, 900);
  };

  const contextPresets = AI_PRESETS.filter(p => !p.context || p.context === 'model' || (p.context === 'zone' && zone));

  return (
    <div className="flex flex-col" style={{ width: 340, background: '#0c1424', borderLeft: '1px solid #1c2e48' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: '#080d18', borderBottom: '1px solid #1c2e48' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: 'rgba(0,180,216,0.12)', border: '1px solid rgba(0,180,216,0.3)', color: '#00b4d8' }}>
            <IconBot size={12} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#c4d4e8' }}>MCGSE AI Assistant</div>
            <div className="text-[10px]" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
              Ollama · llama3.1:8b · scientific context
            </div>
          </div>
        </div>
        <Btn onClick={onClose} className="w-7 h-7" title="Close"><IconX size={13} /></Btn>
      </div>

      {/* Context bar */}
      <div className="px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap"
        style={{ background: '#090f1e', borderBottom: '1px solid #1c2e48' }}>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00b4d8' }} />
          <Mono color="#374f6a" >GRP v2.1</Mono>
        </div>
        {zone
          ? <><span style={{ color: '#1c2e48' }}>·</span><Pill color="#00b4d8">Sector {zone.label} · {zone.score.toFixed(2)}</Pill></>
          : <><span style={{ color: '#1c2e48' }}>·</span><Mono color="#374f6a">No zone selected</Mono></>
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
                  background: msg.role === 'user' ? 'rgba(0,180,216,0.1)' : '#0e1828',
                  color: msg.role === 'user' ? '#00b4d8' : '#647d9a',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(0,180,216,0.25)' : '#1c2e48'}`,
                }}>
                <p dangerouslySetInnerHTML={{ __html: `<p>${formatText(msg.text)}</p>` }}
                  style={{ margin: 0 }} />
              </div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {msg.actions.map(a => (
                    <button key={a.label} onClick={() => a.type === 'layer' && onLayerEvidence(a.target)}
                      className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
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
              style={{ background: '#0e1828', border: '1px solid #1c2e48' }}>
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
        <div className="px-4 py-2 flex-shrink-0" style={{ borderTop: '1px solid #1c2e48' }}>
          <div className="text-[10px] mb-1.5" style={{ color: '#374f6a', fontFamily: 'var(--font-mono)' }}>
            SUGGESTED QUESTIONS
          </div>
          <div className="flex flex-col gap-1">
            {contextPresets.slice(0, 4).map(p => (
              <button key={p.q} onClick={() => send(p.q)}
                className="text-left text-[11px] px-2.5 py-1.5 rounded transition-colors hover:bg-[#111d33]"
                style={{ color: '#647d9a', background: '#0e1828', border: '1px solid #1c2e48' }}>
                {p.q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #1c2e48' }}>
        <div className="flex items-center gap-2 px-3 rounded-lg"
          style={{ background: '#0e1828', border: '1px solid #1c2e48', height: 36 }}>
          <input
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: '#c4d4e8', fontFamily: 'var(--font-body)' }}
            placeholder="Ask about suitability, evidence, or criteria…"
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
          <IconInfo size={9} style={{ color: '#374f6a' }} />
          <span className="text-[9px]" style={{ color: '#374f6a' }}>
            Responses grounded in loaded model context and scientific datasets
          </span>
        </div>
      </div>
    </div>
  );
}
