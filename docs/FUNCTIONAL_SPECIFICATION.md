# Multi-Criteria Geospatial Susceptibility Evaluation (MCGSE) Web-GIS Platform

## Comprehensive Functional Documentation & User Operation Manual

---

## 1. Executive Summary & Platform Mission

The **Multi-Criteria Geospatial Susceptibility Evaluation (MCGSE)** Web-GIS Application is a modern, cloud-native, decision-support platform engineered to quantify, visualize, and explain natural hazard susceptibility across mountainous terrains. Developed initially for **Himachal Pradesh**—a fragile Western Himalayan state subject to intense monsoonal precipitation, cloudbursts, and tectonic shear zones—the platform consolidates complex multi-source remote sensing datasets into scientifically validated, 30-meter continuous and categorical hazard susceptibility indices.

Unlike conventional static GIS portals that merely render read-only maps, MCGSE provides an active analytical workbench. Every coordinate on the map is instantly inspectable, breaking down composite hazard scores into raw physical measurements, rating conversions, and normalized factor contributions based on Thomas Saaty's Analytic Hierarchy Process (AHP). Furthermore, the platform integrates an evidence-grounded Artificial Intelligence assistant that translates complex spatial science into actionable, plain-English advice for land administrators, emergency services, and citizens.

> [!IMPORTANT]
> **Strict Zero-Hallucination Evidence Gating:**
> Every answer provided by the AI assistant is strictly bound to genuine raster measurements sampled at the clicked location. Hallucinations of hazard scores, coordinates, or safety classifications are mathematically prevented by backend evidence gating.

---

## 2. Key Stakeholders & Functional Use Cases

The application satisfies the specialized requirements of diverse user groups through targeted workflows:

1. **Urban Planners & Municipal Town Country Planning (TCP):**
   - Evaluate site development feasibility before approving commercial or residential construction permits.
   - Inspect slope stability, proximity to active river corridors, and flow accumulation pathways to prevent building in active floodways or landslide chutes.
2. **State Disaster Management Authorities (HP-SDMA & DDMA):**
   - Conduct pre-monsoon vulnerability assessments across all 12 districts (Shimla, Mandi, Kullu, Kangra, Solan, Chamba, Bilaspur, Hamirpur, Una, Sirmaur, Kinnaur, Lahaul & Spiti).
   - Identify high-risk road corridors, bridges, and settlements requiring engineering mitigation or early evacuation planning.
3. **Infrastructure & Civil Engineers (NHAI, PWD, BRO):**
   - Assess slope steepness, structural geology (fault line buffers), and lithological rock competence when designing highway widening, tunnel portals, retaining walls, or drainage culverts.
4. **Citizens, Land Buyers, and Home Builders:**
   - Ask plain-English questions such as _"Should we build a house here?"_ to receive a comprehensive, dual-hazard evaluation explaining local drainage, slope risks, and recommended engineering precautions.
5. **Scientific Researchers & Environmental Assessors:**
   - Inspect mathematical consistency ratios ($CR \le 0.10$), review pairwise factor weightings, and export GeoTIFFs or CSV tabular data for academic peer review and environmental impact statements (EIA).

---

## 3. Interactive Web-GIS Map Viewer & GIS Controls

The core user interface centers around an interactive Leaflet-powered GIS map canvas paired with ergonomic cartographic and layer inspection controls.

### 3.1 Functional Interface Layout

```
+---------------------------------------------------------------------------------------------------+
|  [LOGO] MCGSE Web-GIS   |  [Model Dropdown: Flood / Landslide]  |  [Search: Lat,Lon / City]       |
|  Actions: [Compare Hazards]  [Analytics]  [MCGSE AI]  [Export]  [Theme Sun/Moon]  [Status: Live]   |
+---------------------------------------------------------------------------------------------------+
|  MAP LAYERS DRAWER       |  INTERACTIVE MAP CANVAS (Leaflet 30m Grid)   |  ANALYTICS / AI DRAWER   |
|  ---------------------   |  -----------------------------------------   |  ----------------------  |
|  (o) Classified Result   |  * Slippy Map Tiles (XYZ dynamic server)     |  * Statewide Stats Area  |
|  ( ) Continuous Score    |  * Click to Inspect Point                    |  * Class Distribution    |
|  -- Criteria Factors --  |  * Floating Result Chip (Score & Class)      |  * MCGSE AI Chat History |
|  ( ) Terrain Slope       |  * Lat/Lon Reticle Indicator                 |  * Real GIS Evidence     |
|  ( ) Annual Rainfall     |  * Dark / Light Basemap Tiles                |  * Plain-English Advice  |
|  ( ) Distance to River   |  * Opacity Slider (0% - 100%)                |  * Contributing Factors  |
|  [Clear Rasters]         |  * Map Legend (Class 1-5 Color Ramp)         |  * GeoTIFF/CSV Exports   |
+---------------------------------------------------------------------------------------------------+
```

