import { useState, useRef, useEffect, useCallback } from "react";
import type { Zone, AIMessage, Layer } from "../types";
import type {
  AIAssistantEvidence,
  AIHealthResponse,
  StructuredEvidenceItem,
  AIStatusStreamEvent,
  AIEvidenceStreamEvent,
  AIDoneStreamEvent,
} from "../lib/api/types";
import { api } from "../lib/api/client";
import { IconBot, IconSend, IconX, IconInfo, IconChevronD, IconChevronU, IconRefresh } from "../icons";
import { Btn } from "../ui";

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
    .replace(
      /`([^`]+)`/g,
      '<code style="background:var(--c-panel);padding:1px 4px;border-radius:4px;font-family:var(--font-mono);color:var(--c-accent)">$1</code>'
    )
    .replace(/\n\n/g, '</p><p style="margin-top:6px">')
    .replace(/\n- (.*?)(?=\n|$)/g, '<li style="margin-left:14px;list-style-type:disc">$1</li>')
    .replace(/\n/g, "<br/>");
}

function EvidenceAccordion({
  evidence,
  items = [],
  warnings,
}: {
  evidence: AIAssistantEvidence;
  items?: StructuredEvidenceItem[];
  warnings?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const pt = evidence.point_inspection;
  const coords = evidence.coordinates;
  const stats = evidence.statistics;
  const weights = evidence.criteria_weights || [];
  const comp = evidence.model_comparison;

  const handleCopy = () => {
    const lines: string[] = [`## Verified Spatial Facts (${evidence.model_name || evidence.model_id})`];
    if (coords) {
      lines.push(`- Coordinates: ${coords.latitude.toFixed(4)}°N, ${coords.longitude.toFixed(4)}°E`);
      if (evidence.suitability_score != null) {
        lines.push(`- Score: ${evidence.suitability_score.toFixed(2)} (${evidence.suitability_label || ""})`);
      }
    }
    if (items.length > 0) {
      lines.push("\n### Atomic Evidence Items:");
      items.forEach((it) => {
        lines.push(`- [${it.category}] ${it.label}: ${it.value} ${it.unit || ""} (Source: ${it.source})`);
      });
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredItems = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "point") return it.category === "point_inspection";
    if (filter === "weights") return it.category === "criteria_weights";
    if (filter === "stats") return it.category === "statistics";
    if (filter === "compare") return it.category === "model_comparison";
    return true;
  });

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
          {items.length > 0 && (
            <span className="text-[10px] text-[var(--c-text3)] font-mono">
              ({items.length} facts)
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
          className="px-3 py-2.5 flex flex-col gap-2.5 border-t leading-normal animate-in fade-in-50"
          style={{ borderColor: "var(--c-border)" }}
        >
          {/* Filter Bar & Copy Action */}
          <div className="flex items-center justify-between flex-wrap gap-1 pb-1 border-b border-[var(--c-border)]">
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All" },
                ...(coords ? [{ id: "point", label: "Point" }] : []),
                { id: "weights", label: "Weights" },
                ...(stats ? [{ id: "stats", label: "Stats" }] : []),
                ...(comp ? [{ id: "compare", label: "Compare" }] : []),
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer transition-colors ${
                    filter === btn.id
                      ? "bg-[var(--c-accent)] text-black font-semibold"
                      : "bg-[var(--c-surface)] text-[var(--c-text2)] hover:text-[var(--c-text)]"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopy}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded text-[var(--c-accent)] hover:bg-[var(--c-accent-dim)] cursor-pointer"
            >
              {copied ? "✓ Copied" : "Copy Facts"}
            </button>
          </div>

          {/* Atomic Evidence Items View */}
          {filteredItems.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
              {filteredItems.map((it) => (
                <div
                  key={it.id}
                  className="p-1.5 rounded flex flex-col gap-0.5 text-[10px]"
                  style={{
                    background: "var(--c-surface)",
                    border: "1px solid var(--c-border2)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--c-text)]">{it.label}</span>
                    <span className="font-mono font-semibold text-[var(--c-accent)]">
                      {String(it.value)} {it.unit ? `${it.unit}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px]" style={{ color: "var(--c-text3)" }}>
                    <span className="truncate max-w-[200px]">Source: {it.source}</span>
                    {it.coverage_status && <span className="font-mono">{it.coverage_status}</span>}
                  </div>
                  {it.caveats && (
                    <div className="text-[9px] text-amber-400/90 italic">{it.caveats}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Fallback structured view if no atomic items */
            <div className="flex flex-col gap-2">
              {coords && pt && (
                <div className="flex flex-col gap-0.5 pb-1 border-b border-[var(--c-border)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--c-text3)]">Coordinate</span>
                    <span className="font-mono text-[var(--c-text)]">
                      {coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E
                    </span>
                  </div>
                  {pt.suitability_score != null && (
                    <div className="flex justify-between">
                      <span className="text-[var(--c-text3)]">Suitability Score</span>
                      <span className="font-mono text-[var(--c-accent)] font-semibold">
                        {pt.suitability_score.toFixed(2)} / 5.00 ({pt.suitability_label || `Class ${pt.suitability_class}`})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {weights.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--c-text3)]">Factor Weights:</span>
                  <div className="flex flex-wrap gap-1">
                    {weights.slice(0, 6).map((w) => (
                      <span
                        key={w.criterion}
                        className="px-1.5 py-0.2 rounded text-[9px] font-mono"
                        style={{ background: "var(--c-surface)", border: "1px solid var(--c-border2)" }}
                      >
                        {w.criterion.replace(/_/g, " ")}: {(w.weight * 100).toFixed(1)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Warnings & Limitations */}
          {warnings && warnings.length > 0 && (
            <div className="pt-1 flex flex-col gap-1 border-t border-[var(--c-border)]">
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

  const [aiHealth, setAiHealth] = useState<AIHealthResponse | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      text: "Welcome to **MCGSE AI**. I am your evidence-grounded spatial decision-support assistant. Ask questions about factor weights, classification rules, or select any point on the map to inspect specific coordinates.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStageMessage, setCurrentStageMessage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>("");

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
  }, [messages, loading, currentStageMessage]);

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

  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setCurrentStageMessage(null);
  }, []);

  const send = useCallback(
    async (q: string) => {
      if (!q.trim() || loading) return;
      const questionText = q.trim();
      lastQuestionRef.current = questionText;

      const userMsg: AIMessage = { role: "user", text: questionText };
      const placeholderAssistantMsg: AIMessage = {
        role: "assistant",
        text: "",
        isStreaming: true,
      };

      setMessages((m) => [...m, userMsg, placeholderAssistantMsg]);
      setInput("");
      setLoading(true);
      setCurrentStageMessage("Understanding your question...");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Prepare conversation history (bounded to last 6 turns)
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      try {
        await api.askAIStream(
          {
            question: questionText,
            model_id: activeModelId,
            latitude: zone?.lat,
            longitude: zone?.lng,
            history: historyPayload,
          },
          {
            onStatus: (st: AIStatusStreamEvent) => {
              setCurrentStageMessage(st.message);
            },
            onEvidence: (ev: AIEvidenceStreamEvent) => {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    evidence: ev.evidence,
                    items: ev.items,
                    warnings: ev.warnings,
                  };
                }
                return next;
              });
            },
            onToken: (token: string) => {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    text: next[lastIdx].text + token,
                  };
                }
                return next;
              });
            },
            onDone: (doneData: AIDoneStreamEvent) => {
              // Contextual layer action buttons if top factors present
              const actions: AIMessage["actions"] = [];
              const ev = doneData.evidence;
              if (ev?.point_inspection?.top_factors) {
                for (const f of ev.point_inspection.top_factors.slice(0, 2)) {
                  actions.push({
                    label: `Layer: ${f.criterion.replace(/_/g, " ")}`,
                    type: "layer",
                    target: f.criterion,
                  });
                }
              }

              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    role: "assistant",
                    text: doneData.answer || next[lastIdx].text,
                    evidence: doneData.evidence,
                    items: doneData.items,
                    warnings: doneData.warnings,
                    source: doneData.source,
                    modelUsed: doneData.model_used || undefined,
                    isStreaming: false,
                    actions,
                  };
                }
                return next;
              });
            },
            onError: (err: Error) => {
              console.error("AI stream error:", err);
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    role: "assistant",
                    text: `⚠️ ${err.message || "Unable to complete AI response."}`,
                    isStreaming: false,
                    error: true,
                  };
                }
                return next;
              });
            },
          },
          controller.signal
        );
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          console.error("AI question failed:", err);
          const errMsg = err instanceof Error ? err.message : String(err);
          let userFriendly = "Unable to connect to the spatial intelligence engine at this moment.";
          let issueType = "Temporary service interruption";

          if (errMsg.includes("429")) {
            userFriendly = "Traffic limit reached. Too many requests were sent in a short period.";
            issueType = "Rate limit threshold reached (HTTP 429)";
          } else if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) {
            userFriendly = "Could not establish a connection with the spatial analytical service.";
            issueType = "Network connectivity timeout";
          } else if (errMsg.includes("504") || errMsg.includes("Gateway")) {
            userFriendly = "The geospatial calculation took longer than expected to complete.";
            issueType = "Gateway response timeout (HTTP 504)";
          } else if (errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503")) {
            userFriendly = "The spatial intelligence engine is temporarily undergoing maintenance.";
            issueType = "Service temporarily unavailable";
          }

          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
              next[lastIdx] = {
                role: "assistant",
                text: `⚠️ **Technical Issue**: ${userFriendly}\n\n*Technical issue type: ${issueType}. Please retry shortly.*`,
                isStreaming: false,
                error: true,
              };
            }
            return next;
          });
        }
      } finally {
        setLoading(false);
        setCurrentStageMessage(null);
        abortControllerRef.current = null;
      }
    },
    [activeModelId, zone, messages, loading]
  );

  const handleRetry = useCallback(() => {
    if (lastQuestionRef.current) {
      send(lastQuestionRef.current);
    }
  }, [send]);

  // Contextual suggested questions
  const dynamicPresets = zone
    ? [
        `Why is this location classified as ${zone.cls} susceptibility?`,
        "Which factor contributes most to the score at these coordinates?",
        "What are the limiting criteria at this location?",
      ]
    : [
        "How do Flood AHP and Landslide MCDA models compare?",
        `What criteria and weights are configured for the ${hazardName} model?`,
        "What is the Consistency Ratio (CR) of this model and is it valid?",
      ];

  const panelContent = (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden select-none">
      {/* Header — Strictly "MCGSE AI" with status pill, NO extra sub-names */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--c-accent-dim)",
              border: "1px solid var(--c-accent)",
              color: "var(--c-accent)",
            }}
          >
            <IconBot size={14} />
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--c-text)",
                letterSpacing: "0.02em",
              }}
            >
              MCGSE AI
            </span>

            {aiHealth?.model_installed ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Ready
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Grounded
              </span>
            )}
          </div>
        </div>

        <Btn onClick={onClose} className="w-7 h-7 cursor-pointer" title="Close assistant (Esc)">
          <IconX size={13} />
        </Btn>
      </div>

      {/* Secondary Context Bar — Clean, no repetitive sub-names */}
      <div
        className="px-4 py-1.5 flex-shrink-0 flex items-center justify-between gap-2 text-xs"
        style={{
          background: "var(--c-panel)",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
          {zone ? (
            <span className="font-mono text-[var(--c-accent)] truncate">
              📍 Point: {zone.lat.toFixed(3)}°N, {zone.lng.toFixed(3)}°E (Score {zone.score.toFixed(2)})
            </span>
          ) : (
            <span className="font-mono text-[var(--c-text3)]">
              Statewide Spatial Analysis
            </span>
          )}
        </div>

        {loading && (
          <button
            onClick={handleStopGenerating}
            className="px-2 py-0.5 rounded text-[10px] font-mono text-red-400 border border-red-500/30 hover:bg-red-500/10 cursor-pointer transition-colors"
          >
            Stop
          </button>
        )}
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
                    msg.role === "user"
                      ? "var(--c-accent)"
                      : msg.error
                      ? "rgba(239, 68, 68, 0.4)"
                      : "var(--c-border)"
                  }`,
                }}
              >
                {msg.text ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: `<p style="margin:0">${formatMarkdown(msg.text)}</p>`,
                    }}
                  />
                ) : (
                  msg.isStreaming && (
                    <span className="text-[11px] text-[var(--c-text3)] italic">
                      {currentStageMessage || "Thinking..."}
                    </span>
                  )
                )}

                {/* Collapsible Evidence Accordion */}
                {msg.evidence && (
                  <EvidenceAccordion
                    evidence={msg.evidence}
                    items={msg.items}
                    warnings={msg.warnings}
                  />
                )}
              </div>

              {/* Action Buttons or Retry */}
              {msg.error ? (
                <div className="flex items-center gap-2 pl-1 pt-0.5">
                  <button
                    onClick={handleRetry}
                    className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <IconRefresh size={10} />
                    <span>Retry Question</span>
                  </button>
                </div>
              ) : (
                msg.actions &&
                msg.actions.length > 0 && (
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
                )
              )}
            </div>
          </div>
        ))}

        {/* Live event-driven activity status bar */}
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-accent)] animate-ping" />
              <span className="text-[11px] text-[var(--c-text2)] font-mono">
                {currentStageMessage || "Processing spatial query..."}
              </span>
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
                ? `Ask about point (${zone.lat.toFixed(3)}°N, ${zone.lng.toFixed(3)}°E)...`
                : "Ask MCGSE AI about criteria, weights, statistics…"
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
            title="Send query to MCGSE AI"
          >
            <IconSend size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: "var(--c-text3)" }}>
          <div className="flex items-center gap-1">
            <IconInfo size={10} />
            <span>Evidence-grounded spatial intelligence</span>
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
