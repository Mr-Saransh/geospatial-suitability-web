# MCGSE Web-GIS Application

> **Multi-Criteria Geospatial Suitability Engine (MCGSE)** — Real-time Web-GIS decision platform powered by FastAPI, Leaflet, and the Himachal Pradesh Spatial Knowledge Package.

---

## 🏛️ Architecture Overview

The system bridges a high-fidelity Figma React frontend with a high-performance Python FastAPI backend that directly interacts with local GeoTIFF raster packages.

```
project/
├── MCGSE Web-GIS Application Design/   ← Workspace root (Frontend)
│   ├── src/
│   │   ├── components/                 ← React UI (MapCanvas, Sidebar, RightPanel, Navbar, etc.)
│   │   ├── lib/api/                    ← Typed API Client (Fetch wrapper, Pydantic mirror types)
│   │   ├── types.ts                    ← Application types & GIS schemas
│   │   ├── data.ts                     ← Model metadata, color scales, spatial presets
│   │   ├── index.css                   ← Tailwind CSS v4 design system
│   │   └── main.tsx                    ← Entry point
│   ├── vite.config.ts                  ← Vite config with API proxy to localhost:8000
│   ├── package.json                    ← React 19, Leaflet, Recharts, Tailwind v4
│   │
│   └── backend/                        ← FastAPI Python Backend
│       ├── app/
│       │   ├── main.py                 ← FastAPI application & lifecycle handlers
│       │   ├── config.py               ← Dynamic package root resolution
│       │   ├── schemas.py              ← Pydantic response models
│       │   ├── services/
│       │   │   ├── package_service.py  ← Spatial package discovery & catalog caching
│       │   │   ├── raster_service.py   ← Windowed point sampling, tile rendering & stats
│       │   │   └── weights.py          ← AHP weights & Saaty consistency matrix
│       │   └── routers/
│       │       ├── health.py           ← /api/v1/health
│       │       ├── metadata.py         ← /api/v1/metadata/package
│       │       ├── models.py           ← /api/v1/models
│       │       ├── layers.py           ← /api/v1/layers, /api/v1/tiles/{layer_id}/{z}/{x}/{y}.png
│       │       └── analyses.py         ← /api/v1/analyses/{id}/point, /api/v1/analyses/{id}/statistics
│       ├── requirements.txt            ← fastapi, uvicorn, rasterio, numpy, pyproj, pillow
│       └── .env                        ← SPATIAL_KNOWLEDGE_ROOT path configuration
│
└── project code climate/
    └── outputs/
        └── Himachal_Pradesh_Spatial_Knowledge.gdb/  ← 24 GeoTIFF rasters + manifests
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup & Startup

Ensure you have Python 3.10+ (e.g., Miniconda or Python virtualenv) with GDAL and rasterio:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Interactive API Documentation (Swagger):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check:** [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### 2. Frontend Setup & Startup

```bash
npm install
npm run dev
```

- **Application Preview:** [http://127.0.0.1:5173](http://127.0.0.1:5173)

---

## 📊 11-Factor Flood Suitability Model (Himachal Pradesh)

The application evaluates flood susceptibility using the **Analytic Hierarchy Process (Saaty, 1980)**:

$$\text{Suitability Score } S = \sum_{i=1}^{11} (w_i \times r_i)$$

Where:
- $w_i$ is the AHP priority weight ($\sum w_i = 1.0000$)
- $r_i$ is the standardized rating ($1$ to $5$) sampled at the pixel location

### Criteria Hierarchy & Weights

| Criterion | AHP Weight ($w_i$) | Rating Range | Primary Source |
|---|---|---|---|
| **Terrain Slope** | `0.230588` (23.06%) | 1 – 5 | SRTM 30 m DEM |
| **Distance to Rivers** | `0.148021` (14.80%) | 1 – 5 | HydroRIVERS / OSM |
| **Topographic Wetness Index (TWI)** | `0.142168` (14.22%) | 1 – 5 | DEM Second Derivatives |
| **Annual Rainfall** | `0.132592` (13.26%) | 1 – 5 | CHIRPS v2.0 (IMD/UCSB) |
| **Flow Accumulation** | `0.111538` (11.15%) | 1 – 5 | SRTM D8 Flow Routing |
| **Drainage Density** | `0.066758` (6.68%) | 1 – 5 | Stream Network Analysis |
| **Land Cover (LULC)** | `0.057282` (5.73%) | 1 – 5 | ESA WorldCover 10 m |
| **Elevation** | `0.034521` (3.45%) | 1 – 5 | SRTM 30 m DEM |
| **Soil Texture** | `0.031730` (3.17%) | 1 – 5 | SoilGrids v2.0 (ISRIC) |
| **Terrain Curvature** | `0.028179` (2.82%) | 1 – 5 | DEM Derivatives |
| **NDVI (Vegetation)** | `0.016624` (1.66%) | 1 – 5 | Sentinel-2 L2A Composite |

### Consistency Metrics
- **Principal Eigenvalue ($\lambda_{max}$):** `11.238`
- **Consistency Index (CI):** `0.0238`
- **Random Index (RI, $n=11$):** `1.51`
- **Consistency Ratio (CR):** `0.0158` (1.58%) $\ll 0.10$ *(Passes Saaty consistency requirement)*

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Backend and package health status |
| `GET` | `/api/v1/metadata/package` | Spatial knowledge package metadata & layer counts |
| `GET` | `/api/v1/models` | List available suitability models |
| `GET` | `/api/v1/models/{model_id}` | Detailed AHP weights, criteria, & classification |
| `GET` | `/api/v1/layers` | Catalog of all 24 spatial raster layers |
| `GET` | `/api/v1/layers/{layer_id}` | Metadata for a specific raster layer |
| `GET` | `/api/v1/tiles/{layer_id}/{z}/{x}/{y}.png` | Slippy map PNG tile generator |
| `GET` | `/api/v1/analyses/{id}/point?lat=X&lon=Y` | Windowed point inspection across all 24 rasters |
| `GET` | `/api/v1/analyses/{id}/statistics` | Area-wide pixel and class distribution statistics |

---

## 🗺️ Key Features Implemented

1. **Leaflet + Raster Tile Engine**: Dynamic PNG tile generation straight from local 32-bit float GeoTIFFs without converting to cloud services.
2. **Real Point Inspection**: Real-time windowed reads at exact mouse coordinates across all 11 factor rasters, 11 rating rasters, continuous score raster, and classified raster.
3. **Statistical Aggregation**: Real area calculations (44,364 km² valid area) broken down by flood susceptibility class.
4. **Figma Dark Theme Maintained**: Seamless glassmorphism, glowing status chips, custom dark basemaps (CartoDB Dark Matter, Esri Satellite, Topo), and Recharts charts.
5. **Interactive AI & Evidence**: Direct linking between criteria explanations and map layers.
