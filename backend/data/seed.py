"""
Seed Data — Realistic supply chain graph for NexGen Electronics.
Populates Spanner Graph + Firestore with demo data on startup.
"""

from services.spanner_simulator import graph_db
from services.firestore_simulator import firestore_db
from services.vertex_simulator import vertex_ai


def seed_all():
    """Populate the graph with a realistic manufacturing supply chain."""
    _seed_company()
    _seed_suppliers()
    _seed_sub_suppliers()   # Tier-2 / Tier-3 upstream nodes
    _seed_components()
    _seed_products()
    _seed_edges()
    _seed_lessons()
    _seed_feedback()


def _seed_company():
    graph_db.add_node("Company", "nexgen", {
        "name": "NexGen Electronics",
        "industry": "Consumer & Industrial Electronics",
        "hq": "Austin, TX",
        "annual_revenue": 450000000,
        "employees": 2800,
        "embedding": vertex_ai.generate_embedding("NexGen Electronics consumer industrial manufacturer"),
    })


def _seed_suppliers():
    suppliers = [
        {
            "id": "sup-tsmc", "name": "TSMC Semiconductor", "country": "Taiwan", "region": "East Asia",
            "category": "Semiconductors", "tier": 1,
            "metrics": {"on_time_delivery": 94, "quality_score": 97, "financial_stability": 92},
            "health_score": 91, "prev_health_score": 93,
            "capabilities": ["5nm chips", "7nm chips", "MCU fabrication"],
            "annual_contract_value": 28000000,
            "sla_penalty_per_day": 5000,
        },
        {
            "id": "sup-byd", "name": "BYD Battery Co.", "country": "China", "region": "East Asia",
            "category": "Batteries & Power", "tier": 1,
            "metrics": {"on_time_delivery": 88, "quality_score": 91, "financial_stability": 85},
            "health_score": 82, "prev_health_score": 86,
            "capabilities": ["Li-ion cells", "Battery packs", "BMS modules"],
            "annual_contract_value": 15000000,
            "sla_penalty_per_day": 3500,
        },
        {
            "id": "sup-bosch", "name": "Bosch Sensortech", "country": "Germany", "region": "Europe",
            "category": "Sensors & MEMS", "tier": 1,
            "metrics": {"on_time_delivery": 96, "quality_score": 98, "financial_stability": 95},
            "health_score": 95, "prev_health_score": 94,
            "capabilities": ["MEMS sensors", "IMU units", "Pressure sensors"],
            "annual_contract_value": 12000000,
            "sla_penalty_per_day": 4000,
        },
        {
            "id": "sup-flex", "name": "Flex Ltd.", "country": "Mexico", "region": "North America",
            "category": "PCB & Assembly", "tier": 1,
            "metrics": {"on_time_delivery": 91, "quality_score": 89, "financial_stability": 78},
            "health_score": 79, "prev_health_score": 82,
            "capabilities": ["PCB fabrication", "SMT assembly", "Final assembly"],
            "annual_contract_value": 22000000,
            "sla_penalty_per_day": 4500,
        },
        {
            "id": "sup-lg", "name": "LG Display", "country": "South Korea", "region": "East Asia",
            "category": "Displays", "tier": 1,
            "metrics": {"on_time_delivery": 92, "quality_score": 94, "financial_stability": 88},
            "health_score": 87, "prev_health_score": 89,
            "capabilities": ["OLED panels", "LCD modules", "Touch digitizers"],
            "annual_contract_value": 18000000,
            "sla_penalty_per_day": 3800,
        },
        {
            "id": "sup-tata", "name": "Tata Electronics", "country": "India", "region": "South Asia",
            "category": "Passive Components", "tier": 2,
            "metrics": {"on_time_delivery": 82, "quality_score": 86, "financial_stability": 72},
            "health_score": 68, "prev_health_score": 71,
            "capabilities": ["Capacitors", "Resistors", "Inductors"],
            "annual_contract_value": 5000000,
            "sla_penalty_per_day": 1500,
        },
        {
            "id": "sup-murata", "name": "Murata Manufacturing", "country": "Japan", "region": "East Asia",
            "category": "RF & Connectivity", "tier": 1,
            "metrics": {"on_time_delivery": 95, "quality_score": 96, "financial_stability": 93},
            "health_score": 93, "prev_health_score": 92,
            "capabilities": ["WiFi modules", "Bluetooth chips", "RF filters"],
            "annual_contract_value": 9000000,
            "sla_penalty_per_day": 2800,
        },
        {
            "id": "sup-jabil", "name": "Jabil Circuit", "country": "China", "region": "East Asia",
            "category": "Connectors & Enclosures", "tier": 2,
            "metrics": {"on_time_delivery": 86, "quality_score": 88, "financial_stability": 80},
            "health_score": 76, "prev_health_score": 78,
            "capabilities": ["Custom enclosures", "Cable assemblies", "Thermal solutions"],
            "annual_contract_value": 8000000,
            "sla_penalty_per_day": 2000,
        },
    ]

    for s in suppliers:
        props = {**s}
        props["embedding"] = vertex_ai.generate_embedding(
            f"{s['name']} {s['country']} {s['category']} {' '.join(s['capabilities'])}"
        )
        graph_db.add_node("Supplier", s["id"], props)


