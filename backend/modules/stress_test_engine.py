"""
Digital Wind Tunnel — Monte Carlo Stress Test Engine.
Generates black-swan scenarios via Gemini, runs each through the tiered
blast-radius engine, and ranks critical failure points proactively.
"""

import json
import logging
import concurrent.futures
from services.vertex_simulator import vertex_ai
from services.spanner_simulator import graph_db
from modules.ingestion import ingest_signal

logger = logging.getLogger(__name__)

# ── Dynamic scenario generation prompt (graph-aware) ───────────────────────

def _build_scenario_prompt() -> str:
    """Build the scenario generation prompt dynamically from the live graph."""
    # Collect all suppliers and their countries/categories
    suppliers = graph_db.get_all_nodes("Supplier")
    sub_suppliers = graph_db.get_all_nodes("SubSupplier")
    regions = graph_db.get_all_nodes("Region")

    supplier_lines = []
    for s in suppliers:
        caps = ", ".join(s.get("capabilities", [])[:3]) if s.get("capabilities") else s.get("category", "")
        supplier_lines.append(f"  - {s['name']} ({s.get('country', '?')}) — {caps}")

    sub_lines = []
    for ss in sub_suppliers:
        note = ss.get("risk_note", ss.get("category", ""))
        sub_lines.append(f"  - {ss.get('name', '?')} ({ss.get('country', '?')}) — {note}")

    region_lines = []
    for r in regions:
        factors = ", ".join(r.get("risk_factors", []))
        region_lines.append(f"  - {r.get('name', '?')} (Risk: {r.get('risk_level', '?')}) — {factors}")

    # Extract unique countries for emphasis
    all_countries = sorted(set(
        s.get("country", "") for s in suppliers + sub_suppliers if s.get("country")
    ))

    return f"""You are a global supply chain risk strategist.
Generate 5 distinct, highly realistic and probable supply chain disruption scenarios that could happen tomorrow.
Avoid outlandish "Black Swan" events (like global wars or meteor strikes). Focus on likely operational, financial, logistics, or localized weather constraints.

CRITICAL RULES:
- Each scenario's "signal" field MUST explicitly mention one of these EXACT country names: {', '.join(all_countries)}
- The signal must read like a real news headline
- Cover different risk categories and geographies
- Each scenario must be highly plausible and realistic to a standard manufacturing supply chain

=== OUR TIER-1 SUPPLIERS (target these) ===
{chr(10).join(supplier_lines)}

=== OUR UPSTREAM SUB-SUPPLIERS (Tier 2/3) ===
{chr(10).join(sub_lines)}

=== HIGH-RISK REGIONS ===
{chr(10).join(region_lines)}

Return ONLY valid JSON — an array of exactly 5 objects:
[
  {{
    "id": "scenario-1",
    "name": "string — short descriptive name",
    "description": "string — 2 sentence description of what happened",
    "signal": "string — a news headline mentioning a SPECIFIC country from the list above",
    "category": "geopolitical|weather|financial|logistics|quality",
    "probability": <int> — an integer from 1 to 10 representing likelihood (10 is most likely),
    "affected_regions": ["list of affected countries from the list above"],
    "suggested_actions": ["list of string — 1-2 suggested immediate actions to take"]
  }}
]"""


