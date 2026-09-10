export type SuitClass = 'very-high' | 'high' | 'moderate' | 'low' | 'very-low';
export type RightTab = 'overview' | 'criteria' | 'statistics' | 'evidence' | 'metadata';
export type MobileSheet = 'layers' | 'analyze' | 'ai' | 'export' | 'more' | null;
export type AppModal = 'export' | null;
export type BasemapId = 'dark' | 'satellite' | 'topo' | 'streets';

export interface Layer {
  id: string;
  name: string;
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
  points: string;
  cx: number;
  cy: number;
  district: string;
  region: string;
  area: number;
}

export interface CriterionRow {
  name: string;
  weight: number;
  rawScore: number;
  contribution: number;
  cls: 'positive' | 'limiting';
  layerId: string;
  source: string;
  evidence: string;
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