def _seed_sub_suppliers():
    """
    Tier-2 and Tier-3 upstream sub-suppliers and Regions.
    Edges: Supplier -[SOURCES_FROM]-> SubSupplier -[LOCATED_IN]-> Region
    """
    # ── Regions (Tier-3 geography nodes) ──────────────────────────────
    regions = [
        {"id": "reg-indonesia", "name": "Indonesia", "country": "Indonesia",
         "risk_level": "HIGH", "risk_factors": ["volcanic_activity", "political_instability", "monsoon"]},
        {"id": "reg-congo",     "name": "D.R. Congo",  "country": "D.R. Congo",
         "risk_level": "CRITICAL", "risk_factors": ["conflict_minerals", "political_instability", "export_controls"]},
        {"id": "reg-netherlands", "name": "Netherlands", "country": "Netherlands",
         "risk_level": "LOW", "risk_factors": ["flooding"]},
        {"id": "reg-ukraine",   "name": "Ukraine",  "country": "Ukraine",
         "risk_level": "CRITICAL", "risk_factors": ["geopolitical_conflict", "infrastructure_damage"]},
        {"id": "reg-malaysia",  "name": "Malaysia",  "country": "Malaysia",
         "risk_level": "MEDIUM", "risk_factors": ["flooding", "political_instability"]},
        {"id": "reg-chile",    "name": "Chile",     "country": "Chile",
         "risk_level": "LOW", "risk_factors": ["earthquake", "drought"]},
    ]
    for r in regions:
        graph_db.add_node("Region", r["id"], {**r, "type": "Region",
            "coords": {"reg-indonesia": [113.9, -0.8], "reg-congo": [25.0, -4.0],
                        "reg-netherlands": [5.3, 52.1], "reg-ukraine": [31.2, 49.0],
                        "reg-malaysia": [109.7, 4.2], "reg-chile": [-71.5, -35.7]}.get(r["id"], [0, 0])})

    # ── Tier-2 Sub-Suppliers ─────────────────────────────────────────
    sub_suppliers = [
        # ASML supplies lithography machines to TSMC
        {"id": "sub-asml", "name": "ASML Holding", "country": "Netherlands",
         "category": "EUV Lithography", "tier": 2, "region_id": "reg-netherlands",
         "supplies_to": ["sup-tsmc"],
         "risk_note": "Sole global supplier of EUV machines — zero substitutes"},
        # Cobalt mines supply BYD batteries
        {"id": "sub-glencore", "name": "Glencore Cobalt Mining", "country": "D.R. Congo",
         "category": "Cobalt Ore", "tier": 3, "region_id": "reg-congo",
         "supplies_to": ["sub-catl"],
         "risk_note": "Conflict-mineral zone — ESG and export risk"},
        # CATL is a Tier-2 cell manufacturer supplying BYD
        {"id": "sub-catl", "name": "CATL Cell Division", "country": "China",
         "category": "Battery Cells", "tier": 2, "region_id": None,
         "supplies_to": ["sup-byd"],
         "risk_note": "Depends on DRC cobalt supply chain"},
        # Palm oil / resin supplier for Flex PCB encapsulants
        {"id": "sub-palmco", "name": "PalmCo Resins", "country": "Indonesia",
         "category": "Epoxy Resins", "tier": 2, "region_id": "reg-indonesia",
         "supplies_to": ["sup-flex"],
         "risk_note": "PCB encapsulant resin — wildfire and flood risk"},
        # Neon gas (used in semiconductor lithography) from Ukraine
        {"id": "sub-neon-ua", "name": "Ingas Neon Ukraine", "country": "Ukraine",
         "category": "Semiconductor Neon Gas", "tier": 2, "region_id": "reg-ukraine",
         "supplies_to": ["sup-tsmc", "sup-murata"],
         "risk_note": "50%+ of global semiconductor neon from Ukraine"},
        # Lithium from Chile for BYD
        {"id": "sub-sqm", "name": "SQM Lithium Chile", "country": "Chile",
         "category": "Lithium Carbonate", "tier": 3, "region_id": "reg-chile",
         "supplies_to": ["sub-catl"],
         "risk_note": "Primary lithium source for battery cathodes"},
        # Rare-earth magnets from Malaysia for Bosch sensors
        {"id": "sub-lynas", "name": "Lynas Rare Earths", "country": "Malaysia",
         "category": "Rare Earth Magnets", "tier": 2, "region_id": "reg-malaysia",
         "supplies_to": ["sup-bosch"],
         "risk_note": "MEMS sensor magnets — limited alternative suppliers"},
    ]

    for ss in sub_suppliers:
        props = {k: v for k, v in ss.items() if k not in ("region_id", "supplies_to")}
        props["type"] = "SubSupplier"
        props["embedding"] = vertex_ai.generate_embedding(
            f"{ss['name']} {ss['category']} {ss.get('risk_note', '')}"
        )
        graph_db.add_node("SubSupplier", ss["id"], props)

        # Link SubSupplier → Region (LOCATED_IN)
        if ss["region_id"]:
            graph_db.add_edge("SubSupplier", ss["id"], "Region", ss["region_id"], "LOCATED_IN")

        # Link Supplier → SubSupplier (SOURCES_FROM)
        for tier1_id in ss["supplies_to"]:
            source_type = "Supplier" if tier1_id.startswith("sup-") else "SubSupplier"
            if source_type == "Supplier":
                graph_db.add_edge("Supplier", tier1_id, "SubSupplier", ss["id"], "SOURCES_FROM")
            else:
                graph_db.add_edge("SubSupplier", tier1_id, "SubSupplier", ss["id"], "SOURCES_FROM")



