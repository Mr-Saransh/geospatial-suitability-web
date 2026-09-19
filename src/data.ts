import type { Layer, Zone, CriterionRow, SuitMeta, SuitClass } from './types';

export const SUIT_META: Record<SuitClass, SuitMeta> = {
  'very-high': { label: 'Very High',  color: '#00c896', bg: 'rgba(0,200,150,0.18)',  range: '4.00–5.00', textColor: '#00c896' },
  'high':      { label: 'High',       color: '#4ade80', bg: 'rgba(74,222,128,0.15)', range: '3.00–4.00', textColor: '#4ade80' },
  'moderate':  { label: 'Moderate',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', range: '2.00–3.00', textColor: '#fbbf24' },
  'low':       { label: 'Low',        color: '#f97316', bg: 'rgba(249,115,22,0.15)', range: '1.50–2.00', textColor: '#f97316' },
  'very-low':  { label: 'Very Low',   color: '#ef4444', bg: 'rgba(239,68,68,0.14)',  range: '1.00–1.50', textColor: '#ef4444' },
};

export const SUIT_ORDER: SuitClass[] = ['very-high', 'high', 'moderate', 'low', 'very-low'];

export function scoreToClass(score: number | null): SuitClass {
  if (score === null || isNaN(score)) return 'low';
  if (score >= 4.0) return 'very-high';
  if (score >= 3.0) return 'high';
  if (score >= 2.0) return 'moderate';
  if (score >= 1.5) return 'low';
  return 'very-low';
}

export function classValueToSuitClass(val: number | null): SuitClass {
  switch (val) {
    case 5: return 'very-high';
    case 4: return 'high';
    case 3: return 'moderate';
    case 2: return 'low';
    case 1:
    default: return 'very-low';
  }
}

export const HIMACHAL_LOCATIONS = [
  { name: 'Shimla', lat: 31.1048, lng: 77.1734, district: 'Shimla' },
  { name: 'Kullu', lat: 31.9579, lng: 77.1095, district: 'Kullu' },
  { name: 'Manali', lat: 32.2432, lng: 77.1892, district: 'Kullu' },
  { name: 'Dharamshala', lat: 32.2190, lng: 76.3234, district: 'Kangra' },
  { name: 'Mandi', lat: 31.7087, lng: 76.9320, district: 'Mandi' },
  { name: 'Solan', lat: 30.9045, lng: 77.0967, district: 'Solan' },
  { name: 'Bilaspur', lat: 31.3260, lng: 76.7570, district: 'Bilaspur' },
  { name: 'Hamirpur', lat: 31.6862, lng: 76.5213, district: 'Hamirpur' },
  { name: 'Una', lat: 31.4685, lng: 76.2708, district: 'Una' },
  { name: 'Chamba', lat: 32.5534, lng: 76.1258, district: 'Chamba' },
];

export const CRITERIA_INFO: Record<string, { label: string; group: Layer['group']; groupLabel: string; unit: string; source: string; description: string; evidence: string }> = {
  rainfall: {
    label: 'Annual Rainfall',
    group: 'hydrological',
    groupLabel: 'Hydrological',
    unit: 'mm/yr',
    source: 'CHIRPS v2.0 (UCSB / IMD)',
    description: 'Mean annual precipitation across Himachal Pradesh. Heavy monsoonal precipitation elevates flood risk.',
    evidence: 'High precipitation intensity directly increases peak overland flow and catchment discharge.',
  },
  slope: {
    label: 'Terrain Slope',
    group: 'topographic',
    groupLabel: 'Topographic',
    unit: '°',
    source: 'SRTM 30 m DEM',
    description: 'Surface slope gradient. Flat and low-slope valley bottoms accumulate runoff, creating severe flood inundation.',
    evidence: 'Low slopes (0–5°) impede runoff egress, concentrating water in vulnerable valley floors.',
  },
  distance_to_rivers: {
    label: 'Distance to Rivers',
    group: 'hydrological',
    groupLabel: 'Hydrological',
    unit: 'm',
    source: 'HydroRIVERS / OpenStreetMap',
    description: 'Euclidean distance to perennial river channels (Beas, Satluj, Ravi, Chenab, Yamuna basins).',
    evidence: 'Proximity to river corridors (<500 m) exhibits the highest susceptibility to overbank spilling and flash floods.',
  },
  flow_accumulation: {
    label: 'Flow Accumulation',
    group: 'hydrological',
    groupLabel: 'Hydrological',
    unit: 'cells',
    source: 'SRTM D8 Flow Routing',
    description: 'Cumulative upstream contributing area for each 30 m cell across Himalayan drainage basins.',
    evidence: 'High flow accumulation delineates primary drainage paths where floodwaters rapidly converge.',
  },
  twi: {
    label: 'Topographic Wetness Index (TWI)',
    group: 'hydrological',
    groupLabel: 'Hydrological',
    unit: 'index',
    source: 'DEM Second Derivatives (ln(a/tanβ))',
    description: 'Topographic Wetness Index quantifying topographic control on hydrological processes.',
    evidence: 'High TWI identifies zones of persistent soil saturation and surface ponding potential.',
  },
  drainage_density: {
    label: 'Drainage Density',
    group: 'hydrological',
    groupLabel: 'Hydrological',
    unit: 'km/km²',
    source: 'Stream Network Analysis',
    description: 'Total stream length per unit basin area, reflecting catchment dissection and runoff efficiency.',
    evidence: 'High drainage density correlates with rapid catchment response times during extreme weather events.',
  },
  elevation: {
    label: 'Elevation',
    group: 'topographic',
    groupLabel: 'Topographic',
    unit: 'm asl',
    source: 'SRTM 30 m DEM',
    description: 'Digital elevation model representing terrain height from 300 m (plains) to >6,000 m (Himalayan peaks).',
    evidence: 'Low-elevation valley bottoms and floodplain terraces represent prime flood inundation zones.',
  },
  lulc: {
    label: 'Land Use / Land Cover (LULC)',
    group: 'environmental',
    groupLabel: 'Environmental',
    unit: 'class',
    source: 'ESA WorldCover 10 m / Sentinel-2',
    description: 'Land use and land cover classes including built-up, agriculture, dense forest, water bodies, and snow.',
    evidence: 'Impervious urban surfaces and bare soil generate rapid surface runoff compared to forested catchments.',
  },
  curvature: {
    label: 'Profile/Plan Curvature',
    group: 'topographic',
    groupLabel: 'Topographic',
    unit: '1/m',
    source: 'SRTM DEM Derivatives',
    description: 'Surface curvature indicating flow convergence (concave) or flow divergence (convex).',
    evidence: 'Concave terrain shapes channel runoff inward, heightening localized flood depth.',
  },
  soil: {
    label: 'Soil Hydraulic Conductivity',
    group: 'environmental',
    groupLabel: 'Environmental',
    unit: 'class',
    source: 'SoilGrids v2.0 (ISRIC 250 m)',
    description: 'Soil textural classes and hydraulic conductivity controlling infiltration capacity.',
    evidence: 'Clayey and compacted soils reduce infiltration rates, transforming rainfall directly into surface runoff.',
  },
  ndvi: {
    label: 'NDVI (Vegetation Density)',
    group: 'environmental',
    groupLabel: 'Environmental',
    unit: 'index',
    source: 'Sentinel-2 L2A Annual Composite',
    description: 'Normalised Difference Vegetation Index measuring live green vegetation canopy.',
    evidence: 'Dense vegetation canopy mitigates raindrop impact and promotes rainfall interception.',
  },
};

export const INITIAL_LAYERS: Layer[] = [
  {
    id: 'result_raster:flood_11_factor_v1_full_suitability_classified',
    name: 'Flood Suitability (Classified 1–5)',
    group: 'composite',
    groupLabel: 'Composite Results',
    visible: true,
    opacity: 85,
    source: 'MCGSE AHP Multi-Criteria Composite',
    resolution: '30 m',
    date: '2026-09',
    description: 'Classified flood susceptibility map (1: Very Low to 5: Very High) derived via AHP weighted linear combination.',
  },
  {
    id: 'result_raster:flood_11_factor_v1_full_suitability',
    name: 'Flood Suitability (Continuous 1.0–5.0)',
    group: 'composite',
    groupLabel: 'Composite Results',
    visible: false,
    opacity: 80,
    source: 'MCGSE AHP Multi-Criteria Composite',
    resolution: '30 m',
    date: '2026-09',
    description: 'Continuous multi-criteria flood suitability index calculated across all 11 criteria.',
  },
  ...Object.entries(CRITERIA_INFO).map(([key, info]) => ({
    id: `factor_raster:${key}`,
    name: info.label,
    group: info.group,
    groupLabel: info.groupLabel,
    visible: false,
    opacity: 75,
    unit: info.unit,
    source: info.source,
    resolution: '30 m',
    date: '2026',
    description: info.description,
  })),
];

export const INITIAL_ZONE: Zone = {
  id: 'point-himachal-sample',
  label: 'Shimla Valley',
  cls: 'low',
  score: 1.84,
  classifiedValue: 2,
  lat: 31.1048,
  lng: 77.1734,
  district: 'Shimla',
  region: 'Himachal Pradesh',
  area: 44.3,
  finalStatus: 'VALID',
};

export const INITIAL_CRITERIA: CriterionRow[] = [
  { name: 'Terrain Slope', criterionId: 'slope', weight: 0.2306, rawScore: 89.99, rating: 1.0, contribution: 0.2306, unit: '°', cls: 'positive', layerId: 'factor_raster:slope', source: 'SRTM 30 m DEM', evidence: 'Steep hill slopes promote rapid surface drainage into valleys.' },
  { name: 'Distance to Rivers', criterionId: 'distance_to_rivers', weight: 0.1480, rawScore: 2594.9, rating: 1.0, contribution: 0.1480, unit: 'm', cls: 'positive', layerId: 'factor_raster:distance_to_rivers', source: 'HydroRIVERS', evidence: 'Located 2.6 km from primary channel, above normal floodline.' },
  { name: 'Topographic Wetness Index', criterionId: 'twi', weight: 0.1422, rawScore: -15.66, rating: 1.0, contribution: 0.1422, unit: 'index', cls: 'positive', layerId: 'factor_raster:twi', source: 'SRTM D8', evidence: 'Low TWI indicates low moisture retention risk.' },
  { name: 'Annual Rainfall', criterionId: 'rainfall', weight: 0.1326, rawScore: 1587.6, rating: 5.0, contribution: 0.6630, unit: 'mm/yr', cls: 'limiting', layerId: 'factor_raster:rainfall', source: 'CHIRPS v2.0', evidence: 'Monsoon precipitation of 1,587 mm/yr creates elevated flood hazard.' },
  { name: 'Flow Accumulation', criterionId: 'flow_accumulation', weight: 0.1115, rawScore: 28.0, rating: 1.0, contribution: 0.1115, unit: 'cells', cls: 'positive', layerId: 'factor_raster:flow_accumulation', source: 'SRTM Flow Routing', evidence: 'Minimal upstream catchment area directly draining to ridge.' },
  { name: 'Drainage Density', criterionId: 'drainage_density', weight: 0.0668, rawScore: 0.0, rating: 1.0, contribution: 0.0668, unit: 'km/km²', cls: 'positive', layerId: 'factor_raster:drainage_density', source: 'Stream Network', evidence: 'Low stream density in immediate watershed.' },
  { name: 'Land Cover (LULC)', criterionId: 'lulc', weight: 0.0573, rawScore: 10.0, rating: 1.0, contribution: 0.0573, unit: 'class', cls: 'positive', layerId: 'factor_raster:lulc', source: 'ESA WorldCover', evidence: 'Dense tree canopy moderates runoff generation.' },
  { name: 'Elevation', criterionId: 'elevation', weight: 0.0345, rawScore: 2062.0, rating: 4.0, contribution: 0.1381, unit: 'm asl', cls: 'limiting', layerId: 'factor_raster:elevation', source: 'SRTM DEM', evidence: 'High mountain elevation subject to cloudburst runoff.' },
  { name: 'Soil Texture', criterionId: 'soil', weight: 0.0317, rawScore: 2.0, rating: 2.0, contribution: 0.0635, unit: 'class', cls: 'positive', layerId: 'factor_raster:soil', source: 'SoilGrids v2.0', evidence: 'Coarse mountain soils provide moderate infiltration.' },
  { name: 'Curvature', criterionId: 'curvature', weight: 0.0282, rawScore: 1712.6, rating: 3.0, contribution: 0.0845, unit: '1/m', cls: 'positive', layerId: 'factor_raster:curvature', source: 'SRTM DEM Derivatives', evidence: 'Convex ridge profile disperses runoff divergence.' },
  { name: 'NDVI Vegetation', criterionId: 'ndvi', weight: 0.0166, rawScore: 0.40, rating: 1.0, contribution: 0.0166, unit: 'index', cls: 'positive', layerId: 'factor_raster:ndvi', source: 'Sentinel-2 L2A', evidence: 'Vegetation cover provides canopy interception.' },
];

export const INITIAL_STATS = {
  model_id: 'flood_11_factor_v1',
  crs: 'EPSG:4326',
  resolution_m: 30.0,
  total_pixels: 135148020,
  valid_pixels: 49294306,
  nodata_pixels: 85853714,
  valid_coverage_pct: 36.47,
  nodata_coverage_pct: 63.53,
  score_min: 1.104711,
  score_max: 3.447548,
  score_mean: 1.796454,
  score_std: 0.349259,
  class_distribution: [
    { class_value: 1, label: 'Very Low',  pixel_count: 28250602, percentage: 57.31, area_km2: 25425.54 },
    { class_value: 2, label: 'Low',       pixel_count: 19781852, percentage: 40.13, area_km2: 17803.67 },
    { class_value: 3, label: 'Moderate',  pixel_count: 1261840,  percentage: 2.56,  area_km2: 1135.66 },
    { class_value: 4, label: 'High',      pixel_count: 12,       percentage: 0.00,  area_km2: 0.01 },
  ],
};

export const AI_PRESETS: Array<{ q: string; context?: string }> = [
  { q: 'Why is this location classified as Low flood suitability?', context: 'zone' },
  { q: 'What are the dominant flood risk factors in Himachal Pradesh?', context: 'model' },
  { q: 'Which criterion has the highest AHP weight?', context: 'model' },
  { q: 'What is the Consistency Ratio (CR) of this model?', context: 'model' },
  { q: 'How does terrain slope affect flood susceptibility?', context: 'layer' },
  { q: 'Explain the 11-factor AHP flood methodology', context: 'model' },
];

export const AI_ANSWERS: Record<string, { text: string; actions?: Array<{ label: string; type: 'layer' | 'evidence' | 'stats'; target: string }> }> = {
  'Why is this location classified as Low flood suitability?': {
    text: `This location in Himachal Pradesh scores **1.84/5.00** (Class 2: Low Flood Susceptibility) because:\n\n• **Slope (w=0.2306, score=89.99°):** Steep Himalayan terrain facilitates rapid downslope drainage rather than surface ponding.\n• **Distance to Rivers (w=0.1480, dist=2,595 m):** The site sits well away from active overbank floodplains.\n• **Rainfall (w=0.1326, 1,588 mm/yr):** High monsoonal rainfall is the main risk factor (Rating 5), contributing 0.663 to the total score.\n\nThe steep gradient and elevated topography keep overall flood accumulation risk low at this specific pixel.`,
    actions: [
      { label: 'Show Slope Layer', type: 'layer', target: 'factor_raster:slope' },
      { label: 'Show Rainfall Layer', type: 'layer', target: 'factor_raster:rainfall' },
      { label: 'View Criteria Tab', type: 'stats', target: 'criteria' },
    ],
  },
  'What are the dominant flood risk factors in Himachal Pradesh?': {
    text: `In the **11-Factor Flood Suitability AHP Model**, the top risk determinants are:\n\n1. **Slope (23.06%):** Flat river valleys and gorges experience rapid inundation.\n2. **Distance to Rivers (14.80%):** Proximity to Beas, Satluj, and Ravi river channels.\n3. **Topographic Wetness Index (14.22%):** Concave terrain and valley basins collect saturation runoff.\n4. **Annual Rainfall (13.26%):** Extreme monsoonal downpours drive flash flooding.\n5. **Flow Accumulation (11.15%):** Large upstream drainage catchments converge in narrow valley exits.`,
    actions: [
      { label: 'Show Flow Accumulation', type: 'layer', target: 'factor_raster:flow_accumulation' },
      { label: 'View AHP Configuration', type: 'stats', target: 'metadata' },
    ],
  },
  'Which criterion has the highest AHP weight?': {
    text: `**Slope** carries the highest AHP weight at **0.2306 (23.06%)**, followed by **Distance to Rivers (0.1480)**, **TWI (0.1422)**, and **Rainfall (0.1326)**.\n\nTogether, these four criteria account for over **65%** of the composite flood suitability decision score.`,
    actions: [
      { label: 'View Criteria Tab', type: 'stats', target: 'criteria' },
    ],
  },
  'What is the Consistency Ratio (CR) of this model?': {
    text: `The AHP pairwise comparison matrix achieved a **Consistency Ratio (CR) of 0.0158 (1.58%)**.\n\nBecause **0.0158 << 0.10** (Saaty's threshold for logical consistency), the weighting matrix is mathematically rigorous, valid, and free of cyclical bias.`,
    actions: [
      { label: 'View Metadata', type: 'stats', target: 'metadata' },
    ],
  },
  default: {
    text: `I am connected to the **Himachal Pradesh 11-Factor Flood Suitability Spatial Knowledge Package** (Run ID 51, published 2026-09-18).\n\nI can analyze:\n• Point-specific multi-factor flood susceptibility\n• AHP criterion weights and consistency metrics (CR = 0.0158)\n• Real-time raster sampling across all 24 spatial layers\n• Basin-wide class distributions and flood risk areas\n\nClick any point on the map to sample the real raster layers.`,
  },
};

export const LAYERS: Layer[] = INITIAL_LAYERS;
export const CRITERIA: CriterionRow[] = INITIAL_CRITERIA;

export const ZONES: Zone[] = [
  INITIAL_ZONE,
  {
    id: 'point-kullu',
    label: 'Kullu Valley',
    cls: 'moderate',
    score: 2.45,
    classifiedValue: 3,
    lat: 31.9579,
    lng: 77.1095,
    district: 'Kullu',
    region: 'Himachal Pradesh',
    area: 38.6,
    finalStatus: 'VALID',
    criteria: INITIAL_CRITERIA,
  },
  {
    id: 'point-kangra',
    label: 'Kangra Basin',
    cls: 'high',
    score: 3.12,
    classifiedValue: 4,
    lat: 32.2190,
    lng: 76.3234,
    district: 'Kangra',
    region: 'Himachal Pradesh',
    area: 52.1,
    finalStatus: 'VALID',
    criteria: INITIAL_CRITERIA,
  },
];

export const CLASS_DIST = [
  { name: 'Very Low',  value: 57.3, color: '#ef4444', area: 25425.5 },
  { name: 'Low',       value: 40.1, color: '#f97316', area: 17803.7 },
  { name: 'Moderate',  value: 2.6,  color: '#fbbf24', area: 1135.7  },
  { name: 'High',      value: 0.0,  color: '#4ade80', area: 0.01    },
  { name: 'Very High', value: 0.0,  color: '#00c896', area: 0.0     },
];

export const SCORE_HIST = [
  { bin: '1.0', count: 120 },
  { bin: '1.4', count: 2840 },
  { bin: '1.8', count: 19800 },
  { bin: '2.2', count: 8640 },
  { bin: '2.6', count: 1260 },
  { bin: '3.0', count: 320 },
  { bin: '3.4', count: 12 },
];
