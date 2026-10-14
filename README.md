# MCGSE Web-GIS Application

> **Multi-Criteria Geospatial Suitability Engine (MCGSE)** — Unified Web-GIS decision platform powered by FastAPI, Leaflet, and the canonical Himachal Pradesh Spatial Knowledge Package(s). Supports Flood Susceptibility, Landslide Susceptibility, and future MCDA hazards with zero source-code changes when moving between local and cloud deployments.

---

## Architecture Overview

The system bridges a high-fidelity Figma React frontend with a high-performance Python FastAPI backend that serves multi-hazard spatial intelligence directly from canonical GeoTIFF packages.

```
                  ┌──────────────────────────────┐
                  │        React Web App         │
                  │        Existing              │
                  └──────────────┬───────────────┘
                                 │ HTTP/JSON
                                 ▼
                  ┌──────────────────────────────┐
                  │          FastAPI             │
                  │                              │
                  │ Models / Layers / Point      │
                  │ Statistics / Metadata        │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Spatial Knowledge Repository │
                  │                              │
                  │ Manifest Resolver            │
                  │ Raster Reader                │
                  │ CRS Transformer              │
                  │ Statistics                   │
                  │ Provenance                   │
                  └──────────────┬───────────────┘
                                 │
                 configured via environment only
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
   Local Run #63 Package                    Cloud Mounted Package
   Windows filesystem                      VM/container volume
              │                                     │
              └──────── same backend code ──────────┘
```

---

## Critical Cloud Deployment Requirement

**The source code does not contain environment-specific Spatial Knowledge paths. Configure `SPATIAL_KNOWLEDGE_ROOT` or the corresponding model-specific variable in the deployment environment.**

- **No Windows filesystem paths** (e.g. `C:\Users\...`) exist in production code.
- **Cross-platform**: Path handling uses Python's standard `pathlib.Path` with forward-slash manifests.
- **Zero code changes**: Deploying to Docker, a Linux VM, Kubernetes, or cloud storage requires only changing an environment variable.

---

## Quick Start Guide

### 1. Backend Local Setup

1. **Create & activate a virtual environment** (or conda environment with GDAL & Rasterio):
   ```bash
   conda activate gee_env
   # or: python -m venv venv && source venv/bin/activate (Linux/Mac)
   ```
2. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. **Configure `.env`**:
   Copy `.env.example` to `.env` in `backend/`:
   ```env
   ENVIRONMENT=development
   SPATIAL_KNOWLEDGE_ROOT=C:\path\to\run_63\Himachal_Pradesh_Spatial_Knowledge.gdb
   FLOOD_SPATIAL_KNOWLEDGE_ROOT=C:\path\to\flood\Himachal_Pradesh_Spatial_Knowledge.gdb
   LANDSLIDE_SPATIAL_KNOWLEDGE_ROOT=C:\path\to\run_63\Himachal_Pradesh_Spatial_Knowledge.gdb
   CORS_ORIGINS=http://localhost:5173
   ```
4. **Point `SPATIAL_KNOWLEDGE_ROOT` to the Run #63 package**:
   ```env
   SPATIAL_KNOWLEDGE_ROOT=C:\Users\ADMIN\Desktop\Private\Saransh project\project\project code climate\outputs\e2e_run\run_63\Himachal_Pradesh_Spatial_Knowledge.gdb
   ```
5. **Start FastAPI**:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
6. **Test health**:
   ```bash
   curl http://127.0.0.1:8000/api/v1/health
   ```
7. **Test models**:
   ```bash
   curl http://127.0.0.1:8000/api/v1/models
   ```
8. **Test point query**:
   ```bash
   # Flood point
   curl "http://127.0.0.1:8000/api/v1/analyses/flood_11_factor_v1/point?lat=31.8645&lon=76.7920"
   # Landslide point
   curl "http://127.0.0.1:8000/api/v1/analyses/landslide_14_factor_v1/point?lat=31.1048&lon=77.1734"
   ```

### 2. Frontend Setup & Startup

9. **Start frontend**:
   ```bash
   # In project root
   npm install
   npm run dev
   ```
   - **Frontend App:** [http://127.0.0.1:5173](http://127.0.0.1:5173)
   - **Interactive API Documentation (Swagger):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 📡 API Endpoints Reference

| Method | Endpoint                                        | Description                                                |
| ------ | ----------------------------------------------- | ---------------------------------------------------------- |
| `GET`  | `/api/v1/health`                                | Backend and package health status                          |
| `GET`  | `/api/v1/metadata/package`                      | Spatial knowledge package metadata & validation            |
| `GET`  | `/api/v1/models`                                | List all available models (Flood, Landslide, etc.)         |
| `GET`  | `/api/v1/models/{model_id}`                     | Detailed AHP/MCDA weights, criteria & classification       |
| `GET`  | `/api/v1/layers`                                | Dynamic layer catalog (`?model_id=...` or `?model_id=all`) |
| `GET`  | `/api/v1/layers/{layer_id}`                     | Metadata for a specific raster layer                       |
| `GET`  | `/api/v1/tiles/{layer_id}/{z}/{x}/{y}.png`      | Slippy map PNG tile generator (EPSG:3857)                  |
| `GET`  | `/api/v1/analyses/{model_id}/point?lat=X&lon=Y` | Windowed point inspection with structured evidence         |
| `GET`  | `/api/v1/analyses/{model_id}/statistics`        | Canonical pixel, class, and evidence distributions         |
| `GET`  | `/api/v1/analyses/{model_id}/metadata`          | Provenance, CR, and scientific metadata                    |
| `GET`  | `/api/v1/boundary`                              | Official GeoJSON boundary for Himachal Pradesh             |

---

## Supported Models

### 1. Flood Susceptibility (`flood_11_factor_v1`)

- **Methodology**: 11-Factor Analytic Hierarchy Process (AHP, Saaty 1980)
- **Criteria (11)**: Rainfall, Slope, Flow Accumulation, Distance to Rivers, TWI, Drainage Density, Elevation, LULC, Curvature, Soil, NDVI
- **CRS**: `EPSG:4326`
- **Resolution**: 30 m (~0.00027°)
- **Total Published Rasters**: 28

### 2. Landslide Susceptibility (`landslide_14_factor_v1`)

- **Methodology**: 14-Factor Multi-Criteria Decision Analysis (MCDA)
- **Criteria (14)**: Slope, Lithology, Rainfall (10-Year), Relative Relief, Lineament Density, Drainage Density, TWI, Geomorphology, Soil, Distance to Faults, Distance to Roads, LULC, Aspect, NDVI
- **CRS**: `EPSG:32643` (UTM Zone 43N)
- **Resolution**: 30.0 m
- **Total Published Rasters**: 34

---

## Security & Performance Features

1. **Path Traversal Protection**: All paths resolved strictly within `package_root` using `Path.relative_to()`.
2. **Zero In-Memory Statewide Rasters**: Reads utilize GDAL/Rasterio 1x1 windowed point sampling and tiled overviews.
3. **Strict NoData Handling**: NoData values are never silently replaced with 0 or fabricated numbers.
4. **Dynamic Coordinate Reprojection**: WGS84 coordinates dynamically reprojected to the dataset's native CRS (`EPSG:32643` for Landslide, `EPSG:4326` for Flood).
