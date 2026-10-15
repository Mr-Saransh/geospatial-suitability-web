/**
 * API client for the MCGSE Web-GIS Backend
 *
 * Resolves the backend URL at runtime:
 *  1. localStorage("mcgse_api_url")  — set by user via Settings
 *  2. VITE_API_BASE_URL              — baked in at build time
 *  3. "" (same-origin fallback)
 */
import type {
  HealthResponse,
  ModelSummary,
  ModelDetail,
  LayerInfo,
  PointInspectionResponse,
  AnalysisStatistics,
  PackageMetadata,
  AIAssistantRequest,
  AIAssistantResponse,
  AIHealthResponse,
} from "./types";

const STORAGE_KEY = "mcgse_api_url";

/** Return the currently active backend base URL (no trailing slash). */
export function getApiBaseUrl(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored.replace(/\/+$/, "");
  } catch { /* localStorage unavailable */ }
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
}

/** Persist a new backend URL (used by the settings UI). */
export function setApiBaseUrl(url: string): void {
  try {
    const clean = url.trim().replace(/\/+$/, "");
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* localStorage unavailable */ }
}

/** Clear the stored override so the build-time default is used again. */
export function resetApiBaseUrl(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${res.statusText} — ${errorBody}`);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    console.error(`Request failed for ${url}:`, err);
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>("/api/v1/health"),

  // Metadata
  getPackageMetadata: () => request<PackageMetadata>("/api/v1/metadata/package"),
  getAnalysisMetadata: (analysisId: string) =>
    request<Record<string, unknown>>(`/api/v1/analyses/${encodeURIComponent(analysisId)}/metadata`),
  getBoundary: () => request<GeoJSON.FeatureCollection | null>("/api/v1/boundary"),

  // Models
  getModels: () => request<ModelSummary[]>("/api/v1/models"),
  getModel: (modelId: string) =>
    request<ModelDetail>(`/api/v1/models/${encodeURIComponent(modelId)}`),

  // Layers
  getLayers: (modelId?: string) =>
    request<LayerInfo[]>(
      modelId ? `/api/v1/layers?model_id=${encodeURIComponent(modelId)}` : "/api/v1/layers",
    ),
  getLayer: (layerId: string) =>
    request<LayerInfo>(`/api/v1/layers/${encodeURIComponent(layerId)}`),

  // Analyses
  inspectPoint: (modelId: string, lat: number, lon: number) =>
    request<PointInspectionResponse>(
      `/api/v1/analyses/${encodeURIComponent(modelId)}/point?lat=${lat}&lon=${lon}`,
    ),
  getStatistics: (modelId: string) =>
    request<AnalysisStatistics>(`/api/v1/analyses/${encodeURIComponent(modelId)}/statistics`),

  // AI Assistant (Evidence-Grounded Local Ollama V2)
  askAI: (payload: AIAssistantRequest) =>
    request<AIAssistantResponse>("/api/v1/ai/ask", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getAIHealth: () => request<AIHealthResponse>("/api/v1/ai/health"),

  // Streaming AI response with progressive tokens and real backend states
  askAIStream: async (
    payload: AIAssistantRequest,
    callbacks: {
      onStatus?: (ev: import("./types").AIStatusStreamEvent) => void;
      onEvidence?: (ev: import("./types").AIEvidenceStreamEvent) => void;
      onToken?: (text: string) => void;
      onDone?: (ev: import("./types").AIDoneStreamEvent) => void;
      onError?: (err: Error) => void;
    },
    signal?: AbortSignal,
  ) => {
    const url = `${getApiBaseUrl()}/api/v1/ai/ask/stream?ngrok-skip-browser-warning=true`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let errDetail = `Server responded with ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) errDetail = errJson.detail;
      } catch {
        // ignore
      }
      throw new Error(errDetail);
    }

    if (!response.body) {
      throw new Error("No response stream body available");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          let eventType = "message";
          let dataStr = "";

          const lines = part.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.replace("event:", "").trim();
            } else if (line.startsWith("data:")) {
              dataStr += line.replace("data:", "").trim();
            }
          }

          if (dataStr) {
            try {
              const dataObj = JSON.parse(dataStr);
              if (eventType === "status" || dataObj.type === "status") {
                callbacks.onStatus?.(dataObj);
              } else if (eventType === "evidence" || dataObj.type === "evidence") {
                callbacks.onEvidence?.(dataObj);
              } else if (eventType === "token" || dataObj.type === "token") {
                callbacks.onToken?.(dataObj.text);
              } else if (eventType === "done" || dataObj.type === "done") {
                callbacks.onDone?.(dataObj);
              } else if (eventType === "error" || dataObj.type === "error") {
                callbacks.onError?.(new Error(dataObj.detail || "AI stream error"));
              }
            } catch (e) {
              console.debug("Failed to parse SSE JSON chunk:", e, dataStr);
            }
          }
        }
      }
    } catch (err: unknown) {
      if (signal?.aborted) {
        return;
      }
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  },

  // Tiles URL builder
  getTileUrlTemplate: (layerId: string) => {
    return `${getApiBaseUrl()}/api/v1/tiles/${encodeURIComponent(layerId)}/{z}/{x}/{y}.png?ngrok-skip-browser-warning=true`;
  },
};
