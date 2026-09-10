import type { Layer, Zone, CriterionRow, SuitMeta, SuitClass } from './types';

export const SUIT_META: Record<SuitClass, SuitMeta> = {
  'very-high': { label: 'Very High',  color: '#00c896', bg: 'rgba(0,200,150,0.18)',  range: '0.75–1.00', textColor: '#00c896' },
  'high':      { label: 'High',       color: '#4ade80', bg: 'rgba(74,222,128,0.15)', range: '0.50–0.75', textColor: '#4ade80' },
  'moderate':  { label: 'Moderate',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', range: '0.25–0.50', textColor: '#fbbf24' },
  'low':       { label: 'Low',        color: '#f97316', bg: 'rgba(249,115,22,0.15)', range: '0.10–0.25', textColor: '#f97316' },
  'very-low':  { label: 'Very Low',   color: '#ef4444', bg: 'rgba(239,68,68,0.14)',  range: '0.00–0.10', textColor: '#ef4444' },
};

export const SUIT_ORDER: SuitClass[] = ['very-high','high','moderate','low','very-low'];

export const LAYERS: Layer[] = [
  {
    id: 'suitability', name: 'Overall Suitability', group: 'composite', groupLabel: 'Composite',
    visible: true, opacity: 82,
    source: 'AHP-weighted composite', resolution: '30 m', date: '2024-11',
    description: 'Multi-criteria composite suitability index derived using Analytic Hierarchy Process weighting across 11 biophysical criteria.',
  },
  {
    id: 'slope', name: 'Slope', group: 'topographic', groupLabel: 'Topographic',
    visible: false, opacity: 70, unit: '°',
    source: 'SRTM 30 m DEM (NASA, 2000)', resolution: '30 m', date: '2000',
    description: 'Terrain slope derived from SRTM DEM. Gentle slopes (0–5°) score highest for groundwater infiltration.',
  },
  {
    id: 'elevation', name: 'Elevation', group: 'topographic', groupLabel: 'Topographic',
    visible: false, opacity: 70, unit: 'm asl',
    source: 'SRTM 30 m DEM (NASA, 2000)', resolution: '30 m', date: '2000',
    description: 'Digital elevation model. Mid-elevation zones (150–400 m) typically favour recharge potential.',
  },
  {
    id: 'curvature', name: 'Curvature', group: 'topographic', groupLabel: 'Topographic',
    visible: false, opacity: 70, unit: '1/m',
    source: 'SRTM 30 m DEM (NASA, 2000)', resolution: '30 m', date: '2000',
    description: 'Plan and profile curvature from DEM second derivatives. Concave surfaces increase recharge.',
  },
  {
    id: 'rivers', name: 'Distance to Rivers', group: 'hydrological', groupLabel: 'Hydrological',
    visible: false, opacity: 70, unit: 'km',
    source: 'OpenStreetMap Hydrology + SRTM', resolution: '30 m', date: '2024',
    description: 'Euclidean distance to perennial river network. Proximity <2 km is classified as highly suitable.',
  },
  {
    id: 'twi', name: 'TWI', group: 'hydrological', groupLabel: 'Hydrological',
    visible: false, opacity: 70,
    source: 'SRTM 30 m DEM (NASA, 2000)', resolution: '30 m', date: '2000',
    description: 'Topographic Wetness Index (ln(As/tanβ)). Higher TWI indicates greater potential for moisture accumulation.',
  },
  {
    id: 'flow', name: 'Flow Accumulation', group: 'hydrological', groupLabel: 'Hydrological',
    visible: false, opacity: 70,
    source: 'SRTM 30 m DEM (NASA, 2000)', resolution: '30 m', date: '2000',
    description: 'D8 flow accumulation. High values indicate natural drainage corridors and recharge zones.',
  },
  {
    id: 'drainage', name: 'Drainage Density', group: 'hydrological', groupLabel: 'Hydrological',
    visible: false, opacity: 70, unit: 'km/km²',
    source: 'SRTM + OSM Hydrology', resolution: '250 m', date: '2024',
    description: 'Total stream length per unit area. Low density favours infiltration over surface runoff.',
  },
  {
    id: 'rainfall', name: 'Rainfall', group: 'hydrological', groupLabel: 'Hydrological',
    visible: false, opacity: 70, unit: 'mm/yr',
    source: 'CHIRPS v2.0 (UCSB, 2000–2023)', resolution: '5 km', date: '2000–2023',
    description: '24-year mean annual precipitation from CHIRPS. 1,400–2,200 mm/yr is optimal for recharge.',
  },
  {
    id: 'lulc', name: 'LULC', group: 'environmental', groupLabel: 'Environmental',
    visible: false, opacity: 70,
    source: 'ESA WorldCover 10 m (2021)', resolution: '10 m', date: '2021',
    description: 'Land use / land cover classification. Forest and shrubland score highest for infiltration.',
  },
  {
    id: 'soil', name: 'Soil Type', group: 'environmental', groupLabel: 'Environmental',
    visible: false, opacity: 70,
    source: 'SoilGrids v2.0 (ISRIC, 2020)', resolution: '250 m', date: '2020',
    description: 'Soil hydraulic conductivity and texture class. Sandy loam and gravelly soils score highest.',
  },
  {
    id: 'ndvi', name: 'NDVI', group: 'environmental', groupLabel: 'Environmental',
    visible: false, opacity: 70,
    source: 'Sentinel-2 L2A annual composite (2024)', resolution: '10 m', date: '2024',
    description: 'Normalised Difference Vegetation Index. Dense vegetation indicates deep-rooted infiltration potential.',
  },
];

export const ZONES: Zone[] = [
  { id: 'z1',  label: 'A',  cls: 'very-high', score: 0.88, district: 'Jalpaiguri Sadar', region: 'Jalpaiguri', area: 142.3, cx: 19, cy: 17,
    points: '8,8 20,5 28,8 30,18 24,26 14,28 6,22 5,14' },
  { id: 'z2',  label: 'B',  cls: 'high',      score: 0.67, district: 'Matigara',        region: 'Darjeeling',  area: 98.7,  cx: 46, cy: 14,
    points: '34,6 48,4 56,8 56,20 48,26 36,24 30,16' },
  { id: 'z3',  label: 'C',  cls: 'moderate',  score: 0.44, district: 'Siliguri',        region: 'Darjeeling',  area: 76.2,  cx: 71, cy: 15,
    points: '60,8 74,6 80,14 78,24 66,28 58,20 56,12' },
  { id: 'z4',  label: 'D',  cls: 'very-high', score: 0.91, district: 'Nagrakata',       region: 'Jalpaiguri',  area: 189.4, cx: 15, cy: 40,
    points: '4,30 16,28 24,32 26,46 20,52 8,50 2,42' },
  { id: 'z5',  label: 'E',  cls: 'high',      score: 0.72, district: 'Gorubathan',      region: 'Jalpaiguri',  area: 163.1, cx: 43, cy: 38,
    points: '28,28 48,26 56,32 56,46 46,52 30,50 22,42' },
  { id: 'z6',  label: 'F',  cls: 'low',       score: 0.19, district: 'Kalimpong',       region: 'Kalimpong',   area: 54.8,  cx: 70, cy: 38,
    points: '60,28 76,26 82,34 80,48 68,52 60,44 56,36' },
  { id: 'z7',  label: 'G',  cls: 'moderate',  score: 0.41, district: 'Alipurduar',      region: 'Alipurduar',  area: 112.6, cx: 16, cy: 62,
    points: '6,54 20,52 28,58 26,70 18,76 6,72 2,62' },
  { id: 'z8',  label: 'H',  cls: 'very-high', score: 0.83, district: 'Madarihat',       region: 'Alipurduar',  area: 201.8, cx: 44, cy: 62,
    points: '30,52 52,50 58,58 56,72 44,78 28,74 22,64' },
  { id: 'z9',  label: 'I',  cls: 'high',      score: 0.61, district: 'Birpara',         region: 'Alipurduar',  area: 134.5, cx: 72, cy: 62,
    points: '62,52 78,50 86,58 84,72 72,76 60,68 58,58' },
  { id: 'z10', label: 'J',  cls: 'very-low',  score: 0.07, district: 'Dhupguri',        region: 'Jalpaiguri',  area: 42.3,  cx: 17, cy: 84,
    points: '8,78 24,76 28,84 22,92 10,92 4,84' },
  { id: 'z11', label: 'K',  cls: 'low',       score: 0.22, district: 'Malbazar',        region: 'Jalpaiguri',  area: 88.1,  cx: 46, cy: 84,
    points: '34,78 54,76 60,84 58,92 40,94 30,88' },
  { id: 'z12', label: 'L',  cls: 'moderate',  score: 0.39, district: 'Metelli',         region: 'Alipurduar',  area: 71.4,  cx: 74, cy: 84,
    points: '64,78 82,76 88,84 84,92 68,92 60,86' },
];

export const CRITERIA: CriterionRow[] = [
  { name: 'Slope',              weight: 0.22, rawScore: 0.91, contribution: 0.200, cls: 'positive', layerId: 'slope',    source: 'SRTM 30 m DEM',      evidence: 'Slope ≤5° — optimal for infiltration and recharge. Classified as "Very Suitable".' },
  { name: 'Elevation',          weight: 0.18, rawScore: 0.84, contribution: 0.151, cls: 'positive', layerId: 'elevation', source: 'SRTM 30 m DEM',      evidence: 'Elevation 312 m asl — within 150–400 m optimal range, above flood-prone lowlands.' },
  { name: 'TWI',                weight: 0.15, rawScore: 0.78, contribution: 0.117, cls: 'positive', layerId: 'twi',      source: 'SRTM D8 flow',       evidence: 'TWI value 4.2 — low-to-moderate waterlogging risk with sufficient moisture retention.' },
  { name: 'Distance to Rivers', weight: 0.13, rawScore: 0.42, contribution: 0.055, cls: 'limiting', layerId: 'rivers',   source: 'OSM + SRTM',         evidence: 'Nearest river 4.7 km away — exceeds 2 km optimal threshold. Primary constraint.' },
  { name: 'Rainfall',           weight: 0.11, rawScore: 0.87, contribution: 0.096, cls: 'positive', layerId: 'rainfall', source: 'CHIRPS v2.0',        evidence: 'Annual mean 1,840 mm (2000–2023). Monsoon Jun–Sep provides peak recharge window.' },
  { name: 'Curvature',          weight: 0.08, rawScore: 0.61, contribution: 0.049, cls: 'positive', layerId: 'curvature',source: 'SRTM 30 m DEM',      evidence: 'Slightly concave plan curvature — promotes convergent flow and infiltration.' },
  { name: 'LULC',               weight: 0.07, rawScore: 0.55, contribution: 0.039, cls: 'limiting', layerId: 'lulc',     source: 'ESA WorldCover 10 m',evidence: 'Mixed forest–agricultural transition zone. Land-use conflict risk identified.' },
  { name: 'Soil Type',          weight: 0.04, rawScore: 0.73, contribution: 0.029, cls: 'positive', layerId: 'soil',     source: 'SoilGrids v2.0',     evidence: 'Sandy loam — hydraulic conductivity 18–25 mm/hr. High infiltration capacity.' },
  { name: 'NDVI',               weight: 0.02, rawScore: 0.80, contribution: 0.016, cls: 'positive', layerId: 'ndvi',     source: 'Sentinel-2 2024',    evidence: 'NDVI 0.71 — dense canopy cover supports deep-root infiltration network.' },
];

export const CLASS_DIST = [
  { name: 'Very High', value: 38, color: '#00c896', area: 541.2 },
  { name: 'High',      value: 31, color: '#4ade80', area: 441.0 },
  { name: 'Moderate',  value: 18, color: '#fbbf24', area: 256.2 },
  { name: 'Low',       value: 9,  color: '#f97316', area: 128.1 },
  { name: 'Very Low',  value: 4,  color: '#ef4444', area: 56.9  },
];

export const SCORE_HIST = [
  { bin: '0.0',  count: 124  },
  { bin: '0.1',  count: 312  },
  { bin: '0.2',  count: 628  },
  { bin: '0.3',  count: 1040 },
  { bin: '0.4',  count: 1580 },
  { bin: '0.5',  count: 2210 },
  { bin: '0.6',  count: 2840 },
  { bin: '0.7',  count: 3120 },
  { bin: '0.8',  count: 2760 },
  { bin: '0.9',  count: 1640 },
  { bin: '1.0',  count: 412  },
];

export const MODELS = [
  'Groundwater Recharge Potential v2.1',
  'Urban Expansion Suitability v1.3',
  'Flood Hazard Risk Index v3.0',
  'Solar Farm Site Selection v2.0',
  'Agricultural Land Suitability v1.8',
  'Eco-Sensitive Zone Assessment v1.1',
];

export const AI_PRESETS: Array<{ q: string; context?: string }> = [
  { q: 'Why is this area highly suitable?',             context: 'zone' },
  { q: 'What are the main limiting factors?',           context: 'zone' },
  { q: 'Which criterion has the highest AHP weight?',   context: 'model' },
  { q: 'Compare Sector D and Sector H',                 context: 'zone' },
  { q: 'What evidence supports the slope assessment?',  context: 'layer' },
  { q: 'Show areas where rainfall is a constraint',     context: 'layer' },
  { q: 'Explain the AHP methodology used',              context: 'model' },
];

export const AI_ANSWERS: Record<string, { text: string; actions?: Array<{ label: string; type: 'layer' | 'evidence' | 'stats'; target: string }> }> = {
  'Why is this area highly suitable?': {
    text: `This zone scores 0.88/1.00 primarily because three top-weighted criteria perform at near-maximum levels:\n\n• **Slope (w=0.22):** At 2.4°, slope falls within the optimal 0–5° class, contributing 0.200 to the composite — the largest single contribution.\n• **Elevation (w=0.18):** At 312 m asl, the area sits above flood-prone lowlands while remaining within the 150–400 m recharge-optimal range, contributing 0.151.\n• **TWI (w=0.15):** A wetness index of 4.2 indicates moderate moisture retention without waterlogging risk, contributing 0.117.\n\nTogether these three criteria account for 55% of the composite score.`,
    actions: [
      { label: 'Show Slope Layer', type: 'layer', target: 'slope' },
      { label: 'View Criteria Tab', type: 'stats', target: 'criteria' },
    ],
  },
  'What are the main limiting factors?': {
    text: `Two criteria are classified as limiting for this zone:\n\n1. **Distance to Rivers (w=0.13, score=0.42):** The nearest perennial stream is 4.7 km away — exceeding the 2 km optimal threshold. This is the primary constraint, reducing the composite score by approximately 0.058 compared to an optimal configuration.\n\n2. **LULC (w=0.07, score=0.55):** Mixed forest–agricultural transition land cover introduces land-use conflict risk and reduces infiltration pathway continuity.\n\nThese two criteria together cap the theoretical maximum achievable score at approximately 0.93 under current land-use conditions.`,
    actions: [
      { label: 'Show River Distance Layer', type: 'layer', target: 'rivers' },
      { label: 'Show LULC Layer', type: 'layer', target: 'lulc' },
      { label: 'View Evidence', type: 'evidence', target: 'evidence' },
    ],
  },
  'Which criterion has the highest AHP weight?': {
    text: `**Slope** carries the highest AHP weight (w=0.22) in this model configuration. This reflects the expert panel consensus that terrain gradient is the primary determinant of infiltration opportunity and surface runoff velocity.\n\nThe AHP pairwise comparison matrix produced a Consistency Ratio (CR) of 0.043 — well within the acceptable threshold of 0.10 — confirming the weight vector is logically consistent.\n\nWeight hierarchy: Slope (0.22) > Elevation (0.18) > TWI (0.15) > River Distance (0.13) > Rainfall (0.11) > Curvature (0.08) > LULC (0.07) > Soil (0.04) > NDVI (0.02).`,
    actions: [
      { label: 'View AHP Configuration', type: 'stats', target: 'metadata' },
    ],
  },
  default: {
    text: `I have loaded scientific context for the active Groundwater Recharge Potential model (West Bengal — Jalpaiguri region, run GRP-2024-WB-0042).\n\nI can analyse:\n• Suitability factors for specific zones\n• Criterion contributions and AHP weights\n• Evidence behind layer classifications\n• Comparisons between study areas\n• Methodology and validation metrics\n\nPlease select a zone on the map or ask a specific analytical question.`,
  },
};
