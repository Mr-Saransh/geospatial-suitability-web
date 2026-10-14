"""
Comprehensive tests for the Canonical Himachal Pradesh Spatial Knowledge Platform.

Validates all 17 requirements from the Master Specification:
1. Configuration loading & settings validation
2. Local package path resolution (multi-root)
3. Invalid package path error handling
4. Manifest loading & metadata discovery
5. Multi-model discovery (Flood + Landslide)
6. Flood model definition & AHP weights
7. Landslide model definition & MCDA weights (14 factors)
8. Canonical raster path resolution & verification on disk
9. Path traversal rejection & security
10. Point query with structured evidence (Phase 6 contract)
11. NoData point query preserving strict null semantics
12. CRS coordinate transformation (WGS84 -> UTM 43N)
13. Statistics endpoint for Flood (Run #56)
14. Statistics endpoint for Landslide (Run #63 real data)
15. Flood regression & legacy alias resolution
16. Landslide API real data testing
17. Tile rendering for multi-model rasters
"""

import unittest

from fastapi.testclient import TestClient  # type: ignore

from app.config import settings
from app.main import app
from app.services.repository import repository


class TestCanonicalSpatialKnowledge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    # 1. Configuration loading
    def test_configuration_loading(self):
        val = settings.validate()
        self.assertEqual(val["status"], "valid")
        self.assertTrue(val["packages_found"] >= 1)
        self.assertIn("*", settings.cors_origins)

    # 2. Local package path resolution
    def test_local_package_path_resolution(self):
        flood_root = settings.get_package_root("flood_11_factor_v1")
        self.assertTrue(flood_root.exists())
        self.assertTrue((flood_root / "manifest.json").exists())

        ls_root = settings.get_package_root("landslide_14_factor_v1")
        self.assertTrue(ls_root.exists())
        self.assertTrue((ls_root / "manifest.json").exists())

    # 3. Invalid package path handling
    def test_invalid_package_path(self):
        with self.assertRaises(FileNotFoundError):
            settings.get_package_root("nonexistent_unknown_hazard_v99")

    # 4. Manifest loading & reproducibility
    def test_manifest_loading(self):
        r = self.client.get("/api/v1/metadata/package")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["package_status"], "healthy")
        self.assertEqual(data["state_name"], "Himachal Pradesh")
        self.assertIn("flood_11_factor_v1", data["models_available"])
        self.assertIn("landslide_14_factor_v1", data["models_available"])
        self.assertIn("AVAILABLE_EVIDENCE_RENORMALIZED", data["scoring_modes"])

    # 5. Multi-model discovery
    def test_model_discovery(self):
        r = self.client.get("/api/v1/models")
        self.assertEqual(r.status_code, 200)
        models = r.json()
        model_ids = [m["model_id"] for m in models]
        self.assertIn("flood_11_factor_v1", model_ids)
        self.assertIn("landslide_14_factor_v1", model_ids)

    # 6. Flood model discovery & criteria
    def test_flood_model_discovery(self):
        r = self.client.get("/api/v1/models/flood_11_factor_v1")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["criterion_count"], 11)
        self.assertEqual(len(data["weights"]), 11)
        self.assertEqual(data["minimum_valid_criteria"], 8)
        self.assertIn("rainfall", data["criteria"])
        self.assertIn("slope", data["criteria"])
        self.assertIn("twi", data["criteria"])

    # 7. Landslide model discovery & 14 criteria
    def test_landslide_model_discovery(self):
        r = self.client.get("/api/v1/models/landslide_14_factor_v1")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["criterion_count"], 14)
        self.assertEqual(len(data["weights"]), 14)
        self.assertEqual(data["minimum_valid_criteria"], 10)

        expected_14 = [
            "slope",
            "lithology",
            "rainfall_10_year",
            "relative_relief",
            "lineament_density",
            "drainage_density",
            "twi",
            "geomorphology",
            "lulc",
            "soil",
            "distance_to_faults",
            "distance_to_roads",
            "aspect",
            "ndvi",
        ]
        for crit in expected_14:
            self.assertIn(
                crit, data["criteria"], f"Missing landslide criterion: {crit}"
            )

    # 8. Canonical raster resolution
    def test_canonical_raster_resolution(self):
        r = self.client.get("/api/v1/layers?model_id=all")
        self.assertEqual(r.status_code, 200)
        layers = r.json()
        self.assertGreaterEqual(len(layers), 62)

        # Verify no local filesystem paths are leaked to clients
        for layer in layers:
            self.assertNotIn("C:", layer["relative_path"])
            self.assertNotIn("\\", layer["relative_path"])
            self.assertEqual(layer["status"], "published")

    # 9. Path traversal rejection
    def test_path_traversal_rejection(self):
        root = settings.get_package_root("landslide_14_factor_v1")
        with self.assertRaises(ValueError):
            repository.safe_resolve_raster_path(root, "../../sensitive_system_file.txt")
        with self.assertRaises(ValueError):
            repository.safe_resolve_raster_path(root, "/etc/passwd")

    # 10. Point query: structured evidence (Phase 6 contract)
    def test_point_query_flood_full_evidence(self):
        r = self.client.get(
            "/api/v1/analyses/flood_11_factor_v1/point?lat=31.86450&lon=76.79195"
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()

        # Phase 6 Target Contract assertions
        self.assertIn("location", data)
        self.assertEqual(data["location"]["lat"], 31.86450)
        self.assertIn("model", data)
        self.assertEqual(data["model"]["id"], "flood_11_factor_v1")
        self.assertIn("final", data)
        self.assertEqual(data["final"]["status"], "VALID")
        self.assertIsNotNone(data["final"]["score"])

        # Criteria structured dictionary assertions
        self.assertIn("criteria", data)
        self.assertEqual(len(data["criteria"]), 11)
        slope_c = data["criteria"]["slope"]
        self.assertEqual(slope_c["status"], "VALID")
        self.assertIsNotNone(slope_c["raw_value"])
        self.assertIsNotNone(slope_c["rating"])
        self.assertAlmostEqual(slope_c["weight"], 0.230588, places=3)

        # Backward compatibility assertions for React UI
        self.assertEqual(data["final_status"], "VALID")
        self.assertEqual(data["evidence_count"], 11)
        self.assertEqual(len(data["criteria_list"]), 11)

    # 11. NoData point query: strict null semantics
    def test_point_query_flood_partial_evidence(self):
        r = self.client.get(
            "/api/v1/analyses/flood_11_factor_v1/point?lat=32.21646&lon=76.56746"
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()

        self.assertEqual(data["final_status"], "PARTIAL_EVIDENCE")
        self.assertIn("soil", data["missing_criteria"])

        # Soil must have strict null semantics: never substituted with 0, 1, or 5
        soil_entry = data["criteria"]["soil"]
        self.assertEqual(soil_entry["status"], "NODATA")
        self.assertIsNone(soil_entry["raw_value"])
        self.assertIsNone(soil_entry["rating"])

    # 12. Coordinate bounds check: outside analysis area
    def test_point_query_outside_boundary(self):
        r = self.client.get(
            "/api/v1/analyses/flood_11_factor_v1/point?lat=25.0&lon=80.0"
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["final_status"], "OUTSIDE_ANALYSIS_AREA")
        self.assertIsNone(data["final"]["score"])
        self.assertEqual(data["criteria"]["slope"]["status"], "OUTSIDE_ANALYSIS_AREA")

    # 13. CRS transformation & Landslide point query
    def test_crs_transformation_landslide(self):
        # Coordinates in Shimla (WGS84 31.1048, 77.1734) -> reprojected to UTM Zone 43N
        r = self.client.get(
            "/api/v1/analyses/landslide_14_factor_v1/point?lat=31.1048&lon=77.1734"
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()

        self.assertEqual(data["model"]["id"], "landslide_14_factor_v1")
        self.assertIn(data["final"]["status"], ["VALID", "PARTIAL_EVIDENCE"])
        self.assertGreaterEqual(data["evidence_count"], 10)
        self.assertEqual(len(data["criteria"]), 14)

        # Verify real raster values sampled from UTM Run #63 rasters
        slope = data["criteria"]["slope"]
        self.assertEqual(slope["status"], "VALID")
        self.assertGreater(slope["raw_value"], 0.0)
        self.assertAlmostEqual(slope["weight"], 0.23, places=2)

    # 14. Flood regression statistics (Run #56)
    def test_statistics_flood(self):
        r = self.client.get("/api/v1/analyses/flood_11_factor_v1/statistics")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["source_run_id"], 56)
        self.assertEqual(data["valid_pixels"], 73000293)
        self.assertEqual(len(data["class_distribution"]), 5)
        self.assertEqual(len(data["evidence_distribution"]), 4)

    # 15. Landslide real data statistics (Run #63)
    def test_statistics_landslide(self):
        r = self.client.get("/api/v1/analyses/landslide_14_factor_v1/statistics")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["source_run_id"], 63)
        self.assertEqual(data["valid_pixels"], 61206868)
        self.assertEqual(data["crs"], "EPSG:32643")
        self.assertEqual(len(data["class_distribution"]), 5)
        self.assertGreaterEqual(len(data["evidence_distribution"]), 5)

    # 16. Legacy aliases resolution
    def test_legacy_aliases_resolve(self):
        legacy_full = "flood_11_factor_v1_full_suitability"
        r = self.client.get(f"/api/v1/layers/{legacy_full}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            r.json()["product_id"], "flood_11_factor_v1_available_evidence_suitability"
        )

        legacy_cls = "flood_11_factor_v1_full_suitability_classified"
        r = self.client.get(f"/api/v1/layers/{legacy_cls}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            r.json()["product_id"],
            "flood_11_factor_v1_available_evidence_suitability_classified",
        )

    # 17. Multi-model tile rendering
    def test_tile_rendering(self):
        # Flood tile (EPSG:4326 source)
        r = self.client.get(
            "/api/v1/tiles/flood_11_factor_v1_available_evidence_suitability_classified/8/182/104.png"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "image/png")
        self.assertGreater(len(r.content), 1000)

        # Landslide tile (EPSG:32643 UTM source)
        r2 = self.client.get(
            "/api/v1/tiles/landslide_14_factor_v1_available_evidence_suitability_classified/8/182/104.png"
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.headers["content-type"], "image/png")
        self.assertGreater(len(r2.content), 1000)

    # 18. Security: No filesystem paths leaked in health or metadata
    def test_security_no_paths_leaked(self):
        r = self.client.get("/api/v1/health")
        self.assertEqual(r.status_code, 200)
        for val in r.json().values():
            if isinstance(val, str):
                self.assertNotIn("C:", val)
                self.assertNotIn("\\", val)
                self.assertNotIn("/Users/", val)

    # 19. Same-location validation: Continuous vs Classified synchronization
    def test_same_location_continuous_classified_sync(self):
        # Point 1: 31.8645, 76.7920
        r1 = self.client.get(
            "/api/v1/analyses/landslide_14_factor_v1/point?lat=31.86450&lon=76.79200"
        )
        self.assertEqual(r1.status_code, 200)
        d1 = r1.json()
        self.assertEqual(d1["location"]["lat"], 31.86450)
        self.assertEqual(d1["location"]["lon"], 76.79200)
        self.assertAlmostEqual(d1["continuous_score"], 2.4725, places=3)
        self.assertEqual(d1["classified_value"], 2)
        self.assertEqual(d1["class_label"], "Low Susceptibility")
        # Class 2 range is 2.0 to 3.0: continuous_score must fall inside
        self.assertTrue(2.0 <= d1["continuous_score"] < 3.0)

        # Point 2: 32.0599, 76.9306
        r2 = self.client.get(
            "/api/v1/analyses/landslide_14_factor_v1/point?lat=32.05990&lon=76.93060"
        )
        self.assertEqual(r2.status_code, 200)
        d2 = r2.json()
        self.assertEqual(d2["location"]["lat"], 32.05990)
        self.assertEqual(d2["location"]["lon"], 76.93060)
        self.assertAlmostEqual(d2["continuous_score"], 2.6374, places=3)
        self.assertEqual(d2["classified_value"], 2)
        self.assertEqual(d2["class_label"], "Low Susceptibility")
        self.assertTrue(2.0 <= d2["continuous_score"] < 3.0)


if __name__ == "__main__":
    unittest.main()
