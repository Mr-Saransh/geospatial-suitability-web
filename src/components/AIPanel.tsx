import { useState, useRef, useEffect } from "react";
import { AI_PRESETS, AI_ANSWERS } from "../data";
import type { Zone, AIMessage, Layer } from "../types";
import { IconBot, IconSend, IconX, IconInfo } from "../icons";
import { Btn, Pill, Mono } from "../ui";

interface Props {
  open?: boolean;
  zone: Zone | null;
  activeLayer?: Layer | null;
  onClose: () => void;
  onLayerEvidence: (id: string) => void;
  onSelectLayer?: (id: string) => void;
  activeModelId?: string;
  activeModelName?: string;
  isMobile?: boolean;
}

function formatText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--c-text)">$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin-top:6px">')
    .replace(/\n/g, "<br/>");
}

export default function AIPanel({
  zone,
  onClose,
  onLayerEvidence,
  activeModelId,
  activeModelName,
  isMobile = false,
}: Props) {
  const isLandslide =
    (activeModelId?.includes("landslide") ||
      activeModelName?.toLowerCase().includes("landslide")) ??
    false;
  const hazardName = isLandslide ? "Landslide" : activeModelName || "Flood";
  const modelTitle = `${activeModelName || hazardName} Susceptibility Model`;

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      text: `I have loaded spatial context for the **${modelTitle}** (Himachal Pradesh). I can explain ${hazardName.toLowerCase()} susceptibility criteria, factor weights, analysis coverage, and point inspections. Click any location on the map or select a question below.`,
      actions: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Support Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const send = (q: string) => {
    if (!q.trim() || loading) return;
    const userMsg: AIMessage = { role: "user", text: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      let ans = AI_ANSWERS[q];
      if (!ans) {
        if (q.toLowerCase().includes("cr") || q.toLowerCase().includes("consistency")) {
          ans = AI_ANSWERS["What is the Consistency Ratio (CR) of this model?"];
        } else if (q.toLowerCase().includes("slope")) {
          ans =
            AI_ANSWERS["How does terrain slope affect flood susceptibility?"] ||
            AI_ANSWERS["default"];
        } else if (q.toLowerCase().includes("weight") || q.toLowerCase().includes("highest")) {
          ans = AI_ANSWERS["Which criterion has the highest AHP weight?"];
        } else if (zone) {
          ans =
            AI_ANSWERS["Why is this location classified with its current flood susceptibility?"];
        } else {
          ans = AI_ANSWERS["default"];
        }
      }
      let replyText = ans.text;
      if (isLandslide) {
        replyText = replyText.replace(/Flood/g, "Landslide").replace(/flood/g, "landslide");
      }
      setMessages((m) => [...m, { role: "assistant", text: replyText, actions: ans.actions }]);
      setLoading(false);
    }, 600);
  };

  const contextPresets = AI_PRESETS.filter(
    (p) => !p.context || p.context === "model" || (p.context === "zone" && zone),
  );

  const panelContent = (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden select-none">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{
              background: "var(--c-accent-dim)",
              border: "1px solid var(--c-accent)",
              color: "var(--c-accent)",
            }}
          >
            <IconBot size={14} />
          </div>
          <div>
            <div
              className="text-xs font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--c-text)",
              }}
            >
              MCGSE AI Assistant
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--c-accent)", fontFamily: "var(--font-mono)" }}
            >
              Himachal Spatial Context · {hazardName} Engine
            </div>
          </div>
        </div>
        <Btn onClick={onClose} className="w-7 h-7" title="Close assistant (Esc)">
          <IconX size={13} />
        </Btn>
      </div>

      {/* Context bar */}
      <div
        className="px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap text-xs"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00c896" }} />
          <Mono color="var(--c-accent)">{isLandslide ? "Landslide MCDA v1.0" : "Flood AHP v1.0"}</Mono>
        </div>
        {zone ? (
          <>
            <span style={{ color: "var(--c-border2)" }}>·</span>
            <Pill color="var(--c-accent)">
              {zone.district || `${zone.lat.toFixed(2)}°N`} · Score {zone.score.toFixed(2)}
            </Pill>
          </>
        ) : (
          <>
            <span style={{ color: "var(--c-border2)" }}>·</span>
            <Mono color="var(--c-text2)">Statewide Coverage</Mono>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3 overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
          >
            {msg.role === "assistant" && (
              <div
                className="w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center"
                style={{
                  background: "var(--c-accent-dim)",
                  border: "1px solid var(--c-accent)",
                  color: "var(--c-accent)",
                }}
              >
                <IconBot size={11} />
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-[88%]">
              <div
                className="px-3 py-2.5 rounded-lg text-xs leading-relaxed"
                style={{
                  background: msg.role === "user" ? "var(--c-accent-dim)" : "var(--c-panel)",
                  color: msg.role === "user" ? "var(--c-text)" : "var(--c-text)",
                  border: `1px solid ${
                    msg.role === "user" ? "var(--c-accent)" : "var(--c-border)"
                  }`,
                }}
              >
                <p
                  dangerouslySetInnerHTML={{
                    __html: `<p>${formatText(msg.text)}</p>`,
                  }}
                  style={{ margin: 0 }}
                />
              </div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {msg.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => a.type === "layer" && onLayerEvidence(a.target)}
                      className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors hover:bg-[var(--c-accent-dim)]"
                      style={{
                        color: "var(--c-accent)",
                        border: "1px solid var(--c-border2)",
                        background: "var(--c-panel)",
                      }}
                    >
                      {a.type === "layer" && "⊞ "}
                      {a.type === "stats" && "↗ "}
                      {a.type === "evidence" && "🔬 "}
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
            <div
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{
                background: "var(--c-accent-dim)",
                border: "1px solid var(--c-accent)",
                color: "var(--c-accent)",
              }}
            >
              <IconBot size={11} />
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "var(--c-accent)",
                    animation: "pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div
            className="text-[10px] mb-1.5"
            style={{ color: "var(--c-text3)", fontFamily: "var(--font-mono)" }}
          >
            SUGGESTED QUESTIONS
          </div>
          <div className="flex flex-col gap-1">
            {contextPresets.slice(0, 3).map((p) => (
              <button
                key={p.q}
                onClick={() => send(p.q)}
                className="text-left text-xs px-2.5 py-1.5 rounded transition-colors hover:bg-[var(--c-accent-dim)]"
                style={{
                  color: "var(--c-text)",
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                }}
              >
                {p.q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
        <div
          className="flex items-center gap-2 px-3 rounded-lg"
          style={{
            background: "var(--c-panel)",
            border: "1px solid var(--c-border)",
            height: 38,
          }}
        >
          <input
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: "var(--c-text)", fontFamily: "var(--font-body)" }}
            placeholder={`Ask about Himachal ${hazardName.toLowerCase()} susceptibility, criteria, weights…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 transition-opacity disabled:opacity-30 cursor-pointer"
            style={{ color: "var(--c-accent)" }}
          >
            <IconSend size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <IconInfo size={10} style={{ color: "var(--c-text3)" }} />
          <span className="text-[10px]" style={{ color: "var(--c-text3)" }}>
            Connected to Himachal Pradesh Spatial Knowledge Package
          </span>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-x-0 top-0 bottom-14 z-[1250] flex flex-col justify-end pointer-events-none">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto" onClick={onClose} />
        <div
          className="relative z-10 flex flex-col shadow-2xl bottom-sheet-enter mobile-bottom-sheet overflow-hidden pointer-events-auto"
          style={{
            background: "var(--c-surface)",
            borderRadius: "16px 16px 0 0",
            maxHeight: "calc(100dvh - 120px)",
            height: "75vh",
            minHeight: "45vh",
            border: "1px solid var(--c-border)",
            borderBottom: "none",
          }}
        >
          <div className="drag-handle flex-shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden pb-3">
            {panelContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed right-3 bottom-3 top-14 z-[1200] w-[370px] max-w-[calc(100vw-24px)] flex flex-col rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-border)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.6)",
      }}
    >
      {panelContent}
    </div>
  );
}