### 3.2 Dual-Theme Modern Cartography

- **Dark Mode (Default):** Uses dark muted basemap tiles (CartoDB Dark Matter) allowing bright categorical raster colors (greens, yellows, oranges, reds) to stand out with optimal contrast for prolonged analytical sessions.
- **Light Mode:** Uses clean topographic and street cartography (CartoDB Positron / OSM) ideal for field printing, daytime operations, and administrative reporting.

### 3.3 Single-Active Raster Radio Principle

Unlike multi-layer GIS portals that stack opaque rasters on top of one another and confuse visual interpretation, MCGSE enforces a strict radio-button selection model for all analysis layers. At any given moment, exactly one thematic raster is rendered on the map. This guarantees that visual pixel colors directly match the active layer's physical units or classification standard without muddy overlay blending.

### 3.4 Hierarchical Layer Taxonomy

| Layer Tier           | Layer Type          | Description & Physical Metric                                                  | Visual Representation                           |
| :------------------- | :------------------ | :----------------------------------------------------------------------------- | :---------------------------------------------- |
| **Results**          | Classified Map      | 5 discrete susceptibility classes: Very Low, Low, Moderate, High, Very High    | Categorical ramp (Green $\to$ Yellow $\to$ Red) |
| **Results**          | Continuous Score    | Floating-point normalized index from 1.000 to 5.000                            | Continuous smooth gradient heat map             |
| **Criteria Factors** | Raw Factor          | Unclassified physical metric (Slope in °, Rainfall in mm/yr, Distance in m)    | Monochromatic intensity raster with units       |
| **Criteria Ratings** | Standardized Rating | 1 to 5 utility scale rating evaluating risk contribution per factor            | 5-step standardized thematic ramp               |
| **Quality & Masks**  | Bitmask Raster      | Valid analysis boundary mask excluding snowfields, glaciers, or non-state area | Binary transparent/masked overlay               |

---

## 4. Point Inspection & Site Suitability Engine

Clicking anywhere on the map or entering geographic coordinates triggers the real-time Point Inspection Engine. The system samples the underlying multi-band raster data stack and produces an exhaustive site assessment in under 50 milliseconds.

### 4.1 Coordinate Search & Smart Coordinate Auto-Correction

- **Named Place Search:** Instant fly-to navigation for Himachal Pradesh district headquarters and major towns (Shimla, Mandi, Dharamshala, Kullu, Manali, Solan, Chamba, Bilaspur, Hamirpur, Una, Reckong Peo, Keylong).
- **Flexible Coordinate Input:** Accepts formats such as `31.1048, 77.1734`, `31.1048 77.1734`, or `31°06'N, 77°10'E`.
- **Inverted Lat/Lon Auto-Correction:** If a user pastes coordinates in Longitude, Latitude order (e.g. `77.1734, 31.1048`), the algorithm automatically detects that longitude exceeds 65° and transposes them to standard (Latitude, Longitude) coordinates for India.

### 4.2 Floating Inspection Chip & Deep Inspection Modal

Upon point selection, a floating chip appears directly above the coordinate showing immediate summary metrics:

- Calculated Susceptibility Score (e.g., `2.34 / 5.00`)
- Classification Label (e.g., _'Class 2: Low Susceptibility'_)
- Quick action button to expand the full Point Inspection Modal.

The expanded modal delivers complete mathematical transparency:

1. **Composite Suitability Score & Class:** Displayed prominently with high-visibility color coding.
2. **Top Contributing Factors:** Ranked list of physical criteria driving the score at that coordinate, including raw measured values, 1–5 rating conversions, and mathematical contribution percentages.
3. **Limiting Criteria:** Identifies specific mitigating factors that prevented the score from escalating into higher danger tiers (e.g., steep 32° slope shedding surface runoff rapidly, keeping flood risk low).
4. **Available Evidence Status:** Discloses whether all criteria were valid or if renormalization was applied due to boundary conditions.
5. **Out-of-Bounds Protection:** If a user clicks outside the Himachal Pradesh boundary, the system displays an advisory informing them that the point lies outside the active state boundary.

---

## 5. Multi-Hazard Model Architecture & Comparison

MCGSE incorporates two distinct spatial multi-criteria models developed for Western Himalayan disaster management:

### 5.1 11-Factor Flood Susceptibility Model (AHP)

Focuses on hydrological accumulation, river proximity, and topography that allows floodwaters to pool and inundate valleys and low-lying settlements.

