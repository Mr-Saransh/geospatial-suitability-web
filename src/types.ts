export type SuitClass = 'very-high' | 'high' | 'moderate' | 'low' | 'very-low';
export type RightTab = 'overview' | 'criteria' | 'statistics' | 'evidence' | 'metadata';
export type MobileSheet = 'layers' | 'analyze' | 'ai' | 'export' | 'more' | null;
export type AppModal = 'export' | null;
export type BasemapId = 'dark' | 'satellite' | 'topo' | 'streets';

export interface Layer {
  id: string; // product_id
  name: string; // unique display_name
  layer_name?: string;
  layer_type?: string;
  layerType?: 'FACTOR' | 'RATING' | 'RESULT' | 'QUALITY' | string;
  criterion_id?: string;
  group: 'composite' | 'topographic' | 'hydrological' | 'environmental' | 'quality' | string;
  groupLabel: string;
  subgroup?: string;
  visible: boolean;
  opacity: number;
  unit?: string;
  source: string;
  resolution?: string;
  date?: string;
  description: string;
  scoring_mode?: string | null;
}

export interface Zone {
  id: string;
  label: string;
  cls: SuitClass;
  score: number;
  classifiedValue?: number;
  lat: number;
  lng: number;
  district: string;
  region: string;
  area: number;
  finalStatus?: 'VALID' | 'PARTIAL_EVIDENCE' | 'NODATA' | 'OUTSIDE_ANALYSIS_AREA' | string;
  evidenceCount?: number;
  evidenceTotal?: number;
  missingCriteria?: string[];
  scoringMode?: string;
  strictScore?: number | null;
  availableEvidenceScore?: number | null;
  criteria?: CriterionRow[];
}

export interface CriterionRow {
  name: string;
  criterionId: string;
  weight: number;
  rawScore: number | null;
  rating: number | null;
  contribution: number | null;
  unit?: string;
  cls: 'positive' | 'limiting';
  layerId: string;
  source: string;
  evidence: string;
  status?: 'VALID' | 'NODATA' | 'OUTSIDE_ANALYSIS_AREA' | string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  text: string;
  actions?: Array<{ label: string; type: 'layer' | 'evidence' | 'stats'; target: string }>;
}

export interface SuitMeta {
  label: string;
  color: string;
  bg: string;
  range: string;
  textColor: string;
}
