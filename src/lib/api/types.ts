/**
 * TypeScript definitions matching backend API schemas for the Canonical Package.
 */

export interface HealthResponse {
  status: string
  package_found: boolean
  package_status: string
  package_version: string
  model_id: string
  source_run_id: number
  factor_count: number
  rating_count: number
  result_count: number
  quality_count: number
  total_published_rasters: number
  boundary_status: string
  manifest_status: string
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
  scoring_modes?: string[]
  minimum_valid_criteria?: number
  metadata: Record<string, any>
}

export interface LayerInfo {
  product_id: string
  display_name: string
  criterion_id: string
  type: 'FACTOR' | 'RATING' | 'RESULT' | 'QUALITY' | string
  layer_type: string
  category: string
  model: string
  unit: string
  crs: string
  resolution: string
  resolution_x: number
  resolution_y: number
  width: number
  height: number
  bounds: number[]
  nodata_value: string
  scoring_mode?: string | null
  status: string
  relative_path: string
  alias_of?: string | null
  valid_pixel_pct: number
  description: string
  layer_id?: string
  layer_name?: string
}

export interface CriterionSample {
  criterion: string
  display_name?: string
  raw_value: number | null
  unit: string
  rating: number | null
  weight: number
  contribution: number | null
  status: 'VALID' | 'NODATA' | 'OUTSIDE_ANALYSIS_AREA' | string
  nodata_reason?: string | null
  source: string
}

export interface PointInspectionResponse {
  lat: number
  lon: number
  model_id: string
  continuous_score: number | null
  classified_value: number | null
  class_label: string | null
  final_status: 'VALID' | 'PARTIAL_EVIDENCE' | 'NODATA' | 'OUTSIDE_ANALYSIS_AREA' | string
  evidence_count: number
  evidence_total: number
  missing_criteria: string[]
  scoring_mode?: string | null
  strict_score?: number | null
  available_evidence_score?: number | null
  criteria: CriterionSample[]
}

export interface ClassDistribution {
  class_value: number
  label: string
  pixel_count: number
  percentage: number
  area_km2: number
}

export interface EvidenceDistributionItem {
  criteria_count: number
  label: string
  pixel_count: number
  percentage: number
}

export interface AnalysisStatistics {
  model_id: string
  source_run_id?: number
  scoring_mode?: string
  crs: string
  resolution_m?: number | null
  total_pixels: number
  valid_pixels: number
  nodata_pixels: number
  valid_coverage_pct: number
  nodata_coverage_pct: number
  score_min: number | null
  score_max: number | null
  score_mean: number | null
  score_std: number | null
  class_distribution: ClassDistribution[]
  evidence_distribution?: EvidenceDistributionItem[]
}

export interface PackageMetadata {
  package_status: string
  package_version: string
  state_name: string
  model_id: string
  source_run_id: number
  published_at: string
  factor_count: number
  rating_count: number
  result_count: number
  quality_count: number
  total_published_rasters: number
  boundary_status: string
  manifest_status: string
  scoring_modes: string[]
  minimum_valid_criteria: number
  aliases: Record<string, any>
  reproducibility: Record<string, any>
  provenance: Record<string, any>
  validation_status: string
  package_type?: string
  spec_version?: string
  layers_count?: number
  rasters_count?: number
  vectors_count?: number
}