| Criterion Name                | Factor Weight (%) | Physical Metric & Units                    | Hydrological Role in Flood Susceptibility                                |
| :---------------------------- | :---------------- | :----------------------------------------- | :----------------------------------------------------------------------- |
| **Terrain Slope**             | 23.4%             | Ground inclination in degrees (°)          | Gentle slopes (< 5°) pool floodwaters; steep slopes shed runoff rapidly. |
| **Distance to Rivers**        | 15.8%             | Euclidean distance to mapped stream (m)    | Proximity to active riverbeds directly dictates riverine flood exposure. |
| **Flow Accumulation**         | 13.2%             | Upstream catchment cells draining to pixel | High flow accumulation marks natural watercourse channels and gullies.   |
| **Annual Rainfall**           | 11.5%             | TRMM / IMD precipitation in mm/year        | Higher rainfall volume provides greater overland flow volume.            |
| **Topographic Wetness (TWI)** | 9.4%              | $\ln(a / \tan \beta)$ index                | Identifies zones prone to soil water saturation and swampy conditions.   |
| **Elevation (DEM)**           | 7.8%              | Altitude above sea level (meters)          | Valley floors (< 1200 m) suffer highest backwater and inundation risk.   |
| **Soil Permeability**         | 6.2%              | Soil texture and hydraulic conductivity    | Impermeable clays accelerate runoff; gravels absorb moisture.            |
| **Land Use / Land Cover**     | 4.9%              | LULC categorical classification            | Built-up concrete increases runoff; dense forests intercept rain.        |
| **NDVI (Vegetation Index)**   | 3.8%              | Normalized Difference Vegetation Index     | Canopy cover slows raindrop impact and promotes infiltration.            |
| **Plan Curvature**            | 2.3%              | Surface shape horizontal to slope          | Concave profiles converge flow; convex profiles disperse flow.           |
| **Profile Curvature**         | 1.7%              | Surface shape parallel to slope            | Accelerates or decelerates water velocity as it moves downslope.         |

### 5.2 14-Factor Landslide Susceptibility Model (MCDA)

Focuses on gravitational shear stress, geotechnical rock competence, tectonic fracturing, and anthropogenic slope cuts.

| Criterion Name                | Factor Weight (%) | Physical Metric & Units                   | Geotechnical Role in Landslide Failure                                   |
| :---------------------------- | :---------------- | :---------------------------------------- | :----------------------------------------------------------------------- |
| **Slope Angle**               | 21.5%             | Terrain slope in degrees (°)              | Steep slopes (30°–50°) produce intense shear stress and rockfall.        |
| **Lithology (Rock Type)**     | 16.2%             | Geological rock formation competence      | Weak weathered shales and phyllites fail rapidly; granites resist.       |
| **Distance to Faults**        | 11.8%             | Euclidean distance to active thrust/fault | Fault shear zones contain fractured rock prone to catastrophic slides.   |
| **Annual Rainfall**           | 10.4%             | Monsoon precipitation volume (mm/yr)      | Water infiltration increases pore water pressure, triggering slope slip. |
| **Distance to Roads**         | 9.1%              | Proximity to cut road slopes (m)          | Unengineered highway excavation undermines hillside toe support.         |
| **Distance to Streams**       | 7.3%              | Proximity to active river channels (m)    | River erosion undercuts slope bases during high monsoonal flow.          |
| **Aspect (Slope Direction)**  | 5.6%              | Compass orientation (0° - 360°)           | South-facing slopes experience higher solar weathering and freeze-thaw.  |
| **Land Use / Land Cover**     | 4.8%              | LULC categorical classification           | Barren hillsides and degraded scrub lack root cohesion.                  |
| **Elevation**                 | 4.1%              | Meters above sea level (m)                | High elevations face periglacial weathering and lack forest protection.  |
| **NDVI (Vegetation)**         | 3.2%              | Normalized Difference Vegetation Index    | Deep tree root networks mechanically anchor soil mantles.                |
| **Soil Depth & Texture**      | 2.5%              | Soil horizon thickness and texture        | Thick saturated soil mantles easily liquify into mudflows.               |
| **Topographic Wetness (TWI)** | 1.7%              | Topographic wetness index                 | High TWI areas accumulate subsurface moisture weakening shear strength.  |
| **Plan Curvature**            | 1.0%              | Surface curvature horizontal to slope     | Concave hollows concentrate groundwater and initiate debris flows.       |
| **Profile Curvature**         | 0.8%              | Surface curvature vertical to slope       | Convex breaks in slope represent tension crack development zones.        |

### 5.3 Multi-Hazard Contrast & Compare Mode

The Compare Mode enables users to view the contrasting roles of topography simultaneously. For example, a steep 35° mountain ridge above the Beas River in Mandi will show **Very Low Flood Susceptibility (Class 1)** because floodwaters drain away immediately, but simultaneously show **High or Very High Landslide Susceptibility (Class 4 or 5)** due to gravity-driven rock shear stress. This cross-hazard awareness prevents dangerous planning oversights.

