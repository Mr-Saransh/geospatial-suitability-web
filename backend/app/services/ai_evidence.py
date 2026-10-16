"""
GIS Evidence Retrieval Service V2.

Extracts real, verifiable geospatial evidence from the canonical
Spatial Knowledge Packages and backend analysis services before passing
structured facts to the local Ollama LLM.

Supports:
- Dynamic model discovery across all models in repository
- Multi-model comparison (Flood AHP vs Landslide MCDA)
- Structured atomic evidence items with source provenance, units, and categories
- Strict preservation of authoritative GIS calculations
- Windowed point sampling and statewide raster statistics
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.services.raster_service import compute_statistics, point_inspection
from app.services.repository import (
    CRITERION_CATEGORIES,
    CRITERION_DISPLAY_NAMES,
    CRITERION_UNITS,
    repository,
)
from app.services.weights import MODELS_REGISTRY, get_model_config

logger = logging.getLogger(__name__)

# Bounding box for Himachal Pradesh
HP_BOUNDS = {
    "min_lon": 75.57855,
    "min_lat": 30.38430,
    "max_lon": 78.99682,
    "max_lat": 33.25577,
}

STATISTICAL_KEYWORDS = (
    "statistic",
    "stats",
    "distribution",
    "mean",
    "average",
    "coverage",
    "area",
    "percent",
    "percentage",
    "statewide",
    "overall",
    "total",
    "highest",
    "lowest",
    "dominant",
    "breakdown",
    "extent",
    "sq km",
)

COMPARISON_KEYWORDS = (
    "compare",
    "comparison",
    "difference",
    "different",
    "versus",
    " vs ",
    "vs.",
    "both models",
    "flood and landslide",
    "landslide and flood",
)

GREETING_WORDS = {
    "hi",
    "hello",
    "hey",
    "hey there",
    "hello there",
    "hi there",
    "good morning",
    "good afternoon",
    "good evening",
    "howdy",
    "greetings",
    "yo",
    "sup",
    "who are you",
    "what are you",
    "what can you do",
    "help",
    "how can you help",
    "start",
    "intro",
}


def is_greeting_or_intro(question: str) -> bool:
    """Detect if the input is a greeting or general introduction inquiry."""
    cleaned = question.strip().lower().rstrip("!?.")
    if not cleaned:
        return False
    if cleaned in GREETING_WORDS:
        return True
    words = cleaned.split()
    if len(words) <= 3 and any(w in GREETING_WORDS for w in words):
        spatial_terms = {
            "flood", "landslide", "risk", "slope", "score", "mandi", "shimla",
            "layer", "weight", "criteria", "coordinate", "raster", "elevation"
        }
        if not any(st in words for st in spatial_terms):
            return True
    return False


COORDINATE_KEYWORDS = (
    "here",
    "this place",
    "this location",
    "this point",
    "this spot",
    "this site",
    "this area",
    "these coordinates",
    "selected point",
    "clicked point",
    "my location",
    "at point",
    "at coordinate",
    "at coords",
    "coordinate",
    "coordinates",
    "latitude",
    "longitude",
    "lat",
    "lon",
    "lng",
    "build",
    "house",
    "home",
    "building",
    "construct",
    "construction",
    "safe to build",
    "suitable",
    "suitability",
    "risk here",
    "hazard here",
    "flood here",
    "landslide here",
    "score here",
    "limiting criteria",
    "limiting factor",
    "top factor",
    "primary factor",
    "contributing factor",
    "why is this",
    "why classified",
    "why very low",
    "why low",
    "why moderate",
    "why high",
    "why very high",
    "why class",
    "shimla",
    "mandi",
    "kullu",
    "manali",
    "solan",
    "dharamshala",
    "kangra",
    "chamba",
    "bilaspur",
    "una",
    "hamirpur",
    "kinnaur",
    "lahaul",
    "spiti",
)

DATA_KEYWORDS = (
    "data",
    "dataset",
    "datasets",
    "evidence",
    "facts",
    "inspect facts",
    "weight",
    "weights",
    "statistic",
    "statistics",
    "stats",
    "distribution",
    "percentage",
    "percent",
    "breakdown",
    "coverage",
    "raster",
    "pixel",
    "raw value",
    "matrix",
    "pairwise",
    "consistency ratio",
    "cr value",
    "values",
    "numbers",
    "compare models",
    "model comparison",
    "criteria",
)

CONCEPTUAL_PREFIXES = (
    "what is gis",
    "what's gis",
    "what does gis",
    "define gis",
    "explain gis",
    "meaning of gis",
    "what is mcda",
    "what is ahp",
    "what is remote sensing",
    "what is dem",
    "what is digital elevation",
    "who are you",
    "what are you",
    "what can you do",
    "how does this work",
    "how do you work",
    "tell me a joke",
)


def is_coordinate_or_data_question(question: str) -> bool:
    """
    Determine whether the user specifically asks about:
    1. Geographic coordinates, location, map points, or site suitability / construction.
    2. Model data, criteria weights, factor values, statistics, or evidence inspection.

    Returns False for normal conversation, greetings, definitions, and conceptual questions
    (e.g., 'what is gis?', 'what is gis in 10 words?', 'hello', 'who are you?').
    """
    q_clean = question.strip().lower()
    if not q_clean:
        return False

    if is_greeting_or_intro(q_clean):
        return False

    # Check for conceptual questions like "what is gis in 10 words?"
    for prefix in CONCEPTUAL_PREFIXES:
        if q_clean.startswith(prefix) or q_clean == prefix:
            # Only treat as data/coordinate if explicitly asking for data or this point
            if not any(k in q_clean for k in ("here", "this point", "this location", "my coordinate", "data", "weight", "fact")):
                return False

    # Coordinate / Location / Construction inquiries
    if any(k in q_clean for k in COORDINATE_KEYWORDS):
        return True

    # Check for numeric coordinates like "31.25, 77.62"
    if re.search(r"\b\d{1,3}\.\d{2,}\b", q_clean):
        return True

    # Data / Factor / Weight / Statistics inquiries
    if any(k in q_clean for k in DATA_KEYWORDS):
        return True

    # Layer-specific data inquiries (e.g., "what is the slope value?", "rainfall numbers")
    layer_names = (
        "slope", "rainfall", "flow accumulation", "elevation",
        "distance to rivers", "twi", "aspect", "curvature",
        "soil", "lithology", "land use", "lulc", "ndvi", "fault"
    )
    if any(layer in q_clean for layer in layer_names):
        data_terms = ("value", "number", "level", "contrib", "rating", "measure", "score", "high", "low", "much", "many", "how steep", "data")
        if any(dt in q_clean for dt in data_terms):
            return True

    return False


def is_comparison_question(question: str) -> bool:
    """Determine whether the question asks for a multi-model comparison."""
    q_lower = question.lower()
    return any(k in q_lower for k in COMPARISON_KEYWORDS) or (
        "flood" in q_lower and "landslide" in q_lower
    )


def resolve_model_id(model_id: str | None, question: str) -> str:
    """Resolve model_id with intelligent fallback based on question text."""
    if model_id:
        m_lower = model_id.lower()
        if "landslide" in m_lower:
            return "landslide_14_factor_v1"
        if "flood" in m_lower:
            return "flood_11_factor_v1"
        if model_id in repository.models:
            return model_id

    # Infer from question text
    q_lower = question.lower()
    if "landslide" in q_lower or "slope failure" in q_lower or "rockfall" in q_lower:
        return "landslide_14_factor_v1"

    # Default to flood model
    return "flood_11_factor_v1"


def create_evidence_item(
    item_id: str,
    model_id: str,
    category: str,
    label: str,
    value: Any,
    unit: str | None = None,
    source: str = "Spatial Knowledge Package",
    coordinates: dict[str, float] | None = None,
    coverage_status: str | None = None,
    caveats: str | None = None,
) -> dict[str, Any]:
    """Create a standardized, auditable atomic evidence item."""
    return {
        "id": item_id,
        "model_id": model_id,
        "category": category,
        "label": label,
        "value": value,
        "unit": unit,
        "source": source,
        "coordinates": coordinates,
        "coverage_status": coverage_status,
        "caveats": caveats,
    }


def retrieve_gis_evidence(
    question: str,
    model_id: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    """
    Retrieve genuine GIS evidence matching the query context.
    Never invents raster values, classifications, statistics, or boundaries.
    """
    is_comparison = is_comparison_question(question)
    resolved_id = resolve_model_id(model_id, question)
    model_cfg = get_model_config(resolved_id)

    # Check if the user specifically asked for coordinate or data evidence
    is_coord_or_data = is_coordinate_or_data_question(question)
    if not is_coord_or_data:
        # Normal conversation / conceptual inquiry:
        # Do NOT extract point evidence or attach facts accordion
        return {
            "model_id": resolved_id,
            "evidence": None,
            "items": [],
            "warnings": [],
            "coverage": "Statewide Package",
            "is_data_query": False,
            "show_evidence": False,
        }

    warnings: list[str] = []
    items: list[dict[str, Any]] = []

    weights_list = []
    if model_cfg:
        for crit in model_cfg.criteria:
            w = model_cfg.weights.get(crit, 0.0)
            weights_list.append({"criterion": crit, "weight": round(float(w), 4)})
            items.append(
                create_evidence_item(
                    item_id=f"{resolved_id}:weight:{crit}",
                    model_id=resolved_id,
                    category="criteria_weights",
                    label=f"{CRITERION_DISPLAY_NAMES.get(crit, crit.replace('_', ' ').title())} Weight",
                    value=round(float(w) * 100, 2),
                    unit="%",
                    source=f"{model_cfg.name} (Matrix Config)",
                    caveats=f"Category: {CRITERION_CATEGORIES.get(crit, 'Environmental')}",
                )
            )

    ranges_list = []
    if model_cfg:
        for k, v in model_cfg.classification_ranges.items():
            label = model_cfg.classification_labels.get(k, f"Class {k}")
            ranges_list.append({
                "class": k,
                "label": label,
                "min": v[0],
                "max": v[1],
            })
            items.append(
                create_evidence_item(
                    item_id=f"{resolved_id}:range:class_{k}",
                    model_id=resolved_id,
                    category="model_metadata",
                    label=f"Class {k} Range: {label}",
                    value=f"[{v[0]:.2f} - {v[1]:.2f}]",
                    unit="score",
                    source=f"{model_cfg.name} Classification Standard",
                )
            )

    # Base evidence structure
    evidence: dict[str, Any] = {
        "model_id": resolved_id,
        "model_name": model_cfg.name if model_cfg else resolved_id,
        "state_name": "Himachal Pradesh",
        "bounding_box": HP_BOUNDS,
        "criteria_count": len(model_cfg.criteria) if model_cfg else 0,
        "criteria_weights": weights_list,
        "consistency_ratio": model_cfg.consistency_ratio if model_cfg else None,
        "classification_ranges": ranges_list,
        "items": items,
    }

    # Model metadata evidence items
    if model_cfg:
        items.append(
            create_evidence_item(
                item_id=f"{resolved_id}:meta:methodology",
                model_id=resolved_id,
                category="model_metadata",
                label="Scoring Methodology",
                value=model_cfg.metadata.get("method", "Multi-Criteria Decision Analysis"),
                source="Package Specification",
            )
        )
        if model_cfg.consistency_ratio is not None and model_cfg.consistency_ratio > 0:
            items.append(
                create_evidence_item(
                    item_id=f"{resolved_id}:meta:cr",
                    model_id=resolved_id,
                    category="model_metadata",
                    label="AHP Consistency Ratio (CR)",
                    value=round(model_cfg.consistency_ratio, 4),
                    unit="ratio",
                    source="Saaty Pairwise Evaluation (AHP Run #56)",
                    caveats="CR <= 0.10 confirms matrix consistency",
                )
            )

    # 1. Multi-Model Comparison Evidence (if comparing models)
    if is_comparison:
        other_id = (
            "landslide_14_factor_v1"
            if resolved_id == "flood_11_factor_v1"
            else "flood_11_factor_v1"
        )
        other_cfg = get_model_config(other_id)
        if model_cfg and other_cfg:
            common_criteria = sorted(
                set(model_cfg.criteria).intersection(set(other_cfg.criteria))
            )
            distinct_primary = sorted(
                set(model_cfg.criteria).difference(set(other_cfg.criteria))
            )
            distinct_other = sorted(
                set(other_cfg.criteria).difference(set(model_cfg.criteria))
            )

            comparison_block = {
                "models": [resolved_id, other_id],
                "primary_model": {
                    "id": resolved_id,
                    "name": model_cfg.name,
                    "criteria_count": len(model_cfg.criteria),
                    "crs": "EPSG:4326" if "flood" in resolved_id else "EPSG:32643",
                    "method": model_cfg.metadata.get("method"),
                },
                "comparison_model": {
                    "id": other_id,
                    "name": other_cfg.name,
                    "criteria_count": len(other_cfg.criteria),
                    "crs": "EPSG:4326" if "flood" in other_id else "EPSG:32643",
                    "method": other_cfg.metadata.get("method"),
                },
                "common_criteria": common_criteria,
                "primary_unique_criteria": distinct_primary,
                "comparison_unique_criteria": distinct_other,
            }
            evidence["model_comparison"] = comparison_block

            items.append(
                create_evidence_item(
                    item_id="comparison:criteria_count",
                    model_id="multi_model",
                    category="model_comparison",
                    label="Model Factor Comparison",
                    value=f"{model_cfg.name} ({len(model_cfg.criteria)} factors) vs {other_cfg.name} ({len(other_cfg.criteria)} factors)",
                    source="Package Specifications",
                )
            )
            items.append(
                create_evidence_item(
                    item_id="comparison:common_criteria",
                    model_id="multi_model",
                    category="model_comparison",
                    label="Shared Spatial Factors",
                    value=", ".join(common_criteria),
                    source="Criteria Cross-Reference",
                )
            )

    # 2. Point Inspection Evidence (if coordinates provided)
    if latitude is not None and longitude is not None:
        coords_dict = {"latitude": latitude, "longitude": longitude}
        evidence["coordinates"] = coords_dict

        in_bounds = (
            HP_BOUNDS["min_lat"] <= latitude <= HP_BOUNDS["max_lat"]
            and HP_BOUNDS["min_lon"] <= longitude <= HP_BOUNDS["max_lon"]
        )

        if not in_bounds:
            evidence["location_status"] = "OUTSIDE_ANALYSIS_AREA"
            warn = (
                f"Coordinates ({latitude:.4f}°N, {longitude:.4f}°E) are OUTSIDE the "
                "Himachal Pradesh state analysis area (30.38°N–33.26°N, 75.58°E–79.00°E)."
            )
            warnings.append(warn)
            evidence["point_inspection"] = {
                "status": "OUTSIDE_ANALYSIS_AREA",
                "coverage_status": "UNAVAILABLE",
                "score": None,
                "class": None,
                "note": warn,
            }
            items.append(
                create_evidence_item(
                    item_id="point:status:boundary",
                    model_id=resolved_id,
                    category="point_inspection",
                    label="Geographic Boundary Check",
                    value="OUTSIDE_ANALYSIS_AREA",
                    source="State Boundary Vector Layer",
                    coordinates=coords_dict,
                    caveats=warn,
                )
            )
        else:
            try:
                pt_result = point_inspection(resolved_id, latitude, longitude)
                evidence["location_status"] = pt_result.get(
                    "coverage_status", "UNKNOWN"
                )

                if "error" in pt_result:
                    warnings.append(f"Point sampling issue: {pt_result['error']}")
                    evidence["point_inspection"] = {"error": pt_result["error"]}
                else:
                    final_block = pt_result.get("final") or {}
                    score = (
                        pt_result.get("continuous_score")
                        if pt_result.get("continuous_score") is not None
                        else (
                            pt_result.get("suitability_score")
                            if pt_result.get("suitability_score") is not None
                            else final_block.get("score")
                        )
                    )
                    cls_val = (
                        pt_result.get("classified_value")
                        if pt_result.get("classified_value") is not None
                        else final_block.get("class")
                    )
                    cls_label = (
                        pt_result.get("class_label")
                        or final_block.get("label")
                        or (f"Class {cls_val}" if cls_val is not None else None)
                    )
                    cov_status = (
                        final_block.get("status")
                        or pt_result.get("final_status")
                        or pt_result.get("coverage_status", "VALID")
                    )
                    evidence_count = pt_result.get(
                        "evidence_count"
                    ) or pt_result.get("valid_criteria_count", 0)
                    evidence_total = pt_result.get(
                        "evidence_total"
                    ) or pt_result.get("total_criteria_count", 0)
                    missing_crit = (
                        pt_result.get("missing_criteria_names")
                        or pt_result.get("missing_criteria")
                        or []
                    )

                    evidence["suitability_score"] = score
                    evidence["suitability_class"] = cls_val
                    evidence["suitability_label"] = cls_label

                    # Factor contributions
                    raw_criteria = pt_result.get("criteria", [])
                    if isinstance(raw_criteria, dict):
                        criteria_list = [
                            {"name": k, **v}
                            if isinstance(v, dict)
                            else {"name": k, "value": v}
                            for k, v in raw_criteria.items()
                        ]
                    elif isinstance(raw_criteria, list):
                        criteria_list = raw_criteria
                    else:
                        criteria_list = []

                    sorted_factors = sorted(
                        [
                            c
                            for c in criteria_list
                            if c.get("contribution") is not None
                        ],
                        key=lambda x: x.get("contribution", 0),
                        reverse=True,
                    )

                    top_factors_list = [
                        {
                            "criterion": f.get("name") or f.get("criterion_id"),
                            "raw_value": f.get("raw_value"),
                            "rating": f.get("rating"),
                            "weight": f.get("weight"),
                            "contribution": f.get("contribution"),
                        }
                        for f in (
                            sorted_factors[:4]
                            if sorted_factors
                            else criteria_list[:4]
                        )
                    ]

                    limiting_factors_list = [
                        {
                            "criterion": f.get("name") or f.get("criterion_id"),
                            "raw_value": f.get("raw_value"),
                            "rating": f.get("rating"),
                        }
                        for f in criteria_list
                        if f.get("classification") == "limiting"
                        or f.get("rating") == 1
                    ]

                    evidence["point_inspection"] = {
                        "coverage_status": cov_status,
                        "valid_criteria_count": evidence_count,
                        "total_criteria_count": evidence_total,
                        "missing_criteria": missing_crit,
                        "suitability_score": score,
                        "suitability_class": cls_val,
                        "suitability_label": cls_label,
                        "top_factors": top_factors_list,
                        "limiting_factors": limiting_factors_list,
                    }

                    # Add structured items for point
                    if score is not None:
                        items.append(
                            create_evidence_item(
                                item_id="point:suitability_score",
                                model_id=resolved_id,
                                category="point_inspection",
                                label="Continuous Suitability Score",
                                value=round(score, 3),
                                unit="score (1-5)",
                                source="Raster Point Inspection (1x1 Window)",
                                coordinates=coords_dict,
                                coverage_status=cov_status,
                            )
                        )
                    if cls_val is not None:
                        items.append(
                            create_evidence_item(
                                item_id="point:suitability_class",
                                model_id=resolved_id,
                                category="point_inspection",
                                label="Suitability Classification",
                                value=f"Class {cls_val}: {cls_label}",
                                source="AHP Classification Thresholds",
                                coordinates=coords_dict,
                                coverage_status=cov_status,
                            )
                        )
                    items.append(
                        create_evidence_item(
                            item_id="point:coverage_status",
                            model_id=resolved_id,
                            category="point_inspection",
                            label="Evidence Coverage",
                            value=f"{evidence_count}/{evidence_total} valid criteria ({cov_status})",
                            source="Bitmask Coverage Raster",
                            coordinates=coords_dict,
                            coverage_status=cov_status,
                        )
                    )

                    for tf in top_factors_list:
                        crit_name = tf.get("criterion") or "unknown"
                        unit = CRITERION_UNITS.get(crit_name, "")
                        c_val = tf.get("contribution")
                        contrib_str = (
                            f"{c_val:.2f}"
                            if isinstance(c_val, (int, float))
                            else "N/A"
                        )
                        items.append(
                            create_evidence_item(
                                item_id=f"point:factor:{crit_name}",
                                model_id=resolved_id,
                                category="point_inspection",
                                label=f"Primary Factor: {CRITERION_DISPLAY_NAMES.get(crit_name, crit_name)}",
                                value=f"raw: {tf.get('raw_value')} {unit} | rating: {tf.get('rating')}/5 | contrib: {contrib_str}",
                                unit=unit,
                                source=f"Raster: {crit_name}",
                                coordinates=coords_dict,
                            )
                        )

                    if cov_status == "PARTIAL_EVIDENCE":
                        warn = (
                            f"Partial evidence at this location: {len(missing_crit)} criteria "
                            f"missing ({', '.join(missing_crit)}). Score renormalized across available evidence."
                        )
                        warnings.append(warn)
                    elif cov_status == "NODATA":
                        warn = "Location falls in a NoData mask area across essential layers."
                        warnings.append(warn)

            except Exception as e:
                logger.error(
                    "Failed to inspect point at (%f, %f): %s",
                    latitude,
                    longitude,
                    e,
                )
                warnings.append(f"Point inspection could not be computed: {str(e)}")
    else:
        q_lower = question.lower()
        if any(
            w in q_lower
            for w in (
                "here",
                "this point",
                "this location",
                "my coordinate",
                "at this place",
            )
        ):
            warnings.append(
                "No coordinates supplied. For location-specific analysis, click on the map or provide lat/lon."
            )

    # 3. Statistics Evidence (if statistical question or overview asked)
    q_lower = question.lower()
    needs_stats = any(k in q_lower for k in STATISTICAL_KEYWORDS) or (
        latitude is None and "what is" in q_lower and "model" in q_lower
    )

    if needs_stats:
        try:
            stats = compute_statistics(resolved_id)
            if "error" not in stats:
                evidence["statistics"] = {
                    "valid_coverage_pct": round(
                        stats.get("valid_coverage_pct", 0), 2
                    ),
                    "nodata_coverage_pct": round(
                        stats.get("nodata_coverage_pct", 0), 2
                    ),
                    "score_mean": round(stats.get("score_mean", 0), 3)
                    if stats.get("score_mean") is not None
                    else None,
                    "score_min": stats.get("score_min"),
                    "score_max": stats.get("score_max"),
                    "score_std": round(stats.get("score_std", 0), 3)
                    if stats.get("score_std") is not None
                    else None,
                    "class_distribution": [
                        {
                            "class": cd.get("class_value"),
                            "label": cd.get("label"),
                            "percentage": round(cd.get("percentage", 0), 2),
                            "area_sq_km": round(cd.get("area_sq_km", 0), 1)
                            if cd.get("area_sq_km")
                            else None,
                        }
                        for cd in stats.get("class_distribution", [])
                    ],
                }

                items.append(
                    create_evidence_item(
                        item_id=f"{resolved_id}:stats:valid_coverage",
                        model_id=resolved_id,
                        category="statistics",
                        label="Statewide Valid Coverage",
                        value=round(stats.get("valid_coverage_pct", 0), 2),
                        unit="%",
                        source="Full Statewide Raster Coverage Analysis",
                    )
                )
                if stats.get("score_mean") is not None:
                    items.append(
                        create_evidence_item(
                            item_id=f"{resolved_id}:stats:mean_score",
                            model_id=resolved_id,
                            category="statistics",
                            label="Statewide Mean Score",
                            value=f"{stats.get('score_mean'):.2f} ± {stats.get('score_std', 0):.2f}",
                            unit="score",
                            source="Statewide Statistical Aggregate",
                        )
                    )
                for cd in stats.get("class_distribution", []):
                    items.append(
                        create_evidence_item(
                            item_id=f"{resolved_id}:stats:class_{cd.get('class_value')}",
                            model_id=resolved_id,
                            category="statistics",
                            label=f"Class {cd.get('class_value')} ({cd.get('label')}) Area",
                            value=f"{cd.get('percentage'):.1f}% ({cd.get('area_sq_km', 0):.0f} km²)",
                            source="Suitability Distribution Summary",
                        )
                    )
        except Exception as e:
            logger.warning(
                "Could not compute statistics for %s: %s", resolved_id, e
            )

    # 4. Available Layers summary
    layers = repository.get_layers_for_model(resolved_id)
    evidence["layers_count"] = len(layers)
    evidence["published_layers"] = [
        {
            "id": l.get("product_id"),
            "name": l.get("display_name"),
            "type": l.get("type"),
            "unit": l.get("unit"),
        }
        for l in layers[:10]
    ]

    return {
        "model_id": resolved_id,
        "evidence": evidence,
        "items": items,
        "warnings": warnings,
        "coverage": evidence.get("location_status")
        or (
            f"{evidence['statistics']['valid_coverage_pct']}% valid"
            if "statistics" in evidence
            else "Statewide Package"
        ),
        "is_data_query": True,
        "show_evidence": True,
    }


def format_evidence_for_prompt(evidence_result: dict[str, Any]) -> str:
    """Format structured evidence into clean, auditable markdown for Ollama."""
    ev = evidence_result.get("evidence")
    if not ev or not evidence_result.get("is_data_query", True):
        return "(General conceptual / normal conversation query — no specific location point or data facts requested. Answer directly, concisely, and conversationally.)"

    lines: list[str] = []

    lines.append(f"### MODEL: {ev.get('model_name')} ({ev.get('model_id')})")
    lines.append(f"- State/Region: {ev.get('state_name', 'Himachal Pradesh')}")
    lines.append(f"- Criteria Count: {ev.get('criteria_count')}")
    if ev.get("consistency_ratio") is not None:
        lines.append(
            f"- AHP Consistency Ratio (CR): {ev.get('consistency_ratio'):.4f} (Valid <= 0.10)"
        )

    # Model comparison details if present
    comp = ev.get("model_comparison")
    if comp:
        lines.append("\n### MULTI-MODEL COMPARISON:")
        pm = comp.get("primary_model", {})
        cm = comp.get("comparison_model", {})
        lines.append(f"- Model 1: {pm.get('name')} ({pm.get('criteria_count')} criteria, CRS {pm.get('crs')}, Method: {pm.get('method')})")
        lines.append(f"- Model 2: {cm.get('name')} ({cm.get('criteria_count')} criteria, CRS {cm.get('crs')}, Method: {cm.get('method')})")
        lines.append(f"- Shared Factors: {', '.join(comp.get('common_criteria', []))}")
        lines.append(f"- Unique to {pm.get('name')}: {', '.join(comp.get('primary_unique_criteria', []))}")
        lines.append(f"- Unique to {cm.get('name')}: {', '.join(comp.get('comparison_unique_criteria', []))}")

    # Criteria weights
    weights = ev.get("criteria_weights", [])
    if weights:
        top_weights = sorted(weights, key=lambda x: x["weight"], reverse=True)
        w_strs = [
            f"{w['criterion']} ({w['weight']*100:.1f}%)" for w in top_weights
        ]
        lines.append(f"- Factor Weights: {', '.join(w_strs)}")

    # Point inspection
    pt = ev.get("point_inspection")
    coords = ev.get("coordinates")
    if coords and pt:
        lines.append(
            f"\n### POINT INSPECTION at ({coords.get('latitude', 0):.4f}°N, {coords.get('longitude', 0):.4f}°E):"
        )
        lines.append(
            f"- Coverage Status: {pt.get('coverage_status', 'UNKNOWN')}"
        )
        score = pt.get("suitability_score")
        if score is not None:
            lines.append(
                f"- Calculated Suitability Score: {score:.2f} / 5.00 "
                f"(Class {pt.get('suitability_class')}: {pt.get('suitability_label')})"
            )
        if pt.get("missing_criteria"):
            lines.append(
                f"- Missing Criteria: {', '.join(pt.get('missing_criteria'))}"
            )
        top_factors = pt.get("top_factors", [])
        if top_factors:
            f_strs = []
            for f in top_factors:
                c_val = f.get("contribution")
                c_str = (
                    f"{c_val:.2f}"
                    if isinstance(c_val, (int, float))
                    else "N/A"
                )
                f_strs.append(
                    f"{f.get('criterion')} (raw={f.get('raw_value')}, rating={f.get('rating')}/5, contribution={c_str})"
                )
            lines.append(f"- Top Contributing Factors: {'; '.join(f_strs)}")
        limiting = pt.get("limiting_factors", [])
        if limiting:
            l_strs = [
                f"{f.get('criterion')} (rating={f.get('rating')})"
                for f in limiting
            ]
            lines.append(f"- Limiting Factors: {'; '.join(l_strs)}")

    # Statistics
    stats = ev.get("statistics")
    if stats:
        lines.append("\n### STATEWIDE STATISTICS:")
        lines.append(
            f"- Valid Analysis Coverage: {stats.get('valid_coverage_pct')}%"
        )
        lines.append(
            f"- Mean Score: {stats.get('score_mean')} (Std: {stats.get('score_std')})"
        )
        lines.append(
            f"- Score Range: [{stats.get('score_min')}, {stats.get('score_max')}]"
        )
        class_dist = stats.get("class_distribution", [])
        if class_dist:
            dist_strs = [
                f"{c['label']} (Class {c['class']}): {c['percentage']}%"
                for c in class_dist
            ]
            lines.append(f"- Class Distribution: {', '.join(dist_strs)}")

    # Warnings
    warnings = evidence_result.get("warnings", [])
    if warnings:
        lines.append("\n### LIMITATIONS & WARNINGS:")
        for w in warnings:
            lines.append(f"- {w}")

    return "\n".join(lines)
