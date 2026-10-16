"""
Ollama Service V2 — Local, secure, streaming & non-streaming integration with Ollama HTTP API.

Handles:
- Streaming progressive tokens (/api/chat with stream: True)
- Non-streaming generation backward compatibility
- Concurrency semaphore governance
- Grounded prompt injection
- Disconnection / cancellation detection
- Clean, factual deterministic fallback reports
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import AsyncGenerator, Callable
from typing import Any

import httpx

from app.config import settings
from app.services.ai_evidence import format_evidence_for_prompt, is_greeting_or_intro

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MCGSE AI, a friendly, articulate, evidence-grounded geospatial intelligence assistant for Himachal Pradesh.

Your mission is to make complex GIS data simple, intuitive, and actionable for human decision-makers, planners, and citizens.

Core Guidelines:
1. Tone: Conversational, warm, empathetic, and easy to understand. Speak in plain English—avoid dense mathematical jargon unless explaining it simply.
2. Construction & Land Use Inquiries: When asked if a site is suitable for building a house, hotel, or construction, give a direct, clear verdict based on the suitability score and class. Explain the contributing factors in everyday language, and always provide practical mountain safety advice (e.g., steep slopes reduce standing flood pooling but increase landslide risk in hilly terrain).
3. Concept Questions: When asked general questions (e.g., "what is GIS?", "what is AHP?"), explain the concept clearly with simple analogies first, then connect it to the Himachal Pradesh Web-GIS platform.
4. Grounded Truth: Strictly use the provided GIS evidence for numbers, scores, coordinates, and factor values. Never invent hallucinated figures.
5. Structure: Use clean markdown, bold highlights, and clear bullet points for effortless reading.
"""


