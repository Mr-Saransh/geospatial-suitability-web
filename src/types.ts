export type SuitClass = 'very-high' | 'high' | 'moderate' | 'low' | 'very-low';
export type RightTab = 'overview' | 'criteria' | 'statistics' | 'evidence' | 'metadata';
export type MobileSheet = 'layers' | 'analyze' | 'ai' | 'export' | 'more' | null;
export type AppModal = 'export' | null;
export type BasemapId = 'dark' | 'satellite' | 'topo' | 'streets';

export interface Layer {
  id: string;
  name: string;
  layer_name?: string;
  layer_type?: 'factor_raster' | 'rating_raster' | 'result_raster' | string;
  criterion_id?: string;
  group: 'composite' | 'topographic' | 'hydrological' | 'environmental';
  groupLabel: string;
  visible: boolean;
  opacity: number;
  unit?: string;
  source: string;
  resolution?: string;
  date?: string;
  description: string;
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
  finalStatus?: string;
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
  status?: string;
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