def _seed_components():
    components = [
        {"id": "comp-mcu", "name": "ARM Cortex-M7 MCU", "category": "Processor", "critical": True, "unit_cost": 8.50, "stock_days": 10},
        {"id": "comp-wifi", "name": "WiFi 6E Module", "category": "Connectivity", "critical": True, "unit_cost": 4.20, "stock_days": 25},
        {"id": "comp-batt", "name": "Li-ion 3.7V 5000mAh Cell", "category": "Power", "critical": True, "unit_cost": 6.80, "stock_days": 8},
        {"id": "comp-oled", "name": "2.4\" OLED Display", "category": "Display", "critical": False, "unit_cost": 12.50, "stock_days": 35},
        {"id": "comp-pcb", "name": "6-Layer HDI PCB", "category": "Board", "critical": True, "unit_cost": 3.20, "stock_days": 14},
        {"id": "comp-imu", "name": "6-Axis IMU Sensor", "category": "Sensor", "critical": True, "unit_cost": 2.80, "stock_days": 32},
        {"id": "comp-pres", "name": "Barometric Pressure Sensor", "category": "Sensor", "critical": False, "unit_cost": 1.50, "stock_days": 42},
        {"id": "comp-cap", "name": "MLCC Capacitor Array", "category": "Passive", "critical": False, "unit_cost": 0.15, "stock_days": 60},
        {"id": "comp-encl", "name": "IP67 Aluminum Enclosure", "category": "Mechanical", "critical": False, "unit_cost": 14.00, "stock_days": 28},
        {"id": "comp-bms", "name": "Battery Management System", "category": "Power", "critical": True, "unit_cost": 5.50, "stock_days": 12},
        {"id": "comp-rf", "name": "Sub-GHz RF Transceiver", "category": "Connectivity", "critical": False, "unit_cost": 3.10, "stock_days": 30},
        {"id": "comp-therm", "name": "Thermal Management Module", "category": "Mechanical", "critical": False, "unit_cost": 7.20, "stock_days": 24},
    ]

    for c in components:
        props = {**c}
        props["embedding"] = vertex_ai.generate_embedding(f"{c['name']} {c['category']} electronic component")
        graph_db.add_node("Component", c["id"], props)


def _seed_products():
    products = [
        {"id": "prod-therm", "name": "Smart Thermostat Pro", "category": "Consumer IoT",
         "annual_units": 250000, "unit_price": 149.99, "annual_revenue": 37497500},
        {"id": "prod-sensor", "name": "Industrial Sensor Hub", "category": "Industrial IoT",
         "annual_units": 85000, "unit_price": 499.00, "annual_revenue": 42415000},
        {"id": "prod-evcharge", "name": "EV Charger Controller", "category": "Automotive",
         "annual_units": 45000, "unit_price": 899.00, "annual_revenue": 40455000},
        {"id": "prod-drone", "name": "Drone Flight Controller", "category": "Aerospace",
         "annual_units": 120000, "unit_price": 229.00, "annual_revenue": 27480000},
    ]

    for p in products:
        props = {**p}
        props["embedding"] = vertex_ai.generate_embedding(f"{p['name']} {p['category']} product")
        graph_db.add_node("Product", p["id"], props)