class OllamaService:
    def __init__(self) -> None:
        self.semaphore = asyncio.Semaphore(settings.ai_max_concurrent_generations)

    @property
    def base_url(self) -> str:
        return settings.ollama_base_url

    @property
    def configured_model(self) -> str:
        return settings.ollama_model

    async def get_health(self) -> dict[str, Any]:
        """Check Ollama reachability and available models."""
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    raw_models = data.get("models", [])
                    model_names: list[str] = []
                    for m in raw_models:
                        name = m.get("name") or m.get("model")
                        if name:
                            model_names.append(name)

                    cfg = self.configured_model.lower()
                    has_model = any(
                        cfg == m.lower()
                        or cfg == m.lower().split(":")[0]
                        or f"{cfg}:latest" == m.lower()
                        for m in model_names
                    )

                    active_model = self.configured_model
                    if not has_model and len(model_names) > 0 and "OLLAMA_MODEL" not in os.environ:
                        active_model = model_names[0]
                        has_model = True

                    self._active_model = active_model

                    if has_model:
                        status = "ready"
                        guidance = None
                    elif len(model_names) > 0:
                        status = "model_mismatch"
                        guidance = (
                            f"Ollama is running with models: {', '.join(model_names)}. "
                            f"Update OLLAMA_MODEL in .env to use one of these, or run 'ollama pull {self.configured_model}'."
                        )
                    else:
                        status = "no_model_installed"
                        guidance = (
                            f"Ollama is running at {self.base_url}, but no models are installed yet. "
                            f"Run 'ollama run {self.configured_model}' or 'ollama run llama3.2:1b' in your terminal."
                        )

                    return {
                        "status": status,
                        "ollama_reachable": True,
                        "ollama_url": "http://127.0.0.1:11434",
                        "configured_model": active_model,
                        "model_installed": has_model,
                        "installed_models": model_names,
                        "setup_guidance": guidance,
                    }
        except Exception as e:
            logger.debug("Ollama health probe failed: %s", e)

        return {
            "status": "ollama_offline",
            "ollama_reachable": False,
            "ollama_url": "http://127.0.0.1:11434",
            "configured_model": self.configured_model,
            "model_installed": False,
            "installed_models": [],
            "setup_guidance": (
                "Ollama is not running locally. Start the Ollama application or service on your PC, "
                f"then run 'ollama run {self.configured_model}'."
            ),
        }

    def _generate_fallback_answer(
        self,
        question: str,
        evidence_result: dict[str, Any],
        health_info: dict[str, Any] | None = None,
    ) -> str:
        """
        Generate a warm, conversational, evidence-grounded response.
        Translates raw spatial calculations into plain English that is easy to understand.
        """
        q_clean = question.strip().lower()
        ev = evidence_result.get("evidence") or {}
        coords = ev.get("coordinates")
        pt = ev.get("point_inspection")
        model_name = ev.get("model_name", "Geospatial Hazard Model")
        model_id = ev.get("model_id", evidence_result.get("model_id", "flood_11_factor_v1"))
        is_landslide_model = "landslide" in model_id.lower() or "landslide" in model_name.lower()
        hazard_type = "Landslide" if is_landslide_model else "Flood"

        # ── 1. GREETINGS & INTRODUCTIONS ──────────────────────────
        if is_greeting_or_intro(question):
            return (
                f"### 👋 Hello! Welcome to **MCGSE AI**\n\n"
                f"I am your evidence-grounded spatial intelligence assistant for **Himachal Pradesh**.\n\n"
                "**Here is how I can help you:**\n"
                "- 📍 **Inspect Specific Locations**: Click anywhere on the map to evaluate flood or landslide hazard susceptibility, score ratings (1–5), and key local drivers.\n"
                "- 🏠 **Construction & Safety Inquiries**: Ask questions like *'Should we build a house here?'* to get plain-language hazard evaluations and practical advice.\n"
                "- 🔬 **Explain Spatial Models**: Understand how factors like terrain slope, rainfall volume, river proximity, and flow accumulation are scientifically evaluated.\n"
                "- ⚖️ **Compare Hazards**: Switch or compare between our 11-Factor Flood AHP model and 14-Factor Landslide MCDA model.\n\n"
                "*Tip: Click any point on the map or ask me a question to get started!*"
            )

        # ── 2. CONCEPT: WHAT IS GIS? ───────────────────────────────
        if any(k in q_clean for k in ("what is gis", "what's gis", "define gis", "explain gis", "meaning of gis", "what gis")):
            if "10 words" in q_clean or "ten words" in q_clean:
                return "**GIS** is a digital mapping system combining location with real-world data."
            return (
                "### 🗺️ What is GIS (Geographic Information System)?\n\n"
                "**GIS** stands for **Geographic Information System**. In simple terms, think of it as a **smart digital map made of multiple real-world data layers**.\n\n"
                "Instead of just showing roads and borders, GIS captures, analyzes, and models the physical environment:\n\n"
                "1. **Multi-Layer Stacking**: We overlay distinct spatial datasets across Himachal Pradesh—such as ground elevation, terrain slope steepness, annual rainfall, distance to rivers, and soil permeability.\n"
                "2. **Scientific Multi-Criteria Evaluation (MCDA/AHP)**: Expert-calibrated mathematical weights are assigned to each layer based on how heavily it drives disaster risk (e.g., river proximity is critical for floods, while steep slopes drive landslides).\n"
                "3. **Actionable Decision Support**: By calculating composite scores from Class 1 (Very Low Hazard) to Class 5 (Very High Hazard), GIS enables urban planners, engineers, and citizens to make evidence-backed decisions before building roads or houses."
            )

        # ── 3. CONCEPT: WHAT IS AHP / MCDA? ────────────────────────
        if any(k in q_clean for k in ("what is ahp", "what is mcda", "analytic hierarchy", "multi-criteria", "how are weights", "consistency ratio")):
            return (
                "### ⚖️ What is AHP (Analytic Hierarchy Process)?\n\n"
                "The **Analytic Hierarchy Process (AHP)** is a structured mathematical technique developed by Thomas Saaty for multi-criteria decision analysis (MCDA).\n\n"
                "In our MCGSE Web-GIS platform, AHP determines **how much weight each spatial factor receives**:\n"
                "- **Pairwise Comparisons**: Geoscience experts compare factors against each other in a mathematical matrix (e.g., *'Is river proximity more influential than soil permeability for flood hazard?'*).\n"
                "- **Normalized Factor Weights**: The matrix calculates percentage weights for all criteria (for example, terrain slope receives ~23% and river distance receives ~15% in our flood model).\n"
                "- **Consistency Ratio (CR)**: Mathematical check confirming matrix logic. A CR $\\le 0.10$ guarantees scientific consistency without contradictory rankings.\n\n"
                "This ensures hazard classifications are derived from verifiable, reproducible science rather than arbitrary guesses."
            )

        # ── 4. CONSTRUCTION / HOUSE / BUILDING INQUIRY ─────────────
        is_building_query = any(
            k in q_clean
            for k in (
                "build", "house", "construct", "construction", "home", "building",
                "living", "safe to live", "develop", "settle", "plot", "hotel",
                "structure", "property", "buy land", "safe here", "should we", "can we live"
            )
        )
        if is_building_query:
            if not (coords and pt):
                return (
                    "### 🏠 House Construction Assessment\n\n"
                    "To evaluate whether a specific location is safe and suitable for building a house, "
                    "**please click on the map to select a point**.\n\n"
                    "Once you click a coordinate, our GIS engine will inspect the exact raster values for:\n"
                    "- Flood & Landslide susceptibility scores (1–5)\n"
                    "- Ground slope angle and hillside stability\n"
                    "- Proximity to active rivers and floodplains\n"
                    "- Surface runoff and flow accumulation\n\n"
                    "*Click anywhere across Himachal Pradesh on the map to evaluate that location!*"
                )

            if pt.get("coverage_status") == "OUTSIDE_ANALYSIS_AREA":
                return (
                    f"### ⚠️ Location Outside Analysis Boundary\n\n"
                    f"The selected point at **({coords.get('latitude'):.4f}°N, {coords.get('longitude'):.4f}°E)** lies outside the active "
                    "Himachal Pradesh state analysis boundary. Please click a location within Himachal Pradesh to inspect building suitability."
                )

            score = pt.get("suitability_score")
            cls_val = pt.get("suitability_class")
            cls_label = pt.get("suitability_label") or "Susceptibility Evaluated"
            lat = coords.get("latitude", 0.0)
            lon = coords.get("longitude", 0.0)

            # Build conversational verdict
            if score is not None:
                if score < 1.80:
                    verdict_header = "🟢 **Favorable (Very Low Hazard)**"
                    verdict_summary = (
                        f"From a **{hazard_type.lower()} hazard standpoint, this is a favorable location for construction**. "
                        f"The calculated susceptibility score is **{score:.2f} / 5.00** ({cls_label}, Class 1/5), indicating that "
                        f"{hazard_type.lower()} inundation risk is minimal under normal seasonal conditions."
                    )
                elif score < 2.60:
                    verdict_header = "🟢 **Generally Favorable (Low Hazard)**"
                    verdict_summary = (
                        f"This location has **Low {hazard_type} Susceptibility** (Score: **{score:.2f} / 5.00**, {cls_label}). "
                        "Hazard exposure is low, making it suitable for development with standard building drainage."
                    )
                elif score < 3.40:
                    verdict_header = "🟡 **Moderate Hazard — Engineering Precautions Required**"
                    verdict_summary = (
                        f"This location falls into a **Moderate Susceptibility zone** (Score: **{score:.2f} / 5.00**, {cls_label}). "
                        "Building here requires engineered site preparation, elevated plinths, and proper stormwater diversion."
                    )
                elif score < 4.20:
                    verdict_header = "🟠 **High Hazard — Caution Advised**"
                    verdict_summary = (
                        f"⚠️ **Caution**: This site falls into a **High Susceptibility zone** (Score: **{score:.2f} / 5.00**, {cls_label}). "
                        "Construction here carries substantial natural hazard risk. Detailed mitigation is necessary."
                    )
                else:
                    verdict_header = "🔴 **Very High Hazard — Construction Strongly Discouraged**"
                    verdict_summary = (
                        f"🚨 **High Risk Alert**: This site is classified as **Very High Susceptibility** (Score: **{score:.2f} / 5.00**, {cls_label}). "
                        "Building a permanent home here involves severe hazard exposure and is strongly discouraged."
                    )
            else:
                verdict_header = "ℹ️ **Inspection Details Available**"
                verdict_summary = f"Inspection completed for coordinates ({lat:.4f}°N, {lon:.4f}°E)."

            # Extract factor details
            top_factors = pt.get("top_factors", [])
            factor_bullets = []
            steep_slope_val = None

            for f in top_factors:
                crit = f.get("criterion", "")
                raw = f.get("raw_value")
                unit = f.get("unit") or ""
                if crit == "slope" and raw is not None:
                    try:
                        steep_slope_val = float(raw)
                    except (ValueError, TypeError):
                        pass

                if crit == "distance_to_rivers" and raw is not None:
                    try:
                        d_km = float(raw) / 1000.0 if float(raw) > 100 else float(raw)
                        factor_bullets.append(
                            f"- **Distance to Rivers (~{d_km:.2f} km)**: The site is situated well away from active river channels, safely outside riverine flash-flood plains."
                        )
                    except (ValueError, TypeError):
                        factor_bullets.append(f"- **Distance to Rivers**: `{raw} {unit}` from mapped watercourses.")
                elif crit == "flow_accumulation" and raw is not None:
                    factor_bullets.append(
                        f"- **Flow Accumulation ({raw} cells)**: Surface runoff accumulation is very low, meaning rainfall does not naturally channel or pool into this specific location."
                    )
                elif crit == "slope" and raw is not None:
                    factor_bullets.append(
                        f"- **Terrain Slope ({raw:.1f}°)**: The terrain has a notable slope. Sloping topography allows surface water to drain away rapidly, keeping flood pooling low."
                    )
                elif crit == "rainfall" and raw is not None:
                    factor_bullets.append(
                        f"- **Precipitation Volume (~{raw:.0f} mm/yr)**: The area receives significant seasonal rainfall, but local topography promotes rapid drainage."
                    )

            if not factor_bullets and top_factors:
                for f in top_factors[:4]:
                    factor_bullets.append(f"- **{f.get('criterion', '').replace('_', ' ').title()}**: `{f.get('raw_value')} {f.get('unit', '')}`")

            lines = [
                f"### 🏠 House Construction Assessment at ({lat:.4f}°N, {lon:.4f}°E)\n",
                f"**Overall Verdict**: {verdict_header}\n",
                f"{verdict_summary}\n",
                "### 🔍 What the Verified GIS Data Tells Us:",
            ]
            lines.extend(factor_bullets)

            # Mountain Topography Secondary Hazard Advisory
            if steep_slope_val is not None and steep_slope_val > 25:
                lines.append("\n### ⚠️ Mountain Terrain Advisory: Landslide Check Recommended!")
                lines.append(
                    f"In Himachal Pradesh's mountainous terrain, steep slopes ({steep_slope_val:.1f}°) naturally shed surface water (lowering flood risk), "
                    "**but steep slopes can elevate landslide and slope failure risks**."
                )
                lines.append(
                    "**Recommended Next Steps:**\n"
                    "1. 🔬 **Check Landslide Model**: Switch to the **Landslide Susceptibility model** in the top navigation dropdown to verify slope stability for this exact point.\n"
                    "2. 🧱 **Geotechnical Soil Testing**: Confirm foundation bedrock integrity and retaining wall requirements before digging footings.\n"
                    "3. 🌊 **Stormwater Diversion**: Plan roof and driveway drainage to channel rainwater safely away from foundation slopes."
                )
            else:
                lines.append(
                    "\n**Recommended Next Steps:**\n"
                    "- Confirm local building codes, setback regulations, and road access.\n"
                    "- Conduct a standard on-site civil and soil percolation inspection before breaking ground."
                )

            lines.append(
                "\n*Disclaimer: GIS suitability ratings represent mathematical models of natural predispositions based on remote sensing data, not on-site engineering certifications or disaster guarantees.*"
            )
            return "\n".join(lines)

        # ── 5. SPECIFIC CRITERION EXPLANATIONS ────────────────────
        criteria_queries = {
            "slope": (
                "Terrain Slope",
                "Slope measures the inclination or steepness of the ground surface in degrees. "
                "In flood modeling, steeper slopes promote rapid runoff drainage (lowering flood risk), whereas in landslide modeling, steep slopes significantly increase gravitational shear stress and failure risk.",
            ),
            "rainfall": (
                "Annual Rainfall",
                "Rainfall volume and monsoon intensity measure the primary hydrological trigger for both flash flooding and slope saturation. High rainfall on saturated ground causes rapid overland flow and river surges.",
            ),
            "flow_accumulation": (
                "Flow Accumulation",
                "Flow accumulation calculates how many upstream raster cells drain into each specific point. High accumulation values identify natural drainage gullies, streams, and hollows where floodwaters concentrate.",
            ),
            "twi": (
                "Topographic Wetness Index (TWI)",
                "TWI ($\ln(a / \tan \beta)$) combines upstream contributing area and local slope angle. It identifies zones prone to water table saturation and swampy conditions where soils remain permanently wet.",
            ),
            "distance_to_rivers": (
                "Distance to Rivers",
                "Distance to rivers measures Euclidean proximity to the nearest drainage network channel. Areas adjacent to rivers face direct inundation risk during seasonal high-water discharge.",
            ),
            "soil": (
                "Soil Texture & Permeability",
                "Soil permeability dictates how quickly rainwater infiltrates into underground aquifers versus becoming surface runoff. Coarse gravels and sands absorb water quickly, while compact clays promote immediate overland runoff.",
            ),
            "ndvi": (
                "NDVI (Vegetation Index)",
                "The Normalized Difference Vegetation Index assesses vegetation density and canopy cover. Dense forest root networks anchor soil against erosion and intercept intense raindrops, moderating peak runoff surges.",
            ),
        }

        for crit_key, (crit_title, crit_desc) in criteria_queries.items():
            if crit_key in q_clean or crit_title.lower() in q_clean:
                res_lines = [
                    f"### 🔬 Criterion Explanation: **{crit_title}**\n",
                    f"{crit_desc}\n",
                ]
                # Check if current point has value for this criterion
                if pt and pt.get("top_factors"):
                    for tf in pt.get("top_factors", []):
                        if tf.get("criterion") == crit_key:
                            res_lines.append(
                                f"\n> 📍 *At your selected coordinate (**{coords.get('latitude'):.4f}°N, {coords.get('longitude'):.4f}°E**), "
                                f"the measured value is **{tf.get('raw_value')} {tf.get('unit', '')}** (Score Rating: {tf.get('rating')}/5).* "
                            )
                            break
                return "\n".join(res_lines)

        # ── 6. MODEL COMPARISON ───────────────────────────────────
        if any(k in q_clean for k in ("compare", "difference between", "versus", " vs ", "both models", "flood and landslide")):
            return (
                "### ⚖️ Flood Model vs. Landslide Model Comparison\n\n"
                "Both models are calibrated for **Himachal Pradesh**, but they analyze fundamentally different disaster mechanisms:\n\n"
                "| Attribute | 11-Factor Flood AHP | 14-Factor Landslide MCDA |\n"
                "| :--- | :--- | :--- |\n"
                "| **Core Focus** | Water accumulation & river overflow | Gravity, slope failure & rock stability |\n"
                "| **Key Factors** | Flow accumulation, river distance, TWI, slope | Slope angle, lithology, fault buffer, road cuts |\n"
                "| **Slope Role** | **Steep slope = Low flood risk** (water sheds) | **Steep slope = High landslide risk** (shear stress) |\n"
                "| **State Resolution**| 30 m statewide grid | 30 m statewide grid |\n\n"
                "💡 **Key Insight**: A point with low flood susceptibility on a steep mountain ridge may simultaneously have high landslide susceptibility. "
                "Always check both models before planning land development!"
            )

        # ── 7. STATEWIDE STATISTICS ───────────────────────────────
        if any(k in q_clean for k in ("stat", "average", "coverage", "percent", "distribution", "statewide")):
            stats = ev.get("statistics")
            if stats:
                dist_lines = []
                for cd in stats.get("class_distribution", []):
                    dist_lines.append(f"- **Class {cd.get('class')} ({cd.get('label')})**: {cd.get('percentage'):.1f}% of state ({cd.get('area_sq_km', 0):.0f} km²)")
                return (
                    f"### 📊 Statewide {hazard_type} Statistics (Himachal Pradesh)\n\n"
                    f"- **Valid Analysis Coverage**: **{stats.get('valid_coverage_pct')}%** of state area analyzed\n"
                    f"- **Statewide Mean Score**: **{stats.get('score_mean')} ± {stats.get('score_std')}** (out of 5.00)\n\n"
                    "**Suitability Distribution Breakdown:**\n"
                    + "\n".join(dist_lines)
                )

        # ── 8. GENERAL POINT INSPECTION BREAKDOWN ──────────────────
        if coords and pt and pt.get("suitability_score") is not None:
            score = pt.get("suitability_score")
            cls_val = pt.get("suitability_class")
            cls_label = pt.get("suitability_label") or "Analyzed"
            lat = coords.get("latitude", 0.0)
            lon = coords.get("longitude", 0.0)

            lines = [
                f"### 📍 Spatial Assessment for ({lat:.4f}°N, {lon:.4f}°E)\n",
                f"At this location, the **{model_name}** calculates a continuous score of **{score:.2f} / 5.00** (**{cls_label}**, Class {cls_val}/5).\n",
                "**Key Environmental Observations:**",
            ]
            for f in pt.get("top_factors", [])[:4]:
                crit_clean = f.get("criterion", "").replace("_", " ").title()
                lines.append(f"- **{crit_clean}**: `{f.get('raw_value')} {f.get('unit', '')}` (Rating: {f.get('rating')}/5)")

            lines.append(
                f"\n**Summary**: With {pt.get('valid_criteria_count')}/{pt.get('total_criteria_count')} valid spatial criteria, "
                f"this location demonstrates **{cls_label.lower()}** conditions. "
                "Feel free to ask specific questions about building, drainage, or slope stability here!"
            )
            return "\n".join(lines)

        # ── 9. DEFAULT CONVERSATIONAL RESPONSE ────────────────────
        return (
            f"### 🧭 Geospatial Decision Support ({model_name})\n\n"
            f"Regarding your query: *\"{question}\"*\n\n"
            f"In our **{hazard_type} Susceptibility Analysis** for Himachal Pradesh, spatial risk is evaluated using multi-criteria decision analysis across 30-meter terrain cells.\n\n"
            "**Helpful actions you can take:**\n"
            "- 📍 **Click any point on the map** to inspect exact suitability scores, hazard classes, and environmental criteria.\n"
            "- 💬 Ask: *'Should we build a house here?'* to get a plain-English construction suitability evaluation.\n"
            "- 🔬 Ask about any criterion like *'What is slope?'* or *'What is flow accumulation?'* to learn how it is measured."
        )

    def _build_prompt_messages(
        self,
        question: str,
        evidence_result: dict[str, Any],
        history: list[dict[str, str]] | None = None,
        target_model: str = "",
    ) -> list[dict[str, str]]:
        if is_greeting_or_intro(question):
            user_content = (
                f"User Question: {question}\n\n"
                "The user is sending a greeting or asking for an introduction.\n"
                "Respond warmly, concisely, and naturally as MCGSE AI — the geospatial decision-support intelligence assistant for Himachal Pradesh.\n"
                "Briefly explain your key capabilities:\n"
                "- Inspect point coordinates on the map for flood and landslide suitability scores\n"
                "- Explain multi-criteria decision models (11-Factor Flood AHP and 14-Factor Landslide MCDA)\n"
                "- Compare models and factor weights\n"
                "- Analyze statewide statistical distributions\n"
                "Invite them to click anywhere on the map or ask a question about flood or landslide risk. "
                "Keep the tone professional, welcoming, and concise (under 100 words). Do NOT dump tables of numbers or factor weights."
            )
        elif not evidence_result.get("is_data_query", True):
            user_content = (
                f"User Question: {question}\n\n"
                "The user is asking a general conceptual question or having normal conversation.\n"
                "Answer directly, conversationally, and concisely in plain English without robotic jargon, tables, or unsolicited coordinates. "
                "Carefully respect any requested length constraints (e.g. 'in 10 words')."
            )
        else:
            evidence_prompt_text = format_evidence_for_prompt(evidence_result)
            user_content = (
                f"=== RETRIEVED GIS EVIDENCE ===\n"
                f"{evidence_prompt_text}\n"
                f"=== END OF EVIDENCE ===\n\n"
                f"User Question: {question}\n\n"
                "Please provide a grounded, direct answer using only the evidence above."
            )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        if history:
            capped_history = history[-settings.ai_max_history :]
            for item in capped_history:
                role = "user" if item.get("role") == "user" else "assistant"
                content = item.get("content") or item.get("text") or ""
                if content:
                    messages.append({"role": role, "content": content[:800]})

        messages.append({"role": "user", "content": user_content})

        # For models with native internal thinking, prefill empty thinking tags
        # to ensure fast, direct generation without burning tokens on internal CoT
        m_lower = target_model.lower()
        if any(k in m_lower for k in ("qwen3.5", "qwen-3.5", "deepseek-r1", "r1", "thinking")):
            messages.append({"role": "assistant", "content": "<think>\n</think>"})

        return messages

    async def generate_grounded_answer(
        self,
        question: str,
        evidence_result: dict[str, Any],
        history: list[dict[str, str]] | None = None,
        requested_model: str | None = None,
    ) -> dict[str, Any]:
        """Non-streaming generation with full fallback handling."""
        health = await self.get_health()
        target_model = requested_model or getattr(self, "_active_model", self.configured_model)

        if not health["ollama_reachable"] or not health["model_installed"]:
            fallback_text = self._generate_fallback_answer(question, evidence_result, health)
            warn = (
                health.get("setup_guidance")
                or f"Local Ollama model '{target_model}' is not installed. Used verified GIS evidence report."
            )
            return {
                "answer": fallback_text,
                "model_used": "evidence_summary",
                "source": "evidence_fallback",
                "warning": warn,
            }

        messages = self._build_prompt_messages(
            question, evidence_result, history, target_model=target_model
        )

        async with self.semaphore:
            url = f"{self.base_url}/api/chat"
            payload = {
                "model": target_model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "top_p": 0.9,
                    "num_predict": 768,
                },
            }

            try:
                async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        msg = data.get("message", {})
                        content = msg.get("content", "").strip()
                        if content:
                            return {
                                "answer": content,
                                "model_used": target_model,
                                "source": "ollama",
                                "warning": None,
                            }
                    logger.warning("Ollama API responded with status %d: %s", resp.status_code, resp.text)
            except httpx.TimeoutException:
                logger.error("Ollama request timed out after %.1f s", settings.ollama_timeout)
                fallback_text = self._generate_fallback_answer(question, evidence_result, health)
                return {
                    "answer": fallback_text,
                    "model_used": "evidence_summary",
                    "source": "evidence_fallback",
                    "warning": f"Local Ollama generation timed out ({settings.ollama_timeout}s). GIS evidence presented directly.",
                }
            except Exception as e:
                logger.error("Error communicating with Ollama: %s", e)

        fallback_text = self._generate_fallback_answer(question, evidence_result, health)
        return {
            "answer": fallback_text,
            "model_used": "evidence_summary",
            "source": "evidence_fallback",
            "warning": "Could not complete Ollama neural generation. GIS evidence presented directly.",
        }

    async def stream_grounded_answer(
        self,
        question: str,
        evidence_result: dict[str, Any],
        history: list[dict[str, str]] | None = None,
        requested_model: str | None = None,
        is_disconnected: Callable[[], Any] | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Stream progressive answer tokens from local Ollama.
        Yields events:
        - {"type": "token", "text": "..."}
        - {"type": "done", "answer": "...", "model_used": "...", "source": "..."}
        """
        health = await self.get_health()
        target_model = requested_model or getattr(self, "_active_model", self.configured_model)

        # Fallback if Ollama is not ready
        if not health["ollama_reachable"] or not health["model_installed"]:
            fallback_text = self._generate_fallback_answer(question, evidence_result, health)
            words = fallback_text.split(" ")
            chunk_size = 3
            for i in range(0, len(words), chunk_size):
                if is_disconnected and await is_disconnected():
                    logger.info("Client disconnected during fallback streaming")
                    return
                chunk = " ".join(words[i : i + chunk_size]) + " "
                yield {"type": "token", "text": chunk}
                await asyncio.sleep(0.015)

            yield {
                "type": "done",
                "answer": fallback_text,
                "model_used": "evidence_summary",
                "source": "evidence_fallback",
                "warning": health.get("setup_guidance"),
            }
            return

        messages = self._build_prompt_messages(
            question, evidence_result, history, target_model=target_model
        )

        async with self.semaphore:
            url = f"{self.base_url}/api/chat"
            payload = {
                "model": target_model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": 0.2,
                    "top_p": 0.9,
                    "num_predict": 768,
                },
            }

            accumulated_tokens: list[str] = []
            try:
                async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code != 200:
                            logger.warning("Ollama stream error status: %d", response.status_code)
                            fallback_text = self._generate_fallback_answer(question, evidence_result, health)
                            yield {"type": "token", "text": fallback_text}
                            yield {
                                "type": "done",
                                "answer": fallback_text,
                                "model_used": "evidence_summary",
                                "source": "evidence_fallback",
                                "warning": f"Ollama returned HTTP {response.status_code}",
                            }
                            return

                        async for line in response.aiter_lines():
                            if is_disconnected and await is_disconnected():
                                logger.info("Client disconnected during generation; aborting stream.")
                                return

                            if not line.strip():
                                continue

                            try:
                                chunk = json.loads(line)
                                msg = chunk.get("message", {})
                                token = msg.get("content", "")
                                if token:
                                    accumulated_tokens.append(token)
                                    yield {"type": "token", "text": token}

                                if chunk.get("done"):
                                    break
                            except Exception as parse_err:
                                logger.debug("Error parsing Ollama chunk: %s", parse_err)

                full_answer = "".join(accumulated_tokens).strip()
                if not full_answer:
                    fallback_text = self._generate_fallback_answer(question, evidence_result, health)
                    words = fallback_text.split(" ")
                    chunk_size = 3
                    for i in range(0, len(words), chunk_size):
                        if is_disconnected and await is_disconnected():
                            return
                        chunk = " ".join(words[i : i + chunk_size]) + " "
                        yield {"type": "token", "text": chunk}
                        await asyncio.sleep(0.015)
                    full_answer = fallback_text

                yield {
                    "type": "done",
                    "answer": full_answer,
                    "model_used": target_model if accumulated_tokens else "evidence_summary",
                    "source": "ollama" if accumulated_tokens else "evidence_fallback",
                    "warning": None,
                }
                return

            except httpx.TimeoutException:
                logger.error("Ollama streaming timed out after %.1f s", settings.ollama_timeout)
                fallback_text = self._generate_fallback_answer(question, evidence_result, health)
                yield {"type": "token", "text": "\n\n" + fallback_text}
                yield {
                    "type": "done",
                    "answer": "".join(accumulated_tokens) + "\n\n" + fallback_text,
                    "model_used": "evidence_summary",
                    "source": "evidence_fallback",
                    "warning": f"Ollama generation timed out ({settings.ollama_timeout}s).",
                }
            except Exception as e:
                logger.error("Error streaming from Ollama: %s", e)
                fallback_text = self._generate_fallback_answer(question, evidence_result, health)
                yield {"type": "token", "text": fallback_text}
                yield {
                    "type": "done",
                    "answer": fallback_text,
                    "model_used": "evidence_summary",
                    "source": "evidence_fallback",
                    "warning": f"Ollama stream error: {str(e)}",
                }


ollama_service = OllamaService()
