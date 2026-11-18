"""
Script to generate the comprehensive MCGSE Functional Documentation Word Document (.docx).
Uses python-docx with professional styling, executive formatting, structured tables,
and safe diagram boxes that never cut off or overlap.
"""

import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_functional_document(filename: str):
    doc = Document()

    # Page Margins: 1 inch on all sides
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Palette
    NAVY = RGBColor(30, 58, 138)       # #1E3A8A - Heading 1
    SLATE = RGBColor(37, 99, 235)      # #2563EB - Heading 2
    TEAL = RGBColor(13, 148, 136)      # #0D9488 - Heading 3
    DARK_TEXT = RGBColor(31, 41, 55)   # #1F2937 - Body
    MUTED_GRAY = RGBColor(100, 116, 139) # #64748B

    # Helper: Set cell background color
    def set_cell_shading(cell, color_hex):
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shading)

    # Helper: Set cell margins (padding)
    def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(
            f'<w:tcMar {nsdecls("w")}>'
            f'<w:top w:w="{top}" w:type="dxa"/>'
            f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
            f'<w:left w:w="{left}" w:type="dxa"/>'
            f'<w:right w:w="{right}" w:type="dxa"/>'
            f'</w:tcMar>'
        )
        tcPr.append(tcMar)

    # Helper: Callout Box
    def add_callout(text, title="NOTE", callout_type="info"):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.5)
        
        bg_color = "EFF6FF" if callout_type == "info" else ("F0FDF4" if callout_type == "tip" else "FEF2F2")
        border_color = "3B82F6" if callout_type == "info" else ("10B981" if callout_type == "tip" else "EF4444")
        set_cell_shading(cell, bg_color)
        set_cell_margins(cell, top=140, bottom=140, left=200, right=180)

        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="none"/>'
            f'<w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>'
            f'<w:bottom w:val="none"/>'
            f'<w:right w:val="none"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(borders)

        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        r_title = p.add_run(f"[{title}] ")
        r_title.bold = True
        r_title.font.name = "Calibri"
        r_title.font.size = Pt(10)
        r_title.font.color.rgb = RGBColor(30, 58, 138) if callout_type == "info" else (RGBColor(16, 185, 129) if callout_type == "tip" else RGBColor(239, 68, 68))
        
        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(9.5)
        r_text.font.color.rgb = DARK_TEXT

        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_before = Pt(0)
        p_spacer.paragraph_format.space_after = Pt(4)

    # Helper: Diagram Box (Guaranteed no overlap, no cut-off)
    def add_diagram_box(title, ascii_diagram):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.5)
        set_cell_shading(cell, "F8FAFC")
        set_cell_margins(cell, top=140, bottom=140, left=180, right=180)

        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="12" w:space="0" w:color="CBD5E1"/>'
            f'<w:left w:val="single" w:sz="24" w:space="0" w:color="0284C7"/>'
            f'<w:bottom w:val="single" w:sz="12" w:space="0" w:color="CBD5E1"/>'
            f'<w:right w:val="single" w:sz="12" w:space="0" w:color="CBD5E1"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(borders)

        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        r_title = p.add_run(f"Figure: {title}\n")
        r_title.bold = True
        r_title.font.name = "Calibri"
        r_title.font.size = Pt(9.5)
        r_title.font.color.rgb = RGBColor(14, 116, 144)

        r_diag = p.add_run(ascii_diagram)
        r_diag.font.name = "Consolas"
        r_diag.font.size = Pt(8.5)
        r_diag.font.color.rgb = RGBColor(30, 41, 59)

        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_before = Pt(0)
        p_spacer.paragraph_format.space_after = Pt(4)

    # Helper: Format styled table
    def add_styled_table(headers, data, col_widths=None):
        tbl = doc.add_table(rows=len(data) + 1, cols=len(headers))
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER

        # Header Row
        hdr_cells = tbl.rows[0].cells
        for i, header_text in enumerate(headers):
            cell = hdr_cells[i]
            if col_widths and i < len(col_widths):
                cell.width = col_widths[i]
            set_cell_shading(cell, "1E293B")
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(header_text)
            r.bold = True
            r.font.name = "Calibri"
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(255, 255, 255)

        # Data Rows
        for r_idx, row_data in enumerate(data):
            row_cells = tbl.rows[r_idx + 1].cells
            row_bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
            for c_idx, cell_value in enumerate(row_data):
                cell = row_cells[c_idx]
                if col_widths and c_idx < len(col_widths):
                    cell.width = col_widths[c_idx]
                set_cell_shading(cell, row_bg)
                set_cell_margins(cell, top=80, bottom=80, left=140, right=140)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                r = p.add_run(str(cell_value))
                r.font.name = "Calibri"
                r.font.size = Pt(9)
                r.font.color.rgb = DARK_TEXT

        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_before = Pt(0)
        p_spacer.paragraph_format.space_after = Pt(6)

    # Helper: Section Heading
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(16)
        r.font.color.rgb = NAVY

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(13)
        r.font.color.rgb = SLATE

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(11)
        r.font.color.rgb = TEAL

    def add_p(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = DARK_TEXT
        return p

    def add_bullet(bold_prefix, text):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        r_bold = p.add_run(bold_prefix)
        r_bold.bold = True
        r_bold.font.name = "Calibri"
        r_bold.font.size = Pt(10)
        r_bold.font.color.rgb = DARK_TEXT

        r_text = p.add_run(text)
        r_text.font.name = "Calibri"
        r_text.font.size = Pt(10)
        r_text.font.color.rgb = DARK_TEXT

    # ─────────────────────────────────────────────────────────────
    # COVER / HEADER
    # ─────────────────────────────────────────────────────────────
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(24)
    p_title.paragraph_format.space_after = Pt(4)
    r = p_title.add_run("MCGSE Web-GIS Platform")
    r.bold = True
    r.font.name = "Calibri"
    r.font.size = Pt(26)
    r.font.color.rgb = NAVY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    r = p_sub.add_run("Multi-Criteria Geospatial Susceptibility Evaluation — Functional Documentation")
    r.italic = True
    r.font.name = "Calibri"
    r.font.size = Pt(14)
    r.font.color.rgb = SLATE

    # Document Metadata Box
    add_styled_table(
        ["Document Attribute", "Specification Details"],
        [
            ["Target Platform", "Multi-Criteria Geospatial Susceptibility Evaluation (MCGSE) Web-GIS"],
            ["Primary Geographic Domain", "Himachal Pradesh, Western Himalayas (Extensible Nationally)"],
            ["Supported Multi-Criteria Models", "11-Factor Flood AHP Model (v1.0) & 14-Factor Landslide MCDA Model (v1.0)"],
            ["Document Classification", "Comprehensive Functional Specification & User Operation Manual"],
            ["Release Version", "Version 2.0.0 (AWS Cloud-Ready & Production Hardened)"],
            ["Target Audience", "GIS Specialists, Urban Planners, Civil Authorities, SDMA, and Developers"],
        ],
        [Inches(2.2), Inches(4.3)]
    )

    # ─────────────────────────────────────────────────────────────
    # 1. EXECUTIVE SUMMARY & PLATFORM MISSION
    # ─────────────────────────────────────────────────────────────
    add_h1("1. Executive Summary & Platform Mission")
    add_p(
        "The Multi-Criteria Geospatial Susceptibility Evaluation (MCGSE) Web-GIS Application is a modern, cloud-native, "
        "decision-support platform engineered to quantify, visualize, and explain natural hazard susceptibility across "
        "mountainous terrains. Developed initially for Himachal Pradesh—a fragile Western Himalayan state subject to intense "
        "monsoonal precipitation, cloudbursts, and tectonic active shear zones—the platform consolidates complex multi-source remote "
        "sensing datasets into scientifically validated, 30-meter continuous and categorical hazard susceptibility indices."
    )
    add_p(
        "Unlike conventional static GIS portals that merely render read-only maps, MCGSE provides an active analytical workbench. "
        "Every coordinate on the map is instantly inspectable, breaking down composite hazard scores into raw physical measurements, "
        "rating conversions, and normalized factor contributions based on Thomas Saaty's Analytic Hierarchy Process (AHP). "
        "Furthermore, the platform integrates an evidence-grounded Artificial Intelligence assistant that translates complex "
        "spatial science into actionable, plain-English advice for land administrators, emergency services, and citizens."
    )

    add_callout(
        "MCGSE is designed for zero-trust geospatial intelligence: every answer provided by the AI assistant is strictly "
        "bound to genuine raster measurements sampled at the clicked location. Hallucinations of hazard scores, coordinates, "
        "or safety classifications are mathematically prevented by backend evidence gating.",
        title="CORE PHILOSOPHY",
        callout_type="info"
    )

    # ─────────────────────────────────────────────────────────────
    # 2. KEY STAKEHOLDERS & FUNCTIONAL USE CASES
    # ─────────────────────────────────────────────────────────────
    add_h1("2. Key Stakeholders & Functional Use Cases")
    add_p(
        "The application satisfies the specialized requirements of diverse user groups through targeted workflows:"
    )

    add_bullet(
        "1. Urban Planners & Municipal Town Country Planning (TCP): ",
        "Evaluate site development feasibility before approving commercial or residential construction permits. "
        "Inspect slope stability, proximity to active river corridors, and flow accumulation pathways to prevent building in active floodways or landslide chutes."
    )
    add_bullet(
        "2. State Disaster Management Authorities (HP-SDMA & DDMA): ",
        "Conduct pre-monsoon vulnerability assessments across all 12 districts (Shimla, Mandi, Kullu, Kangra, Solan, etc.). "
        "Identify high-risk road corridors, bridges, and settlements requiring engineering mitigation or early evacuation planning."
    )
    add_bullet(
        "3. Infrastructure & Civil Engineers (NHAI, PWD, BRO): ",
        "Assess slope steepness, structural geology (fault line buffers), and lithological rock competence when designing highway widening, "
        "tunnel portals, retaining walls, or drainage culverts."
    )
    add_bullet(
        "4. Citizens, Land Buyers, and Home Builders: ",
        "Ask plain-English questions such as 'Should we build a house here?' to receive a comprehensive, dual-hazard evaluation "
        "explaining local drainage, slope risks, and recommended engineering precautions."
    )
    add_bullet(
        "5. Scientific Researchers & Environmental Assessors: ",
        "Inspect mathematical consistency ratios (CR <= 0.10), review pairwise factor weightings, and export GeoTIFFs or CSV "
        "tabular data for academic peer review and environmental impact statements (EIA)."
    )

    # ─────────────────────────────────────────────────────────────
    # 3. INTERACTIVE WEB-GIS MAP VIEWER
    # ─────────────────────────────────────────────────────────────
    add_h1("3. Interactive Web-GIS Map Viewer & GIS Controls")
    add_p(
        "The core user interface centers around an interactive Leaflet-powered GIS map canvas paired with ergonomic "
        "cartographic and layer inspection controls."
    )

    add_diagram_box(
        "Functional Layout of the MCGSE Web-GIS Interface",
        "+---------------------------------------------------------------------------------------------------+\n"
        "|  [LOGO] MCGSE Web-GIS   |  [Model Dropdown: Flood / Landslide]  |  [Search: Lat,Lon / City]       |\n"
        "|  Actions: [Compare Hazards]  [Analytics]  [MCGSE AI]  [Export]  [Theme Sun/Moon]  [Status: Live]   |\n"
        "+---------------------------------------------------------------------------------------------------+\n"
        "|  MAP LAYERS DRAWER       |  INTERACTIVE MAP CANVAS (Leaflet 30m Grid)   |  ANALYTICS / AI DRAWER   |\n"
        "|  ---------------------   |  -----------------------------------------   |  ----------------------  |\n"
        "|  (o) Classified Result   |  * Slippy Map Tiles (XYZ dynamic server)     |  * Statewide Stats Area  |\n"
        "|  ( ) Continuous Score    |  * Click to Inspect Point                    |  * Class Distribution    |\n"
        "|  -- Criteria Factors --  |  * Floating Result Chip (Score & Class)      |  * MCGSE AI Chat History |\n"
        "|  ( ) Terrain Slope       |  * Lat/Lon Reticle Indicator                 |  * Real GIS Evidence     |\n"
        "|  ( ) Annual Rainfall     |  * Dark / Light Basemap Tiles                |  * Plain-English Advice  |\n"
        "|  ( ) Distance to River   |  * Opacity Slider (0% - 100%)                |  * Contributing Factors  |\n"
        "|  [Clear Rasters]         |  * Map Legend (Class 1-5 Color Ramp)         |  * GeoTIFF/CSV Exports   |\n"
        "+---------------------------------------------------------------------------------------------------+"
    )

    add_h2("3.1 Dual-Theme Modern Cartography")
    add_p(
        "Users can toggle between two high-contrast cartographic display modes optimized for data visualization:\n"
        "• Dark Mode (Default): Uses dark muted basemap tiles (CartoDB Dark Matter) allowing bright categorical raster colors "
        "(greens, yellows, oranges, reds) to stand out with optimal contrast for prolonged analytical sessions.\n"
        "• Light Mode: Uses clean topographic and street cartography (CartoDB Positron / OSM) ideal for field printing, daytime "
        "operations, and administrative reporting."
    )

    add_h2("3.2 Single-Active Raster Radio Principle")
    add_p(
        "Unlike multi-layer GIS portals that stack opaque rasters on top of one another and confuse visual interpretation, "
        "MCGSE enforces a strict radio-button selection model for all analysis layers. At any given moment, exactly one thematic "
        "raster is rendered on the map. This guarantees that visual pixel colors directly match the active layer's physical units "
        "or classification standard without muddy overlay blending."
    )

    add_h2("3.3 Hierarchical Layer Taxonomy")
    add_p("The Map Layers panel categorizes published geospatial data into four distinct functional tiers:")

    add_styled_table(
        ["Layer Tier", "Layer Type", "Description & Physical Metric", "Visual Representation"],
        [
            ["Results", "Classified Map", "5 discrete susceptibility classes: Very Low, Low, Moderate, High, Very High", "Categorical color ramp (Green -> Yellow -> Red)"],
            ["Results", "Continuous Score", "Floating-point normalized susceptibility index from 1.000 to 5.000", "Continuous smooth gradient heat map"],
            ["Criteria Factors", "Raw Factor", "Unclassified physical metric (Slope in degrees, Rainfall in mm/yr, Distance in meters)", "Monochromatic intensity raster with units"],
            ["Criteria Ratings", "Standardized Rating", "1 to 5 utility scale rating evaluating risk contribution per factor", "5-step standardized thematic ramp"],
            ["Quality & Masks", "Bitmask Raster", "Valid analysis boundary mask excluding snowfields, deep glaciers, or non-state areas", "Binary transparent/masked overlay"],
        ],
        [Inches(1.2), Inches(1.2), Inches(2.6), Inches(1.5)]
    )

    # ─────────────────────────────────────────────────────────────
    # 4. POINT INSPECTION & SITE SUITABILITY ENGINE
    # ─────────────────────────────────────────────────────────────
    add_h1("4. Point Inspection & Site Suitability Engine")
    add_p(
        "Clicking anywhere on the map or entering geographic coordinates triggers the real-time Point Inspection Engine. "
        "The system samples the underlying multi-band raster data stack and produces an exhaustive site assessment in under 50 milliseconds."
    )

    add_h2("4.1 Coordinate Search & Smart Coordinate Auto-Correction")
    add_p(
        "The search bar accommodates diverse input methods with integrated error tolerance:\n"
        "• Named Place Search: Instant fly-to navigation for Himachal Pradesh district headquarters and major towns (Shimla, Mandi, Dharamshala, Kullu, Manali, Solan, Chamba, Bilaspur, Hamirpur, Una, Reckong Peo, Keylong).\n"
        "• Flexible Coordinate Input: Accepts formats such as '31.1048, 77.1734', '31.1048 77.1734', or '31°06'N, 77°10'E'.\n"
        "• Inverted Lat/Lon Auto-Correction: If a user pastes coordinates in Longitude, Latitude order (e.g. 77.1734, 31.1048), the algorithm automatically detects that longitude exceeds 65° and transposes them to standard (Latitude, Longitude) coordinates for India."
    )

    add_h2("4.2 Floating Inspection Chip & Deep Inspection Modal")
    add_p(
        "Upon point selection, a floating chip appears directly above the coordinate showing immediate summary metrics:\n"
        "• Calculated Susceptibility Score (e.g., 2.34 / 5.00)\n"
        "• Classification Label (e.g., 'Class 2: Low Susceptibility')\n"
        "• Quick action button to expand the full Point Inspection Modal."
    )
    add_p(
        "The expanded modal delivers complete mathematical transparency:\n"
        "1. Composite Suitability Score & Class: Displayed prominently with high-visibility color coding.\n"
        "2. Top Contributing Factors: Ranked list of physical criteria driving the score at that coordinate, including raw measured values, 1–5 rating conversions, and mathematical contribution percentages.\n"
        "3. Limiting Criteria: Identifies specific mitigating factors that prevented the score from escalating into higher danger tiers (e.g., steep 32° slope shedding surface runoff rapidly, keeping flood risk low).\n"
        "4. Available Evidence Status: Discloses whether all criteria were valid or if renormalization was applied due to boundary conditions.\n"
        "5. Out-of-Bounds Protection: If a user clicks outside the Himachal Pradesh boundary, the system displays an advisory informing them that the point lies outside the active state boundary."
    )

    # ─────────────────────────────────────────────────────────────
    # 5. MULTI-HAZARD MODEL ARCHITECTURE & COMPARISON
    # ─────────────────────────────────────────────────────────────
    add_h1("5. Multi-Hazard Model Architecture & Comparison")
    add_p(
        "MCGSE incorporates two distinct spatial multi-criteria models developed for Western Himalayan disaster management:"
    )

    add_h2("5.1 11-Factor Flood Susceptibility Model (AHP)")
    add_p(
        "Focuses on hydrological accumulation, river proximity, and topography that allows floodwaters to pool and inundate "
        "valleys and low-lying settlements."
    )
    add_styled_table(
        ["Criterion Name", "Factor Weight (%)", "Physical Metric & Units", "Hydrological Role in Flood Susceptibility"],
        [
            ["Terrain Slope", "23.4%", "Ground inclination in degrees (°)", "Gentle slopes (< 5°) pool floodwaters; steep slopes shed runoff rapidly."],
            ["Distance to Rivers", "15.8%", "Euclidean distance to mapped stream (m)", "Proximity to active riverbeds directly dictates riverine flood exposure."],
            ["Flow Accumulation", "13.2%", "Upstream catchment cells draining to pixel", "High flow accumulation marks natural watercourse channels and gullies."],
            ["Annual Rainfall", "11.5%", "TRMM / IMD precipitation in mm/year", "Higher rainfall volume provides greater overland flow volume."],
            ["Topographic Wetness (TWI)", "9.4%", "ln(a / tan beta) index", "Identifies zones prone to soil water saturation and swampy conditions."],
            ["Elevation (DEM)", "7.8%", "Altitude above sea level (meters)", "Valley floors (< 1200 m) suffer highest backwater and inundation risk."],
            ["Soil Permeability", "6.2%", "Soil texture and hydraulic conductivity", "Impermeable clays accelerate runoff; gravels absorb moisture."],
            ["Land Use / Land Cover", "4.9%", "LULC categorical classification", "Built-up concrete increases runoff; dense forests intercept rain."],
            ["NDVI (Vegetation Index)", "3.8%", "Normalized Difference Vegetation Index", "Canopy cover slows raindrop impact and promotes infiltration."],
            ["Plan Curvature", "2.3%", "Surface shape horizontal to slope", "Concave profiles converge flow; convex profiles disperse flow."],
            ["Profile Curvature", "1.7%", "Surface shape parallel to slope", "Accelerates or decelerates water velocity as it moves downslope."],
        ],
        [Inches(1.8), Inches(1.1), Inches(1.8), Inches(1.8)]
    )

    add_h2("5.2 14-Factor Landslide Susceptibility Model (MCDA)")
    add_p(
        "Focuses on gravitational shear stress, geotechnical rock competence, tectonic fracturing, and anthropogenic slope cuts."
    )
    add_styled_table(
        ["Criterion Name", "Factor Weight (%)", "Physical Metric & Units", "Geotechnical Role in Landslide Failure"],
        [
            ["Slope Angle", "21.5%", "Terrain slope in degrees (°)", "Steep slopes (30°–50°) produce intense shear stress and rockfall."],
            ["Lithology (Rock Type)", "16.2%", "Geological rock formation competence", "Weak weathered shales and phyllites fail rapidly; granites resist."],
            ["Distance to Faults", "11.8%", "Euclidean distance to active thrust/fault", "Fault shear zones contain fractured rock prone to catastrophic slides."],
            ["Annual Rainfall", "10.4%", "Monsoon precipitation volume (mm/yr)", "Water infiltration increases pore water pressure, triggering slope slip."],
            ["Distance to Roads", "9.1%", "Proximity to cut road slopes (m)", "Unengineered highway excavation undermines hillside toe support."],
            ["Distance to Streams", "7.3%", "Proximity to active river channels (m)", "River erosion undercuts slope bases during high monsoonal flow."],
            ["Aspect (Slope Direction)", "5.6%", "Compass orientation (0° - 360°)", "South-facing slopes experience higher solar weathering and freeze-thaw."],
            ["Land Use / Land Cover", "4.8%", "LULC categorical classification", "Barren hillsides and degraded scrub lack root cohesion."],
            ["Elevation", "4.1%", "Meters above sea level (m)", "High elevations face periglacial weathering and lack forest protection."],
            ["NDVI (Vegetation)", "3.2%", "Normalized Difference Vegetation Index", "Deep tree root networks mechanically anchor soil mantles."],
            ["Soil Depth & Texture", "2.5%", "Soil horizon thickness and texture", "Thick saturated soil mantles easily liquify into mudflows."],
            ["Topographic Wetness (TWI)", "1.7%", "Topographic wetness index", "High TWI areas accumulate subsurface moisture weakening shear strength."],
            ["Plan Curvature", "1.0%", "Surface curvature horizontal to slope", "Concave hollows concentrate groundwater and initiate debris flows."],
            ["Profile Curvature", "0.8%", "Surface curvature vertical to slope", "Convex breaks in slope represent tension crack development zones."],
        ],
        [Inches(1.8), Inches(1.1), Inches(1.8), Inches(1.8)]
    )

    add_h2("5.3 Multi-Hazard Contrast & Compare Mode")
    add_p(
        "The Compare Mode enables users to view the contrasting roles of topography simultaneously. "
        "For example, a steep 35° mountain ridge above the Beas River in Mandi will show Very Low Flood Susceptibility "
        "(Class 1) because floodwaters drain away immediately, but simultaneously show High or Very High Landslide Susceptibility "
        "(Class 4 or 5) due to gravity-driven rock shear stress. This cross-hazard awareness prevents dangerous planning oversights."
    )

    # ─────────────────────────────────────────────────────────────
    # 6. EVIDENCE-GROUNDED AI ASSISTANT (MCGSE AI)
    # ─────────────────────────────────────────────────────────────
    add_h1("6. Evidence-Grounded AI Assistant (MCGSE AI)")
    add_p(
        "MCGSE AI bridges the gap between raw spatial calculations and practical human decision-making. "
        "Operating as a sliding drawer on desktop and mobile, the assistant provides real-time natural language reasoning."
    )

    add_h2("6.1 Strict Zero-Hallucination Architecture")
    add_p(
        "The AI assistant is strictly bound to factual evidence sampled from the GIS package. Before any response is generated, "
        "the backend queries the actual raster package for criteria weights, coordinate inspection values, and state statistics. "
        "If a user asks about a location, the prompt fed to the model includes genuine numerical values. "
        "The model is explicitly forbidden from inventing numbers, coordinates, or hazard ratings."
    )

    add_h2("6.2 Conversational Warmth & Intent Filtering")
    add_p(
        "Unlike basic prototypes that dump raw factor weight tables on simple greetings, MCGSE AI features semantic intent detection:\n"
        "• Casual Greetings ('hi', 'hello', 'who are you?'): Responds with a warm, friendly welcome outlining capabilities without technical clutter.\n"
        "• Conceptual Questions ('what is gis in 10 words?', 'explain AHP'): Provides clear, educational summaries without dumping point-specific data.\n"
        "• Construction & House Inquiries ('should we build a house here?'): Automatically extracts point factors and presents a structured verdict, observations, secondary mountain hazard advisories, and actionable engineering next steps.\n"
        "• Comparative Inquiries ('compare flood and landslide'): Generates a clean tabular comparison highlighting the contrasting role of terrain factors."
    )

    add_h2("6.3 Event-Driven Real-Time Streaming & Visual Progress")
    add_p(
        "The AI assistant communicates via Server-Sent Events (SSE), providing real-time visual progress updates:\n"
        "1. Understanding Question & Spatial Context\n"
        "2. Identifying Active Spatial Model\n"
        "3. Retrieving Model Metadata & Criteria Weights\n"
        "4. Sampling 30m Multi-Band Rasters at Selected Coordinate\n"
        "5. Checking Boundary & Topographic Mountain Hazards\n"
        "6. Synthesizing Evidence into Natural Language"
    )

    add_h2("6.4 Interactive Structured Evidence Accordion")
    add_p(
        "Beneath each answer, users can expand an interactive 'Verified GIS Evidence' accordion displaying individual verified facts: "
        "Model ID, Statewide Mean Score, Primary Drivers, Measured Physical Values, and Data Sources. "
        "Users can click 'View on Map' to immediately highlight that specific layer on the GIS map canvas."
    )

    add_h2("6.5 Seamless Offline & Degraded Mode")
    add_p(
        "If the Ollama neural model is offline, busy, or uninstalled, the backend automatically engages its deterministic GIS synthesis engine. "
        "Users still receive comprehensive, plain-language construction assessments, factor breakdowns, and engineering advisories "
        "derived directly from the mathematical package facts—ensuring the application never crashes or leaves the user stranded."
    )

    # ─────────────────────────────────────────────────────────────
    # 7. ANALYTICS CENTER & STATISTICAL AGGREGATES
    # ─────────────────────────────────────────────────────────────
    add_h1("7. Analytics Center & Statistical Aggregates")
    add_p(
        "The Analytics drawer provides comprehensive statewide reporting across all 55,673 square kilometers of Himachal Pradesh:"
    )
    add_bullet("Class Distribution Charts: ", "Visual bar and pie charts illustrating the statewide area (km²) and percentage belonging to Class 1 through Class 5.")
    add_bullet("Statistical Baseline: ", "Statewide mean suitability score, standard deviation, and valid data footprint percentage.")
    add_bullet("District Breakdowns: ", "Comparative susceptibility summaries identifying the most vulnerable regional zones.")

    # ─────────────────────────────────────────────────────────────
    # 8. EXPORT CENTER & OPEN STANDARDS INTEROPERABILITY
    # ─────────────────────────────────────────────────────────────
    add_h1("8. Export Center & Interoperability")
    add_p(
        "MCGSE adheres to open geospatial data standards, allowing users to export results into standard external tools (QGIS, ArcGIS, Google Earth):"
    )
    add_bullet("1. Cloud-Optimized GeoTIFF (COG): ", "Export continuous suitability rasters and categorical classification GeoTIFFs for desktop GIS analysis.")
    add_bullet("2. GeoJSON Boundaries: ", "Export Himachal Pradesh boundary vectors, district limits, and flood risk polygons.")
    add_bullet("3. CSV Point Inspection Reports: ", "Export tabular spreadsheets containing coordinate inspections, raw factor metrics, and AHP ratings for engineering documentation.")
    add_bullet("4. Comprehensive Audit PDF Reports: ", "Generate printable compliance summaries for project approval files.")

    # ─────────────────────────────────────────────────────────────
    # 9. TUNNELING VS CLOUD DEPLOYMENT RESILIENCE
    # ─────────────────────────────────────────────────────────────
    add_h1("9. Tunneling vs. Cloud Deployment Flexibility")
    add_p(
        "A critical functional feature of MCGSE is complete deployment decoupling. "
        "The application can operate in three distinct networking configurations without code modifications:"
    )

    add_styled_table(
        ["Deployment Mode", "Networking Mechanism", "CORS Configuration", "Ideal Operational Use Case"],
        [
            ["Local Full-Stack", "Vite Proxy (/api -> http://127.0.0.1:8000)", "Zero CORS (same-origin relative proxying)", "Local developer testing, offline laptops, air-gapped workstations"],
            ["AWS Cloud Production", "CloudFront / Nginx reverse proxy unified route", "Zero CORS (single-domain /api/* to backend ALB)", "Public production deployment on AWS ECS/S3 with SSL and CDN caching"],
            ["Remote Tunnel Testing", "Secure Ngrok / Cloudflare Tunnel endpoint", "Dynamic CORS origin allowlist in backend .env", "Demonstrations, remote client access, mobile device field testing"],
        ],
        [Inches(1.5), Inches(1.8), Inches(1.5), Inches(1.7)]
    )

    add_p(
        "Users can view and adjust their backend connection URL at any time via the discreet 'Backend & Tunnel Settings' modal "
        "in the navigation menu, with automatic QR/link sharing for field inspectors on mobile smartphones."
    )

    # Save document
    doc.save(filename)
    print(f"[OK] Functional Document created successfully: {filename}")

if __name__ == "__main__":
    out_file = "MCGSE_Functional_Documentation.docx"
    create_functional_document(out_file)

