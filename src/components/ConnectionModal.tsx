import { useState } from "react";
import { getApiBaseUrl, setApiBaseUrl, resetApiBaseUrl } from "../lib/api/client";
import { IconX, IconCheck } from "../icons";

interface Props {
  open: boolean;
  onClose: () => void;
  status: "connected" | "connecting" | "offline";
  onReconnect?: () => void;
}

export default function ConnectionModal({ open, onClose, status, onReconnect }: Props) {
  const [currentUrl, setCurrentUrl] = useState(getApiBaseUrl());
  const [inputUrl, setInputUrl] = useState(getApiBaseUrl());
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://geospatial-suitability-web.dssintern1.workers.dev";
  const mobileShareUrl = currentUrl ? `${origin}/?api=${encodeURIComponent(currentUrl)}` : origin;

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(mobileShareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      /* clipboard write failed */
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      /* clipboard write failed */
    }
  };

  const handleSave = () => {
    const clean = inputUrl.trim().replace(/\/+$/, "");
    setApiBaseUrl(clean);
    setCurrentUrl(clean);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    onReconnect?.();
  };

  const handleReset = () => {
    resetApiBaseUrl();
    const fresh = getApiBaseUrl();
    setInputUrl(fresh);
    setCurrentUrl(fresh);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    onReconnect?.();
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md rounded-2xl p-5 shadow-2xl border"
        style={{
          background: "var(--c-surface)",
          borderColor: "var(--c-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === "connected"
                  ? "bg-[#00c896]"
                  : status === "connecting"
                  ? "bg-[#f59e0b] animate-pulse"
                  : "bg-[#ef4444]"
              }`}
            />
            <h3
              className="text-sm font-semibold text-[var(--c-text)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Backend & Tunnel Connection
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--c-text3)] hover:text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
          >
            <IconX size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          {/* Status info */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
            style={{
              background: "var(--c-panel)",
              border: "1px solid var(--c-border)",
            }}
          >
            <span className="text-[var(--c-text3)]">Connection Status</span>
            <span
              className={`font-semibold capitalize ${
                status === "connected"
                  ? "text-[#00c896]"
                  : status === "connecting"
                  ? "text-[#f59e0b]"
                  : "text-[#ef4444]"
              }`}
            >
              {status === "connected" ? "● Connected (Live)" : status === "connecting" ? "◌ Connecting…" : "○ Offline"}
            </span>
          </div>

          {/* Active Backend URL */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--c-text3)] mb-1">
              Active API Base URL
            </label>
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-[var(--c-text)]"
              style={{
                background: "var(--c-panel)",
                border: "1px solid var(--c-border)",
              }}
            >
              <span className="truncate pr-2">{currentUrl || "None (same-origin fallback)"}</span>
              {currentUrl && (
                <button
                  onClick={handleCopyUrl}
                  className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded text-[var(--c-accent)] hover:bg-[var(--c-accent-dim)] transition-colors cursor-pointer"
                >
                  {copiedUrl ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Share Link */}
          <div
            className="p-3 rounded-xl border border-[var(--c-border)]"
            style={{ background: "rgba(136, 181, 154, 0.05)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[var(--c-text)]">
                Connect from Phone / Other Devices
              </span>
              <button
                onClick={handleCopyShare}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
                style={{
                  background: copiedShare ? "#00c896" : "var(--c-accent)",
                  color: "var(--c-base)",
                }}
              >
                {copiedShare ? (
                  <>
                    <IconCheck size={11} /> Copied!
                  </>
                ) : (
                  "Copy Link"
                )}
              </button>
            </div>
            <p className="text-[11px] text-[var(--c-text2)] leading-relaxed">
              Open this link on your phone. It contains the <code className="font-mono text-[var(--c-accent)]">?api=...</code> parameter so your phone automatically syncs with the current tunnel without setting any variables!
            </p>
          </div>

          {/* Override URL input */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--c-text3)] mb-1">
              Change or Override Tunnel URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://xxxx.trycloudflare.com or https://xxxx.ngrok-free.dev"
                className="flex-1 h-9 px-3 rounded-lg text-xs font-mono outline-none text-[var(--c-text)] placeholder:text-[var(--c-text3)]"
                style={{
                  background: "var(--c-panel)",
                  border: "1px solid var(--c-border)",
                }}
              />
              <button
                onClick={handleSave}
                className="h-9 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  background: "var(--c-accent)",
                  color: "var(--c-base)",
                }}
              >
                {savedSuccess ? "Saved!" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--c-border)]">
          <button
            onClick={handleReset}
            className="text-[11px] text-[var(--c-text3)] hover:text-[var(--c-text)] transition-colors cursor-pointer"
          >
            Reset to build default
          </button>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-xs font-medium text-[var(--c-text)] hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
            style={{ border: "1px solid var(--c-border)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
