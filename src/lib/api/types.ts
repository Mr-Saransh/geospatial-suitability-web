/**
 * TypeScript definitions matching backend API schemas
 */

export interface HealthResponse {
  status: string
  package_found: boolean
  package_path?: string
  model_id?: string
  layers_count: number
}

export interface ModelSummary {
  model_id: string
  name: string
  criterion_count: number
  consistency_ratio: number
}

export interface CriterionWeight {
  criterion_id: string
  weight: number
}

export interface ClassificationRange {
  class_value: number
  label: string
  range_min: number
  range_max: number
}

export interface ModelDetail {
  model_id: string
  name: string
  version: string
  criterion_count: number
  criteria: string[]
  weights: CriterionWeight[]
  consistency_ratio: number
  consistency_index: number
  lambda_max: number
  random_index: number
  classification: ClassificationRange[]
  metadata: Record<string, any>
}

export interface LayerInfo {
  layer_id: string
  layer_name: string
  layer_type: 'factor_raster' | 'rating_raster' | 'result_raster' | string
  criterion_id: string
  model_id: string
  crs: string
  resolution_x: number
  resolution_y: number
  width: number
  height: number
  nodata_value: string
  valid_pixel_pct: number
  description: string
  relative_path: string
}

export interface CriterionSample {
  criterion: string
  raw_value: number | null
  unit: string
  rating: number | null
  weight: number
  contribution: number | null
  status: 'VALID' | 'NODATA' | 'OUT_OF_BOUNDS'
  nodata_reason: string | null
  source: string
}

export interface PointInspectionResponse {
  lat: number
  lon: number
  model_id: string
  continuous_score: number | null
  classified_value: number | null
  class_label: string | null
  final_status: 'VALID' | 'NODATA' | 'OUT_OF_BOUNDS'
  criteria: CriterionSample[]
}

export interface ClassDistribution {
  class_value: number
  label: string
  pixel_count: number
  percentage: number
  area_km2: number
}

export interface AnalysisStatistics {
  model_id: string
  crs: string
  resolution_m: number
  total_pixels: number
  valid_pixels: number
  nodata_pixels: number
  valid_coverage_pct: number
  nodata_coverage_pct: number
  score_min: number
  score_max: number
  score_mean: number
  score_std: number
  class_distribution: ClassDistribution[]
}

export interface PackageMetadata {
  state_name: string
  model_id: string
  published_at: string
  layer_count: number
  factors_count: number
  ratings_count: number
  results_count: number
  crs_list: string[]
  model_info: Record<string, any>
  provenance: Record<string, any>
  reproducibility: Record<string, any>
}
