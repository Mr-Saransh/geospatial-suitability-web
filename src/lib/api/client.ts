/**
 * API client for the MCGSE Web-GIS Backend
 */
import type {
  HealthResponse,
  ModelSummary,
  ModelDetail,
  LayerInfo,
  PointInspectionResponse,
  AnalysisStatistics,
  PackageMetadata,
} from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      throw new Error(`API error ${res.status}: ${res.statusText} — ${errorBody}`)
    }
    return (await res.json()) as T
  } catch (err: any) {
    console.error(`Request failed for ${url}:`, err)
    throw err
  }
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>('/api/v1/health'),

  // Metadata
  getPackageMetadata: () => request<PackageMetadata>('/api/v1/metadata/package'),
  getAnalysisMetadata: (analysisId: string) =>
    request<Record<string, any>>(`/api/v1/analyses/${encodeURIComponent(analysisId)}/metadata`),
  getBoundary: () => request<any>('/api/v1/boundary'),

  // Models
  getModels: () => request<ModelSummary[]>('/api/v1/models'),
  getModel: (modelId: string) =>
    request<ModelDetail>(`/api/v1/models/${encodeURIComponent(modelId)}`),

  // Layers
  getLayers: () => request<LayerInfo[]>('/api/v1/layers'),
  getLayer: (layerId: string) =>
    request<LayerInfo>(`/api/v1/layers/${encodeURIComponent(layerId)}`),

  // Analyses
  inspectPoint: (modelId: string, lat: number, lon: number) =>
    request<PointInspectionResponse>(
      `/api/v1/analyses/${encodeURIComponent(modelId)}/point?lat=${lat}&lon=${lon}`
    ),
  getStatistics: (modelId: string) =>
    request<AnalysisStatistics>(
      `/api/v1/analyses/${encodeURIComponent(modelId)}/statistics`
    ),

  // Tiles URL builder
  getTileUrlTemplate: (layerId: string) => {
    return `${BASE_URL}/api/v1/tiles/${encodeURIComponent(layerId)}/{z}/{x}/{y}.png`
  },
}
