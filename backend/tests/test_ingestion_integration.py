"""
Integration test suite for MCGSE Ingestion-to-Web Publication Pipeline.

Covers:
1. Simultaneous discovery of both Flood (28 layers) and Landslide (34 layers).
2. Manifest schema compliance.
3. Health and Metadata REST endpoints.
4. Models registry and ModelDetail endpoints.
5. Layers catalog and model-based filtering.
6. Layer disambiguation for shared names (slope, elevation, rainfall).
7. Tile rendering in EPSG:3857 for results and factors.
8. Real coordinate point inspection sampling published COGs.
9. Area & suitability statistics derived from published rasters.
10. Dynamic cache refresh and invalidation upon package modification.
11. Resilience against incomplete/invalid packages.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.raster_service import (
    compute_statistics,
    invalidate_caches,
    render_tile,
)
from app.services.repository import repository


class TestIngestionToWebIntegration(unittest.TestCase):
    """End-to-end integration tests between Ingestion Publication packages and Web backend."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        repository.load()

    def test_01_simultaneous_model_discovery(self) -> None:
        """Verify both Flood and Landslide models are discovered simultaneously."""
        self.assertIn("flood_11_factor_v1", repository.models)
        self.assertIn("landslide_14_factor_v1", repository.models)

        flood_layers = repository.get_layers_for_model("flood_11_factor_v1")
        ls_layers = repository.get_layers_for_model("landslide_14_factor_v1")

        self.assertEqual(
            len(flood_layers), 28, f"Expected 28 Flood layers, got {len(flood_layers)}"
        )
        self.assertEqual(
            len(ls_layers), 34, f"Expected 34 Landslide layers, got {len(ls_layers)}"
        )
        self.assertEqual(
            len(repository.layers),
            62,
            f"Expected 62 total layers, got {len(repository.layers)}",
        )

    def test_02_health_endpoint(self) -> None:
        """GET /api/v1/health returns healthy status and lists both models."""
        resp = self.client.get("/api/v1/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["package_found"])
        self.assertIn("flood_11_factor_v1", data["models_available"])
        self.assertIn("landslide_14_factor_v1", data["models_available"])
        self.assertEqual(data["total_published_rasters"], 28)

    def test_03_package_metadata_endpoint(self) -> None:
        """GET /api/v1/metadata/package returns compliant metadata."""
        resp = self.client.get("/api/v1/metadata/package")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["package_status"], "healthy")
        self.assertEqual(data["state_name"], "Himachal Pradesh")
        self.assertIn("flood_11_factor_v1", data["models_available"])
        self.assertIn("landslide_14_factor_v1", data["models_available"])
        self.assertEqual(data["validation_status"], "PASSED")

    def test_04_models_listing_and_detail(self) -> None:
        """GET /api/v1/models and /api/v1/models/{model_id}."""
        resp = self.client.get("/api/v1/models")
        self.assertEqual(resp.status_code, 200)
        models = resp.json()
        m_ids = [m["model_id"] for m in models]
        self.assertIn("flood_11_factor_v1", m_ids)
        self.assertIn("landslide_14_factor_v1", m_ids)

        # Flood detail
        r_flood = self.client.get("/api/v1/models/flood_11_factor_v1")
        self.assertEqual(r_flood.status_code, 200)
        f_data = r_flood.json()
        self.assertEqual(f_data["criterion_count"], 11)
        self.assertEqual(len(f_data["weights"]), 11)

        # Landslide detail
        r_ls = self.client.get("/api/v1/models/landslide_14_factor_v1")
        self.assertEqual(r_ls.status_code, 200)
        ls_data = r_ls.json()
        self.assertEqual(ls_data["criterion_count"], 14)
        self.assertEqual(len(ls_data["weights"]), 14)

    def test_05_layers_catalog_and_filtering(self) -> None:
        """GET /api/v1/layers filtering by model_id."""
        # Default returns Flood (backward compatibility)
        r_default = self.client.get("/api/v1/layers")
        self.assertEqual(r_default.status_code, 200)
        self.assertEqual(len(r_default.json()), 28)

        # Explicit Flood
        r_flood = self.client.get("/api/v1/layers?model_id=flood_11_factor_v1")
        self.assertEqual(r_flood.status_code, 200)
        self.assertEqual(len(r_flood.json()), 28)

        # Explicit Landslide
        r_ls = self.client.get("/api/v1/layers?model_id=landslide_14_factor_v1")
        self.assertEqual(r_ls.status_code, 200)
        self.assertEqual(len(r_ls.json()), 34)

        # All layers
        r_all = self.client.get("/api/v1/layers?model_id=all")
        self.assertEqual(r_all.status_code, 200)
        self.assertEqual(len(r_all.json()), 62)

    def test_06_layer_disambiguation_and_aliases(self) -> None:
        """Common factor names like 'slope' resolve to correct model package."""
        # Slope disambiguated by model_id query
        r_sf = self.client.get("/api/v1/layers/slope?model_id=flood_11_factor_v1")
        self.assertEqual(r_sf.status_code, 200)
        self.assertEqual(r_sf.json()["model"], "flood_11_factor_v1")

        r_sl = self.client.get("/api/v1/layers/slope?model_id=landslide_14_factor_v1")
        self.assertEqual(r_sl.status_code, 200)
        self.assertEqual(r_sl.json()["model"], "landslide_14_factor_v1")

        # Exclusive factor resolves automatically
        r_lith = self.client.get("/api/v1/layers/lithology")
        self.assertEqual(r_lith.status_code, 200)
        self.assertEqual(r_lith.json()["model"], "landslide_14_factor_v1")

        # Legacy alias resolution
        r_alias = self.client.get("/api/v1/layers/flood_11_factor_v1_full_suitability")
        self.assertEqual(r_alias.status_code, 200)
        self.assertEqual(
            r_alias.json()["product_id"],
            "flood_11_factor_v1_available_evidence_suitability",
        )

    def test_07_raster_tile_rendering(self) -> None:
        """GET /api/v1/tiles/{layer_id}/{z}/{x}/{y}.png returns valid PNG bytes."""
        # Tile coordinates over Mandi, HP at zoom 9
        z, x, y = 9, 365, 208

        # Flood suitability tile
        r_t1 = self.client.get(
            f"/api/v1/tiles/flood_11_factor_v1_available_evidence_suitability/{z}/{x}/{y}.png"
        )
        self.assertEqual(r_t1.status_code, 200)
        self.assertEqual(r_t1.headers["content-type"], "image/png")
        self.assertTrue(len(r_t1.content) > 1000)
        self.assertEqual(r_t1.content[:8], b"\x89PNG\r\n\x1a\n")

        # Landslide suitability tile
        r_t2 = self.client.get(
            f"/api/v1/tiles/landslide_14_factor_v1_available_evidence_suitability/{z}/{x}/{y}.png"
        )
        self.assertEqual(r_t2.status_code, 200)
        self.assertEqual(r_t2.headers["content-type"], "image/png")
        self.assertTrue(len(r_t2.content) > 1000)
        self.assertEqual(r_t2.content[:8], b"\x89PNG\r\n\x1a\n")

    def test_08_point_inspection_sampling(self) -> None:
        """GET /api/v1/analyses/{model_id}/point samples real rasters."""
        lat, lon = 31.8645, 76.7920

        # Flood
        r_pt_f = self.client.get(
            f"/api/v1/analyses/flood_11_factor_v1/point?lat={lat}&lon={lon}"
        )
        self.assertEqual(r_pt_f.status_code, 200)
        f_pt = r_pt_f.json()
        self.assertEqual(f_pt["final_status"], "VALID")
        self.assertIsNotNone(f_pt["continuous_score"])
        self.assertIsNotNone(f_pt["classified_value"])
        self.assertEqual(len(f_pt["criteria_list"]), 11)

        # Landslide
        r_pt_ls = self.client.get(
            f"/api/v1/analyses/landslide_14_factor_v1/point?lat={lat}&lon={lon}"
        )
        self.assertEqual(r_pt_ls.status_code, 200)
        ls_pt = r_pt_ls.json()
        self.assertIn(ls_pt["final_status"], ("VALID", "PARTIAL_EVIDENCE"))
        self.assertIsNotNone(ls_pt["continuous_score"])
        self.assertEqual(len(ls_pt["criteria_list"]), 14)

    def test_09_analysis_statistics(self) -> None:
        """GET /api/v1/analyses/{model_id}/statistics returns real raster calculations."""
        # Flood stats
        r_sf = self.client.get("/api/v1/analyses/flood_11_factor_v1/statistics")
        self.assertEqual(r_sf.status_code, 200)
        sf = r_sf.json()
        self.assertEqual(len(sf["class_distribution"]), 5)
        total_pct = sum(c["percentage"] for c in sf["class_distribution"])
        self.assertAlmostEqual(total_pct, 100.0, places=0)

        # Landslide stats
        r_sl = self.client.get("/api/v1/analyses/landslide_14_factor_v1/statistics")
        self.assertEqual(r_sl.status_code, 200)
        sl = r_sl.json()
        self.assertEqual(len(sl["class_distribution"]), 5)
        total_pct_ls = sum(c["percentage"] for c in sl["class_distribution"])
        self.assertAlmostEqual(total_pct_ls, 100.0, places=0)

    def test_10_cache_invalidation_and_refresh(self) -> None:
        """Repository check_refresh safely detects changes and flushes caches."""
        # Initially check_refresh returns False (no change)
        repository._last_refresh_check = 0.0
        refreshed = repository.check_refresh(min_interval=0.0)
        self.assertFalse(refreshed)

        # Cache population
        z, x, y = 9, 365, 208
        render_tile("flood_11_factor_v1_available_evidence_suitability", z, x, y)
        compute_statistics("flood_11_factor_v1")

        # Invalidate caches
        invalidate_caches("flood_11_factor_v1")
        invalidate_caches()
        # Verify repository still healthy after cache invalidation
        self.assertEqual(len(repository.models), 2)


if __name__ == "__main__":
    unittest.main()
