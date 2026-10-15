import { useState, useRef, useEffect, useCallback } from "react";
import { AI_PRESETS } from "../data";
import type { Zone, AIMessage, Layer } from "../types";
import type { AIAssistantEvidence, AIHealthResponse } from "../lib/api/types";
import { api } from "../lib/api/client";
import { IconBot, IconSend, IconX, IconInfo, IconChevronD, IconChevronU } from "../icons";
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

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--c-text)">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color:var(--c-text2)">$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--c-panel);padding:1px 4px;border-radius:4px;font-family:var(--font-mono);color:var(--c-accent)">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin-top:6px">')
    .replace(/\n- (.*?)(?=\n|$)/g, '<li style="margin-left:14px;list-style-type:disc">$1</li>')
    .replace(/\n/g, "<br/>");
}

function EvidenceAccordion({ evidence, warnings }: { evidence: AIAssistantEvidence; warnings?: string[] }) {
  const [open, setOpen] = useState(false);

  const pt = evidence.point_inspection;
  const coords = evidence.coordinates;
  const stats = evidence.statistics;
  const weights = evidence.criteria_weights || [];

  return (
    <div
      className="mt-2 rounded-lg border overflow-hidden transition-all text-[11px]"
      style={{
        background: "var(--c-panel)",
        borderColor: open ? "var(--c-accent)" : "var(--c-border)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2.5 py-1.5 flex items-center justify-between text-left transition-colors hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
        style={{ color: "var(--c-text2)" }}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <span style={{ color: "var(--c-accent)" }}>🔬</span>
          <span style={{ color: "var(--c-text)" }}>Retrieved GIS Evidence</span>
          {evidence.suitability_score != null && (
            <span
              className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px]"
              style={{ background: "var(--c-accent-dim)", color: "var(--c-accent)" }}
            >
              Score {evidence.suitability_score.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--c-text3)" }}>
          <span>{open ? "Hide" : "Inspect Facts"}</span>
          {open ? <IconChevronU size={11} /> : <IconChevronD size={11} />}
        </div>
      </button>

      {open && (
        <div
          className="px-3 py-2.5 flex flex-col gap-2 border-t leading-normal animate-in fade-in-50"
          style={{ borderColor: "var(--c-border)" }}
        >
          {/* Model info */}
          <div className="flex items-center justify-between flex-wrap gap-1 pb-1 border-b border-[var(--c-border)]">
            <span style={{ color: "var(--c-text3)" }}>Model</span>
            <span className="font-semibold text-[var(--c-text)]">
              {evidence.model_name || evidence.model_id} ({evidence.criteria_count} factors)
            </span>
          </div>

          {/* Point info if coordinate was queried */}
          {coords && (
            <div className="flex flex-col gap-1 pb-1 border-b border-[var(--c-border)]">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--c-text3)" }}>Coordinate</span>
                <span className="font-mono text-[var(--c-text)]">
                  {coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E
                </span>
              </div>
              {evidence.location_status && (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--c-text3)" }}>Location Status</span>
                  <span
                    className={`font-semibold ${
                      evidence.location_status === "OUTSIDE_ANALYSIS_AREA"
                        ? "text-red-400"
                        : "text-[var(--c-accent)]"
                    }`}
                  >
                    {evidence.location_status}
                  </span>
                </div>
              )}
              {pt && pt.suitability_score != null && (
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--c-text3)" }}>Suitability Result</span>
                  <span className="font-semibold font-mono text-[var(--c-accent)]">
                    {pt.suitability_score.toFixed(2)} / 5.00 ({pt.suitability_label || `Class ${pt.suitability_class}`})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Top contributing factors */}
          {pt?.top_factors && pt.top_factors.length > 0 && (
            <div className="flex flex-col gap-1 pb-1 border-b border-[var(--c-border)]">
              <span className="font-medium text-[var(--c-text3)]">Top Contributing Criteria:</span>
              <div className="flex flex-col gap-0.5 pl-1">
                {pt.top_factors.map((f) => (
                  <div key={f.criterion} className="flex items-center justify-between text-[10px]">
                    <span className="capitalize text-[var(--c-text)]">{f.criterion.replace(/_/g, " ")}</span>
                    <span className="font-mono text-[var(--c-text2)]">
                      {f.raw_value != null ? `raw: ${f.raw_value}` : ""} · rating: {f.rating != null ? `${f.rating}/5` : "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Weights */}
          {weights.length > 0 && (
            <div className="flex flex-col gap-1 pb-1 border-b border-[var(--c-border)]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--c-text3)]">AHP Factor Weights</span>
                {evidence.consistency_ratio != null && (
                  <span className="font-mono text-[10px] text-[var(--c-accent)]">
                    CR: {evidence.consistency_ratio.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {weights.slice(0, 6).map((w) => (
                  <span
                    key={w.criterion}
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono"
                    style={{ background: "var(--c-panel)", border: "1px solid var(--c-border2)" }}
                  >
                    {w.criterion.replace(/_/g, " ")}: {(w.weight * 100).toFixed(1)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Statistics summary if retrieved */}
          {stats && (
            <div className="flex flex-col gap-1 pb-1 border-b border-[var(--c-border)]">
              <span className="font-medium text-[var(--c-text3)]">Statewide Analysis Coverage:</span>
              <div className="flex items-center justify-between text-[10px]">
                <span style={{ color: "var(--c-text2)" }}>Valid Area Coverage:</span>
                <span className="font-mono text-[var(--c-accent)]">{stats.valid_coverage_pct}%</span>
              </div>
              {stats.score_mean != null && (
                <div className="flex items-center justify-between text-[10px]">
                  <span style={{ color: "var(--c-text2)" }}>Mean Score:</span>
                  <span className="font-mono text-[var(--c-text)]">
                    {stats.score_mean.toFixed(2)} ± {stats.score_std?.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Limitations and Warnings */}
          {warnings && warnings.length > 0 && (
            <div className="pt-0.5 flex flex-col gap-1">
              {warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1 text-[10px] text-amber-400">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIPanel({
  zone,
  onClose,
  onLayerEvidence,
  activeModelId = "flood_11_factor_v1",
  activeModelName = "Flood",
  isMobile = false,
}: Props) {
  const isLandslide =
    activeModelId.includes("landslide") ||
    activeModelName.toLowerCase().includes("landslide");
  const hazardName = isLandslide ? "Landslide" : activeModelName || "Flood";
  const modelTitle = `${activeModelName || hazardName} Susceptibility Model`;

  const [aiHealth, setAiHealth] = useState<AIHealthResponse | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      text: `Welcome to the **${modelTitle}** AI Assistant. I am directly grounded in the **Himachal Pradesh Spatial Knowledge Package**. I inspect point coordinates, explain criteria weights, and report statewide statistics. Click any map location or ask a question below.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Probe Ollama and AI health on mount
  useEffect(() => {
    api
      .getAIHealth()
      .then((h) => setAiHealth(h))
      .catch((err) => {
        console.warn("AI health probe error:", err);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  const send = useCallback(
    async (q: string) => {
      if (!q.trim() || loading) return;
      const questionText = q.trim();
      const userMsg: AIMessage = { role: "user", text: questionText };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);

      // Prepare conversation history (bounded to last 6 turns)
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      try {
        const res = await api.askAI({
          question: questionText,
          model_id: activeModelId,
          latitude: zone?.lat,
          longitude: zone?.lng,
          history: historyPayload,
        });

        // Generate contextual layer action buttons if factors are mentioned
        const actions: AIMessage["actions"] = [];
        const ev = res.evidence;
        if (ev.point_inspection?.top_factors) {
          for (const f of ev.point_inspection.top_factors.slice(0, 2)) {
            actions.push({
              label: `Layer: ${f.criterion.replace(/_/g, " ")}`,
              type: "layer",
              target: f.criterion,
            });
          }
        }

        const assistantMsg: AIMessage = {
          role: "assistant",
          text: res.answer,
          evidence: res.evidence,
          warnings: res.warnings,
          source: res.source,
          modelUsed: res.model_used || undefined,
          actions,
        };

        setMessages((m) => [...m, assistantMsg]);
      } catch (err: unknown) {
        console.error("AI question failed:", err);
        const errMsg = err instanceof Error ? err.message : String(err);

        let userFriendly = "Sorry, I encountered an issue contacting the AI endpoint.";
        if (errMsg.includes("429")) {
          userFriendly = "⚠️ Rate limit reached (maximum 20 requests/min). Please wait a moment before asking again.";
        } else if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) {
          userFriendly = "⚠️ Connection to the backend failed. Ensure your ngrok tunnel and FastAPI backend are running.";
        }

        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: `${userFriendly}\n\n*Technical note: ${errMsg}*`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeModelId, zone, messages, loading],
  );

  // Dynamic suggested questions relevant to current context
  const dynamicPresets = zone
    ? [
        `Why is this location classified as ${zone.cls} susceptibility?`,
        "Which factor contributes most to the score at these coordinates?",
        `What are the limiting factors for this point in ${zone.district}?`,
      ]
    : [
        `What criteria and weights are configured for the ${hazardName} model?`,
        `What is the statewide mean susceptibility and valid coverage for ${hazardName}?`,
        "What is the Consistency Ratio (CR) of this model and is it valid?",
      ];

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
              className="text-xs font-semibold flex items-center gap-1.5"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--c-text)",
              }}
            >
              <span>MCGSE AI Copilot</span>
              {aiHealth?.model_installed ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`Ollama Ready (${aiHealth.configured_model})`} />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="GIS Grounded Mode" />
              )}
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--c-accent)", fontFamily: "var(--font-mono)" }}
            >
              Himachal Spatial Package · {hazardName} Engine
            </div>
          </div>
        </div>
        <Btn onClick={onClose} className="w-7 h-7 cursor-pointer" title="Close assistant (Esc)">
          <IconX size={13} />
        </Btn>
      </div>

      {/* Context bar with Ollama model status */}
      <div
        className="px-4 py-2 flex-shrink-0 flex items-center justify-between gap-2 flex-wrap text-xs"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#00c896" }} />
          <Mono color="var(--c-accent)">{isLandslide ? "Landslide 14-Factor" : "Flood 11-Factor"}</Mono>
          {zone ? (
            <>
              <span style={{ color: "var(--c-border2)" }}>·</span>
              <Pill color="var(--c-accent)">
                {zone.district || `${zone.lat.toFixed(2)}°N`} · {zone.score.toFixed(2)}
              </Pill>
            </>
          ) : (
            <>
              <span style={{ color: "var(--c-border2)" }}>·</span>
              <Mono color="var(--c-text2)">Statewide Coverage</Mono>
            </>
          )}
        </div>

        {/* Local Ollama runtime badge */}
        <div className="text-[10px] font-mono flex items-center gap-1" style={{ color: "var(--c-text3)" }}>
          <span>AI:</span>
          {aiHealth?.model_installed ? (
            <span className="text-emerald-400 font-semibold">{aiHealth.configured_model}</span>
          ) : aiHealth?.ollama_reachable ? (
            <span className="text-amber-400" title={aiHealth.setup_guidance || "Pull model"}>
              Ollama (model needed)
            </span>
          ) : (
            <span className="text-amber-400" title="GIS facts mode">
              GIS Grounded
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
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
            <div className="flex flex-col gap-1 max-w-[88%]">
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
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<p style="margin:0">${formatMarkdown(msg.text)}</p>`,
                  }}
                />

                {/* Collapsible Evidence Accordion for Grounded Responses */}
                {msg.evidence && (
                  <EvidenceAccordion evidence={msg.evidence} warnings={msg.warnings} />
                )}
              </div>

              {/* Action Buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {msg.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => a.type === "layer" && onLayerEvidence(a.target)}
                      className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors hover:bg-[var(--c-accent-dim)] cursor-pointer"
                      style={{
                        color: "var(--c-accent)",
                        border: "1px solid var(--c-border2)",
                        background: "var(--c-panel)",
                      }}
                    >
                      <span>⊞</span>
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading animation */}
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
              <span className="text-[11px] text-[var(--c-text3)] font-mono mr-1">
                Sampling rasters & generating...
              </span>
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

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 flex-shrink-0" style={{ borderTop: "1px solid var(--c-border)" }}>
          <div
            className="text-[10px] mb-1.5 flex items-center justify-between"
            style={{ color: "var(--c-text3)", fontFamily: "var(--font-mono)" }}
          >
            <span>SUGGESTED SPATIAL QUESTIONS</span>
            {zone && <span className="text-[var(--c-accent)]">● Coordinate Context Active</span>}
          </div>
          <div className="flex flex-col gap-1">
            {dynamicPresets.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-left text-xs px-2.5 py-1.5 rounded transition-colors hover:bg-[var(--c-accent-dim)] cursor-pointer"
                style={{
                  color: "var(--c-text)",
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                }}
              >
                {q}
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
            placeholder={
              zone
                ? `Ask about this point (${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E) or ${hazardName} model…`
                : `Ask about Himachal ${hazardName.toLowerCase()} susceptibility, criteria, weights…`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 transition-opacity disabled:opacity-30 cursor-pointer"
            style={{ color: "var(--c-accent)" }}
            title="Send query to local AI"
          >
            <IconSend size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: "var(--c-text3)" }}>
          <div className="flex items-center gap-1">
            <IconInfo size={10} />
            <span>Grounded in Himachal Spatial Knowledge Package</span>
          </div>
          {zone && (
            <span className="font-mono text-[var(--c-accent)]">
              {zone.lat.toFixed(3)}°, {zone.lng.toFixed(3)}°
            </span>
          )}
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