def _seed_edges():
    # Supplier → Component (SUPPLIES)
    supply_map = [
        ("sup-tsmc", "comp-mcu"),
        ("sup-murata", "comp-wifi"),
        ("sup-byd", "comp-batt"),
        ("sup-byd", "comp-bms"),
        ("sup-lg", "comp-oled"),
        ("sup-flex", "comp-pcb"),
        ("sup-bosch", "comp-imu"),
        ("sup-bosch", "comp-pres"),
        ("sup-tata", "comp-cap"),
        ("sup-jabil", "comp-encl"),
        ("sup-jabil", "comp-therm"),
        ("sup-murata", "comp-rf"),
    ]
    for sid, cid in supply_map:
        graph_db.add_edge("Supplier", sid, "Component", cid, "SUPPLIES")

    # Component → Product (USED_IN)
    product_bom = {
        "prod-therm": ["comp-mcu", "comp-wifi", "comp-oled", "comp-pcb", "comp-cap", "comp-pres"],
        "prod-sensor": ["comp-mcu", "comp-imu", "comp-pres", "comp-pcb", "comp-rf", "comp-cap", "comp-encl"],
        "prod-evcharge": ["comp-mcu", "comp-batt", "comp-bms", "comp-pcb", "comp-wifi", "comp-therm"],
        "prod-drone": ["comp-mcu", "comp-imu", "comp-batt", "comp-bms", "comp-rf", "comp-pcb", "comp-cap"],
    }
    for pid, comps in product_bom.items():
        for cid in comps:
            graph_db.add_edge("Component", cid, "Product", pid, "USED_IN")

    # Company → Product (MANUFACTURES)
    for pid in product_bom:
        graph_db.add_edge("Company", "nexgen", "Product", pid, "MANUFACTURES")


def _seed_lessons():
    """Pre-seed past lessons in Firestore for memory retrieval."""
    lessons = [
        {
            "strategy_id": "lesson-001",
            "summary": "Rerouted TSMC chip orders through Samsung foundry during 2024 Taiwan earthquake. "
                       "Expedited air freight cost 2.3x standard but preserved 92% of affected orders.",
            "context": "Earthquake disruption affecting semiconductor supply from Taiwan",
            "rating": 4,
            "actual_outcome": "Rerouting preserved revenue but cost 18% more than budgeted. "
                              "Lead time increased by 8 days average.",
            "embedding": vertex_ai.generate_embedding(
                "earthquake taiwan semiconductor rerouting air freight TSMC"
            ),
        },
        {
            "strategy_id": "lesson-002",
            "summary": "Built 8-week safety stock ahead of predicted monsoon season in India. "
                       "Prevented 100% of passive component shortages for Q3 production.",
            "context": "Monsoon season supply disruption in India affecting passive components",
            "rating": 5,
            "actual_outcome": "Pre-emptive stock build was highly effective. Zero production disruptions. "
                              "Holding cost was $45K but saved estimated $380K in delays.",
            "embedding": vertex_ai.generate_embedding(
                "monsoon india passive components safety stock preemptive build"
            ),
        },
        {
            "strategy_id": "lesson-003",
            "summary": "Activated backup shipping routes during Shenzhen port congestion. Split orders "
                       "across 3 carriers. Service level dropped to 85% for 2 weeks.",
            "context": "Port congestion at Shenzhen affecting multiple shipments from China-based suppliers",
            "rating": 2,
            "actual_outcome": "Splitting across carriers caused coordination issues. Costs overran by 35%. "
                              "Should have consolidated to single premium carrier instead.",
            "embedding": vertex_ai.generate_embedding(
                "port congestion shenzhen china shipping rerouting carrier split"
            ),
        },
    ]

    for lesson in lessons:
        firestore_db.add_document("lessons", lesson, doc_id=lesson["strategy_id"])


def _seed_feedback():
    """Pre-seed past user feedback to trigger the continuous learning reflection engine."""
    feedback_entries = [
        {
            "strategy_id": "lesson-003",
            "rating": 2,
            "comment": "Costs overran significantly. The expedited shipping was too expensive for this margin.",
            "actual_outcome": "Mitigation succeeded but cost 35% more than budget."
        },
        {
            "strategy_id": "lesson-004",
            "rating": 2,
            "comment": "Another instance where expedited logistics destroyed our product margin. We need to be more cost cautious.",
            "actual_outcome": "Margin completely erased due to expensive mitigation."
        },
        {
            "strategy_id": "lesson-005",
            "rating": 2,
            "comment": "Supplier communication was too slow, causing a massive delay in our response.",
            "actual_outcome": "Late delivery due to slow reaction time."
        },
        {
            "strategy_id": "lesson-006",
            "rating": 2,
            "comment": "We missed the project deadline by a week because we didn't reroute fast enough.",
            "actual_outcome": "SLA penalty triggered due to time delay."
        }
    ]
    
    for fb in feedback_entries:
        firestore_db.add_document("feedback", fb)