def generate_scenarios(n: int = 5) -> list:
    """Use Gemini to generate N black-swan supply chain scenarios from live graph data."""
    prompt = _build_scenario_prompt()
    try:
        raw = vertex_ai.generate_response(prompt, persona=None, context={})
        if isinstance(raw, list):
            return raw[:n]
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

    # If the model already gave us category/severity/regions/actions, 
    # use them as pre-classification to skip extra LLM calls in ingestion.
    pre_classified = {
        "category": scenario.get("category", "general"),
        "severity": scenario.get("severity", 5),
        "affected_countries": scenario.get("affected_regions", []),
        "reasoning": scenario.get("description", ""),
        "keywords": scenario.get("suggested_actions", [])[:3]
    }

    try:
        ingestion = ingest_signal(signal, signal_type="stress_test", pre_classified=pre_classified)
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

    # Recommend pre-emptive actions based on graph, fallback to LLM suggestions
    preemptive_actions = _recommend_preemptive_actions(all_tier1, all_products, total_revenue)
    if not preemptive_actions and scenario.get("suggested_actions"):
        for i, acc in enumerate(scenario.get("suggested_actions", [])):
            preemptive_actions.append({
                "type": "custom_action",
                "title": f"Investigate Mitigation",
                "description": acc,
                "priority": "HIGH",
                "timeline": "This week"
            })

    # Calculate post-mitigation R@R
    mitigated_revenue = total_revenue
    if preemptive_actions:
        # Assume preemptive actions (like stock builds or diversification) reduce exposure by ~65%
        mitigated_revenue = round(total_revenue * 0.35)
    
    risk_reduction = total_revenue - mitigated_revenue

    return {
        **scenario,
        "revenue_at_risk": total_revenue,
        "post_mitigation_revenue": mitigated_revenue,
        "risk_reduction": risk_reduction,
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
    scenarios = generate_scenarios(3)
    results = []

    with concurrent.futures.ThreadPoolExecutor() as executor:
        future_to_scenario = {executor.submit(run_scenario, s): s for s in scenarios}
        for future in concurrent.futures.as_completed(future_to_scenario):
            try:
                results.append(future.result())
            except Exception as e:
                logger.error(f"Scenario execution failed: {e}")

    if not results:
        return {"error": "All simulation scenarios failed"}

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
        "total_post_mitigation": sum(r.get("post_mitigation_revenue", 0) for r in results),
        "total_risk_reduced": sum(r.get("risk_reduction", 0) for r in results),
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
        {"id": "scenario-1", "name": "Taiwan Factory Power Outage",
         "description": "Major localized power outage strikes industrial parks, halting production.",
         "signal": "Taiwan industrial park experiences rolling blackouts, affecting local manufacturing",
         "category": "logistics", "probability": 8, "affected_regions": ["Taiwan"],
         "suggested_actions": ["Contact Taiwan suppliers to confirm backup generator capacity", "Source alternate inventory"]},
        {"id": "scenario-2", "name": "European Port Strike",
         "description": "Workers at major European ports announce a 2-week strike over wages.",
         "signal": "Dockworkers across European ports initiate strike, delaying maritime freight",
         "category": "logistics", "probability": 7, "affected_regions": ["Germany"],
         "suggested_actions": ["Reroute inbound shipments to air freight", "Increase local safety stock"]},
        {"id": "scenario-3", "name": "Indonesia Flood",
         "description": "Heavy monsoon rains cause severe flooding in major industrial zones.",
         "signal": "Severe flooding in Indonesia disrupts transit and warehouse operations",
         "category": "weather", "probability": 6, "affected_regions": ["Indonesia"],
         "suggested_actions": ["Audit warehouse inventory for water damage risk"]},
        {"id": "scenario-4", "name": "Financial Distress Alert",
         "description": "A key raw materials vendor is downgraded by credit agencies.",
         "signal": "Major mining consortium downgraded to junk status amidst liquidity crisis",
         "category": "financial", "probability": 5, "affected_regions": ["D.R. Congo"],
         "suggested_actions": ["Accelerate onboarding of secondary supplier", "Audit outstanding invoices"]},
        {"id": "scenario-5", "name": "Customs System Outage",
         "description": "A ransomware attack takes down regional customs processing systems.",
         "signal": "Cyberattack on regional customs authorities creates 4-day backlog",
         "category": "geopolitical", "probability": 4, "affected_regions": ["China"],
         "suggested_actions": ["Inform customers of impending delays", "Shift volume to unaffected regional ports"]},
    ]
