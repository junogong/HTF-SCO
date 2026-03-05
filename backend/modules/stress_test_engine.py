"""
Digital Wind Tunnel — Monte Carlo Stress Test Engine.
Generates black-swan scenarios via Gemini, runs each through the tiered
blast-radius engine, and ranks critical failure points proactively.
"""

import json
import logging
from services.vertex_simulator import vertex_ai
from services.spanner_simulator import graph_db
from modules.ingestion import ingest_signal

logger = logging.getLogger(__name__)

# ── Scenario generation prompt ─────────────────────────────────────────────

_SCENARIO_PROMPT = """You are a global supply chain risk strategist for an electronics manufacturer.
Generate 5 distinct "Black Swan" supply chain shock scenarios for 2025-2026.
Each must be plausible but severe. Cover different risk categories and geographies.

The manufacturer's supply chain spans: Taiwan (semiconductors), China (batteries, connectors),
Germany (MEMS sensors), Mexico (PCB assembly), India (passive components), Japan (RF modules),
Indonesia (resin), Ukraine (neon gas), D.R. Congo (cobalt), Chile (lithium), Malaysia (rare earths).

Return ONLY valid JSON — an array of exactly 5 objects, each with:
{
  "id": "scenario-1",
  "name": "string — short name",
  "description": "string — 2 sentence description of what happened",
  "signal": "string — the news headline/signal to ingest (mention a specific country/region)",
  "category": "geopolitical|weather|financial|logistics|quality",
  "probability": "low|medium|high",
  "affected_regions": ["list of countries"]
}"""


def generate_scenarios(n: int = 5) -> list:
    """Use Gemini to generate N black-swan supply chain scenarios."""
    try:
        raw = vertex_ai.generate_response(_SCENARIO_PROMPT, persona=None, context={})
        if isinstance(raw, list):
            return raw[:n]
        # Fallback: return static scenarios
    except Exception as e:
        logger.warning(f"Scenario generation failed: {e} — using static fallback")

    return _static_scenarios()


def run_scenario(scenario: dict) -> dict:
    """
    Run a single scenario through the full pipeline:
    1. Ingest the signal (classifies + links to suppliers)
    2. Tiered blast radius traversal from each affected supplier
    3. Aggregate Revenue-at-Risk, critical nodes, recommended pre-emptive actions
    """
    signal = scenario.get("signal", scenario.get("description", ""))

    try:
        ingestion = ingest_signal(signal, signal_type="stress_test")
    except Exception as e:
        logger.error(f"Ingestion failed for scenario {scenario.get('id')}: {e}")
        ingestion = {"affected_suppliers": [], "classification": {}}

    affected_suppliers = ingestion.get("affected_suppliers", [])
    all_tier1 = []
    all_products = []
    all_risk_paths = []

    # Run tiered blast radius from each directly-affected supplier
    for sup in affected_suppliers:
        if not sup:
            continue
        radius = graph_db.traverse_tiered_blast_radius(sup["id"], start_type="Supplier")
        for t1 in radius["tier1_suppliers"]:
            if not any(x["id"] == t1["id"] for x in all_tier1):
                all_tier1.append(t1)
        for prod in radius["products_at_risk"]:
            if not any(x["id"] == prod["id"] for x in all_products):
                all_products.append(prod)
        all_risk_paths.extend(radius["risk_paths"])

    # Also check sub-supplier nodes matched by region
    classification = ingestion.get("classification", {})
    region = classification.get("region")
    if region:
        sub_nodes = [
            n for n in graph_db.get_all_nodes("SubSupplier")
            if n.get("country", "").lower() in signal.lower()
            or region.lower() in n.get("category", "").lower()
        ]
        for sub in sub_nodes:
            radius = graph_db.traverse_tiered_blast_radius(sub["id"], start_type="SubSupplier")
            for t1 in radius["tier1_suppliers"]:
                if not any(x["id"] == t1["id"] for x in all_tier1):
                    all_tier1.append(t1)
            for prod in radius["products_at_risk"]:
                if not any(x["id"] == prod["id"] for x in all_products):
                    all_products.append(prod)

    # ── Calibrated Revenue-at-Risk (matches orchestrator.py logic) ────
    # Instead of naively summing 100% of annual revenue, scale by:
    #   1. Severity factor:   severity / 10
    #   2. Duration fraction: estimated disruption weeks / 52
    #   3. BOM concentration: fraction of each product's components affected
    severity = classification.get("severity", 5)
    severity_factor = severity / 10.0

    duration_weeks = {1: 0.5, 2: 1, 3: 1.5, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 10, 10: 12}.get(severity, 3)
    duration_fraction = duration_weeks / 52.0

    # Collect IDs of all affected components from blast radius traversal
    affected_component_ids = set()
    for sup in affected_suppliers:
        if not sup:
            continue
        sup_components = graph_db.query_neighbors(sup.get("type", "Supplier"), sup["id"], edge_type="SUPPLIES")
        for neighbor in sup_components:
            comp = neighbor.get("node", {})
            if comp.get("type") == "Component":
                affected_component_ids.add(comp["id"])

    total_revenue = 0
    all_bom_edges = graph_db.get_edges(edge_type="USED_IN")
    for prod in all_products:
        prod_bom_size = sum(1 for e in all_bom_edges if e["target_id"] == prod["id"])
        affected_in_bom = sum(1 for e in all_bom_edges
                              if e["target_id"] == prod["id"] and e["source_id"] in affected_component_ids)
        bom_fraction = affected_in_bom / max(prod_bom_size, 1)
        product_exposure = prod.get("annual_revenue", 0) * severity_factor * duration_fraction * bom_fraction
        total_revenue += product_exposure

    total_revenue = round(total_revenue)

    # Recommend pre-emptive stock builds for critical components
    preemptive_actions = _recommend_preemptive_actions(all_tier1, all_products, total_revenue)

    return {
        **scenario,
        "revenue_at_risk": total_revenue,
        "tier1_suppliers_impacted": len(all_tier1),
        "affected_tier1": [{"id": s["id"], "name": s["name"], "country": s.get("country"),
                             "risk_path": s.get("risk_path", "")} for s in all_tier1],
        "products_at_risk": len(all_products),
        "affected_products": [{"id": p["id"], "name": p["name"],
                               "annual_revenue": p.get("annual_revenue", 0)} for p in all_products],
        "risk_paths": all_risk_paths[:3],  # Top 3 paths
        "preemptive_actions": preemptive_actions,
    }