---

## 6. Evidence-Grounded AI Assistant (MCGSE AI)

MCGSE AI bridges the gap between raw spatial calculations and practical human decision-making. Operating as a sliding drawer on desktop and mobile, the assistant provides real-time natural language reasoning.

### 6.1 Conversational Warmth & Intent Filtering

Unlike basic prototypes that dump raw factor weight tables on simple greetings, MCGSE AI features semantic intent detection:

- **Casual Greetings (_'hi'_, _'hello'_, _'who are you?'_):** Responds with a warm, friendly welcome outlining capabilities without technical clutter.
- **Conceptual Questions (_'what is gis in 10 words?'_, _'explain AHP'_):** Provides clear, educational summaries without dumping point-specific data.
- **Construction & House Inquiries (_'should we build a house here?'_):** Automatically extracts point factors and presents a structured verdict, observations, secondary mountain hazard advisories, and actionable engineering next steps.
- **Comparative Inquiries (_'compare flood and landslide'_):** Generates a clean tabular comparison highlighting the contrasting role of terrain factors.

### 6.2 Event-Driven Real-Time Streaming & Visual Progress

The AI assistant communicates via Server-Sent Events (SSE), providing real-time visual progress updates:

1. Understanding Question & Spatial Context
2. Identifying Active Spatial Model
3. Retrieving Model Metadata & Criteria Weights
4. Sampling 30m Multi-Band Rasters at Selected Coordinate
5. Checking Boundary & Topographic Mountain Hazards
6. Synthesizing Evidence into Natural Language

### 6.3 Interactive Structured Evidence Accordion

Beneath each answer, users can expand an interactive _'Verified GIS Evidence'_ accordion displaying individual verified facts: Model ID, Statewide Mean Score, Primary Drivers, Measured Physical Values, and Data Sources. Users can click _'View on Map'_ to immediately highlight that specific layer on the GIS map canvas.

### 6.4 Seamless Offline & Degraded Mode

If the Ollama neural model is offline, busy, or uninstalled, the backend automatically engages its deterministic GIS synthesis engine. Users still receive comprehensive, plain-language construction assessments, factor breakdowns, and engineering advisories derived directly from the mathematical package facts—ensuring the application never crashes or leaves the user stranded.

---

## 7. Analytics Center & Statistical Aggregates

The Analytics drawer provides comprehensive statewide reporting across all 55,673 square kilometers of Himachal Pradesh:

- **Class Distribution Charts:** Visual bar and pie charts illustrating the statewide area (km²) and percentage belonging to Class 1 through Class 5.
- **Statistical Baseline:** Statewide mean suitability score, standard deviation, and valid data footprint percentage.
- **District Breakdowns:** Comparative susceptibility summaries identifying the most vulnerable regional zones.

---

## 8. Export Center & Interoperability

MCGSE adheres to open geospatial data standards, allowing users to export results into standard external tools (QGIS, ArcGIS, Google Earth):

1. **Cloud-Optimized GeoTIFF (COG):** Export continuous suitability rasters and categorical classification GeoTIFFs for desktop GIS analysis.
2. **GeoJSON Boundaries:** Export Himachal Pradesh boundary vectors, district limits, and flood risk polygons.
3. **CSV Point Inspection Reports:** Export tabular spreadsheets containing coordinate inspections, raw factor metrics, and AHP ratings for engineering documentation.
4. **Comprehensive Audit PDF Reports:** Generate printable compliance summaries for project approval files.

---

## 9. Tunneling vs. Cloud Deployment Flexibility

A critical functional feature of MCGSE is complete deployment decoupling. The application can operate in three distinct networking configurations without code modifications:

| Deployment Mode           | Networking Mechanism                              | CORS Configuration                                | Ideal Operational Use Case                                          |
| :------------------------ | :------------------------------------------------ | :------------------------------------------------ | :------------------------------------------------------------------ |
| **Local Full-Stack**      | Vite Proxy (`/api` $\to$ `http://127.0.0.1:8000`) | Zero CORS (same-origin relative proxying)         | Local developer testing, offline laptops, air-gapped workstations   |
| **AWS Cloud Production**  | CloudFront / Nginx reverse proxy unified route    | Zero CORS (single-domain `/api/*` to backend ALB) | Public production deployment on AWS ECS/S3 with SSL and CDN caching |
| **Remote Tunnel Testing** | Secure Ngrok / Cloudflare Tunnel endpoint         | Dynamic CORS origin allowlist in backend `.env`   | Demonstrations, remote client access, mobile device field testing   |

Users can view and adjust their backend connection URL at any time via the discreet _'Backend & Tunnel Settings'_ modal in the navigation menu, with automatic QR/link sharing for field inspectors on mobile smartphones.
