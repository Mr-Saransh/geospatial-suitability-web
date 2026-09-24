"""
Targeted tests for the canonical Himachal Pradesh Spatial Knowledge Package backend.

Validates:
- Package and manifest load correctly
- All 28 published rasters are discoverable
- No duplicate product IDs or display names
- Aliases resolve transparently
- Point inspection for Full Evidence, Partial Evidence, and Outside Area
- Coverage & missing criteria bitmask decoding
- Tile rendering for classified, continuous, and quality rasters
- Real statistics matching Run #56
"""
import unittest
from fastapi.testclient import TestClient
from app.main import app


class TestCanonicalPackage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    def test_package_health(self):
        r = self.client.get("/api/v1/health")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["package_found"])
        self.assertEqual(data["model_id"], "flood_11_factor_v1")
        self.assertEqual(data["source_run_id"], 56)
        self.assertEqual(data["total_published_rasters"], 28)
        self.assertEqual(data["factor_count"], 11)
        self.assertEqual(data["rating_count"], 11)
        self.assertEqual(data["result_count"], 4)
        self.assertEqual(data["quality_count"], 2)
        # Verify no local filesystem paths are leaked
        for key, val in data.items():
            if isinstance(val, str):
                self.assertNotIn("C:", val)
                self.assertNotIn("\\", val)

    def test_package_metadata(self):
        r = self.client.get("/api/v1/metadata/package")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["total_published_rasters"], 28)
        self.assertEqual(data["state_name"], "Himachal Pradesh")
        self.assertEqual(data["model_id"], "flood_11_factor_v1")
        self.assertEqual(data["minimum_valid_criteria"], 8)
        self.assertIn("AVAILABLE_EVIDENCE_RENORMALIZED", data["scoring_modes"])
        self.assertIn("STRICT_11_OF_11", data["scoring_modes"])

    def test_all_28_rasters_discovered(self):
        r = self.client.get("/api/v1/layers")
        self.assertEqual(r.status_code, 200)
        layers = r.json()
        self.assertEqual(len(layers), 28)

        product_ids = [l["product_id"] for l in layers]
        self.assertEqual(len(set(product_ids)), 28, "Duplicate product IDs found")

        # Display names must be completely unique
        display_names = [l["display_name"] for l in layers]
        self.assertEqual(len(set(display_names)), 28, f"Duplicate display names found: {display_names}")

        # Verify factors and ratings have distinguishing names
        for crit in ["rainfall", "slope", "distance_to_rivers", "elevation", "twi"]:
            factor = next(l for l in layers if l["product_id"] == crit)
            rating = next(l for l in layers if l["product_id"] == f"{crit}_rating")
            self.assertNotEqual(factor["display_name"], rating["display_name"])
            self.assertIn("Raw", factor["display_name"])
            self.assertIn("Rating", rating["display_name"])

    def test_legacy_aliases_resolve(self):
        # Old product IDs from run 51/earlier
        legacy_full = "flood_11_factor_v1_full_suitability"
        r = self.client.get(f"/api/v1/layers/{legacy_full}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["product_id"], "flood_11_factor_v1_available_evidence_suitability")

        legacy_cls = "flood_11_factor_v1_full_suitability_classified"
        r = self.client.get(f"/api/v1/layers/{legacy_cls}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["product_id"], "flood_11_factor_v1_available_evidence_suitability_classified")

    def test_point_inspection_full_evidence(self):
        # Coordinate with full 11/11 criteria
        r = self.client.get("/api/v1/analyses/flood_11_factor_v1/point?lat=31.86450&lon=76.79195")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["final_status"], "VALID")
        self.assertEqual(data["evidence_count"], 11)
        self.assertEqual(data["missing_criteria"], [])
        self.assertIsNotNone(data["continuous_score"])
        self.assertIsNotNone(data["strict_score"])
        self.assertEqual(len(data["criteria"]), 11)
        for c in data["criteria"]:
            self.assertEqual(c["status"], "VALID")
            self.assertIsNotNone(c["raw_value"])
            self.assertIsNotNone(c["rating"])

    def test_point_inspection_partial_evidence(self):
        # Coordinate with partial evidence (soil missing)
        r = self.client.get("/api/v1/analyses/flood_11_factor_v1/point?lat=32.21646&lon=76.56746")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["final_status"], "PARTIAL_EVIDENCE")
        self.assertGreaterEqual(data["evidence_count"], 8)
        self.assertIn("soil", data["missing_criteria"])
        self.assertIsNotNone(data["continuous_score"])
        self.assertIsNone(data["strict_score"])
        # For missing soil, raw_value and rating must be None (never 0, 1, or 5)
        soil_entry = next(c for c in data["criteria"] if c["criterion"] == "soil")
        self.assertEqual(soil_entry["status"], "NODATA")
        self.assertIsNone(soil_entry["raw_value"])
        self.assertIsNone(soil_entry["rating"])
        self.assertIsNone(soil_entry["contribution"])

    def test_point_inspection_outside_boundary(self):
        # Coordinate far outside Himachal Pradesh
        r = self.client.get("/api/v1/analyses/flood_11_factor_v1/point?lat=25.0&lon=80.0")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["final_status"], "OUTSIDE_ANALYSIS_AREA")
        self.assertIsNone(data["continuous_score"])
        self.assertIsNone(data["classified_value"])
        self.assertEqual(data["evidence_count"], 0)
        for c in data["criteria"]:
            self.assertEqual(c["status"], "OUTSIDE_ANALYSIS_AREA")
            self.assertIsNone(c["raw_value"])

    def test_tile_rendering(self):
        # Test classified suitability tile
        r = self.client.get("/api/v1/tiles/flood_11_factor_v1_available_evidence_suitability_classified/8/182/104.png")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "image/png")
        self.assertGreater(len(r.content), 1000)

        # Test quality raster tile
        r = self.client.get("/api/v1/tiles/flood_11_factor_v1_valid_criteria_count/8/182/104.png")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["content-type"], "image/png")

    def test_statistics(self):
        r = self.client.get("/api/v1/analyses/flood_11_factor_v1/statistics")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["source_run_id"], 56)
        self.assertEqual(data["scoring_mode"], "AVAILABLE_EVIDENCE_RENORMALIZED")
        self.assertEqual(data["valid_pixels"], 73000293)
        self.assertEqual(len(data["class_distribution"]), 5)
        self.assertEqual(len(data["evidence_distribution"]), 4)


if __name__ == "__main__":
    unittest.main()