def run_stress_test() -> dict:
    """
    Run all scenarios and return:
    - Per-scenario results
    - Top 3 most critical failure points (nodes with highest Revenue-at-Risk)
    - Global pre-emptive recommendations
    """
    scenarios = generate_scenarios(5)
    results = []

    for scenario in scenarios:
        logger.info(f"Running stress test scenario: {scenario.get('name')}")
        result = run_scenario(scenario)
        results.append(result)

    # Rank by revenue at risk
    results_sorted = sorted(results, key=lambda x: x.get("revenue_at_risk", 0), reverse=True)

    # Identify critical failure nodes across all scenarios
    failure_node_counts = {}
    for r in results:
        for t1 in r.get("affected_tier1", []):
            nid = t1["id"]
            if nid not in failure_node_counts:
                failure_node_counts[nid] = {"node": t1, "scenario_count": 0, "total_revenue": 0}
            failure_node_counts[nid]["scenario_count"] += 1
            failure_node_counts[nid]["total_revenue"] += r.get("revenue_at_risk", 0)

    critical_nodes = sorted(
        failure_node_counts.values(),
        key=lambda x: (x["scenario_count"], x["total_revenue"]),
        reverse=True
    )[:3]

    return {
        "scenarios": results_sorted,
        "critical_failure_points": [
            {
                "supplier": c["node"],
                "appears_in_scenarios": c["scenario_count"],
                "cumulative_revenue_at_risk": c["total_revenue"],
                "recommendation": f"Build 8-week safety stock for all components from {c['node']['name']} immediately.",
            }
            for c in critical_nodes
        ],
        "total_revenue_exposed": sum(r.get("revenue_at_risk", 0) for r in results),
        "highest_risk_scenario": results_sorted[0]["name"] if results_sorted else "N/A",
    }


# ── Helpers ────────────────────────────────────────────────────────────────

def _recommend_preemptive_actions(tier1_suppliers, products, revenue):
    actions = []
    for sup in tier1_suppliers[:2]:
        contract_val = sup.get("annual_contract_value", 0)
        actions.append({
            "type": "preemptive_stock_build",
            "title": f"Pre-emptive Stock Build — {sup['name']}",
            "description": f"Increase safety stock for components from {sup['name']} "
                           f"(${contract_val:,}/yr contract) to 8-week buffer.",
            "priority": "HIGH",
            "timeline": "This week",
        })
    if revenue > 5_000_000:
        actions.append({
            "type": "supplier_diversification",
            "title": "Accelerate Supplier Diversification",
            "description": f"Revenue exposure of ${revenue:,} warrants qualifying alternate suppliers immediately.",
            "priority": "HIGH",
            "timeline": "30 days",
        })
    return actions


def _static_scenarios():
    """Fallback hard-coded scenarios if Gemini is unavailable."""
    return [
        {"id": "scenario-1", "name": "Taiwan Strait Blockade",
         "description": "China announces naval blockade around Taiwan. All maritime shipping halted.",
         "signal": "China imposes naval blockade around Taiwan, halting all semiconductor shipments",
         "category": "geopolitical", "probability": "low", "affected_regions": ["Taiwan", "China"]},
        {"id": "scenario-2", "name": "Ukraine Neon Gas Embargo",
         "description": "Ukraine halts all gas exports amid escalating conflict. Semiconductor fabs face neon shortage.",
         "signal": "Ukraine halts neon gas exports, threatening global semiconductor lithography capacity",
         "category": "geopolitical", "probability": "medium", "affected_regions": ["Ukraine"]},
        {"id": "scenario-3", "name": "Indonesia Volcanic Eruption",
         "description": "Mount Merapi erupts, disrupting palm oil and resin production across Java.",
         "signal": "Mount Merapi volcanic eruption in Indonesia shuts down epoxy resin production facilities",
         "category": "weather", "probability": "medium", "affected_regions": ["Indonesia"]},
        {"id": "scenario-4", "name": "DRC Cobalt Export Ban",
         "description": "D.R. Congo government nationalizes cobalt mines and bans raw exports.",
         "signal": "D.R. Congo nationalizes cobalt mines and imposes export ban, disrupting EV battery supply chain",
         "category": "geopolitical", "probability": "medium", "affected_regions": ["D.R. Congo"]},
        {"id": "scenario-5", "name": "South China Sea Port Closures",
         "description": "Typhoon Vera forces closure of Shenzhen and Shanghai ports for 3 weeks.",
         "signal": "Super Typhoon Vera forces closure of Shenzhen and Shanghai ports for estimated 3 weeks",
         "category": "weather", "probability": "high", "affected_regions": ["China"]},
    ]
