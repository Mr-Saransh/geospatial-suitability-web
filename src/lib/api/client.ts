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

  // Tiles URL builder
  getTileUrlTemplate: (layerId: string) => {
    return `${getApiBaseUrl()}/api/v1/tiles/${encodeURIComponent(layerId)}/{z}/{x}/{y}.png?ngrok-skip-browser-warning=true`;
  },
};
