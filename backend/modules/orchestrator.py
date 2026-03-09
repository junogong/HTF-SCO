"""
Risk Orchestrator — Central controller for the disruption analysis pipeline.
Manages: signal classification → blast radius → memory retrieval → multi-agent debate →
synthesis → action generation → executive escalation → reasoning trace with source citations.

Performance features:
  - Context Caching: Static war-room context (graph schema, ERP rules, supplier metadata)
    is cached via Vertex AI to reduce latency and token costs.
  - High-Speed Classifier: Uses fine-tuned Gemini 1.5 Flash for sub-second classification.
"""

import time
import logging
import json
import os
import random
import concurrent.futures
from modules.ingestion import ingest_signal
from modules.agents import logistics_agent, finance_agent
from modules.memory import retrieve_relevant_lessons, reflect_on_outcomes, format_lessons_for_context, store_lesson
from modules.health_scoring import calculate_health_score
from modules.guardrails import fact_checker, HITL_REVENUE_THRESHOLD
from modules.classifier import classifier as high_speed_classifier
from services.vertex_simulator import vertex_ai
from services.spanner_simulator import graph_db
from config import CONFIDENCE_THRESHOLD, USE_REAL_VERTEX

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════
# CONTEXT CACHING — Static War Room Context
# ══════════════════════════════════════════════════════════════════════

WAR_ROOM_STATIC_CONTEXT = """
=== SPANNER GRAPH SCHEMA ===
Node Types:
  - Supplier:     {id, name, country, region, category, reliability_score, embedding}
  - SubSupplier:  {id, name, country, category, tier(2|3), risk_note, embedding}
  - Region:       {id, name, risk_level}
  - Component:    {id, name, category, critical(bool), unit_cost, stock_days}
  - Product:      {id, name, annual_revenue, components[]}
  - Signal:       {id, text, type, category, severity, region, embedding}

Edge Types:
  - (Supplier)   -[:SUPPLIES]->     (Component)
  - (Component)  -[:USED_IN]->      (Product)
  - (Supplier)   -[:SOURCES_FROM]-> (SubSupplier)
  - (SubSupplier)-[:SOURCES_FROM]-> (SubSupplier)
  - (SubSupplier)-[:LOCATED_IN]->   (Region)
  - (Signal)     -[:AFFECTS]->      (Supplier)

=== ERP BUSINESS RULES ===
1. Safety Stock Policy: Maintain 4-week buffer for critical components.
2. Single-Source Threshold: Components with <2 qualified suppliers flagged as CRITICAL.
3. Revenue-at-Risk Escalation: If total product revenue exposure > company threshold, auto-escalate to executive.
4. SLA Penalty: $2,500/day per delayed supplier, contractual caps at 15% of annual spend.
5. Expedited Shipping: 2.8x cost multiplier for air freight rerouting.
6. Risk Appetite Profiles:
   - Conservative: Prioritize cost over speed (2.0x cost weight, 0.5x speed weight)
   - Balanced:     Equal priority (1.0x / 1.0x)
   - Aggressive:   Prioritize speed over cost (0.5x cost weight, 2.0x speed weight)

=== SUPPLIER NETWORK ===
Tier-1 Suppliers: TSMC (Taiwan), BYD Battery (China), Bosch Sensortech (Germany),
  Flex Ltd (Mexico), LG Display (South Korea), Tata Electronics (India),
  Murata Manufacturing (Japan), Jabil Circuit (China).

Tier-2 Sub-Suppliers: ASML Holding (Netherlands→TSMC), CATL Cell Division (China→BYD),
  PalmCo Resins (Indonesia→Flex), Ingas Neon (Ukraine→TSMC,Murata),
  Lynas Rare Earths (Malaysia→Bosch).

Tier-3 Sub-Suppliers: Glencore Cobalt (D.R. Congo→CATL), SQM Lithium (Chile→CATL).

=== PRODUCT PORTFOLIO ===
NexGen Pro X1: $45M annual revenue — MCU, WiFi, battery, OLED, PCB, sensor, housing
NexGen IoT Hub: $28M annual revenue — MCU, WiFi, battery, PCB, housing
NexGen Sense: $18M annual revenue — sensor, MCU, PCB, battery, housing
NexGen Display: $12M annual revenue — OLED, MCU, WiFi, PCB, housing

=== RISK ASSESSMENT FRAMEWORK ===
Signal Categories & Expected Response Times:
  - Geopolitical (sanctions, tariffs, trade wars): Response within 4 hours.
    Typical impact: supplier access restrictions, customs holds, trade route changes.
    Mitigation: activate alternate suppliers, pre-position inventory, engage legal counsel.
  - Weather (earthquakes, floods, typhoons, wildfires): Response within 2 hours.
    Typical impact: facility shutdowns, logistics route disruptions, workforce displacement.
    Mitigation: reroute shipments, activate safety stock, contact affected suppliers.
  - Financial (bankruptcies, recessions, credit crises): Response within 8 hours.
    Typical impact: supplier insolvency, payment disruptions, credit line freezes.
    Mitigation: qualify backup suppliers, adjust payment terms, accelerate receivables.
  - Quality (recalls, defects, contamination): Response within 1 hour.
    Typical impact: production halts, product recalls, reputation damage, regulatory scrutiny.
    Mitigation: quarantine inventory, issue customer advisories, initiate root cause analysis.
  - Logistics (port closures, shipping delays, strikes): Response within 4 hours.
    Typical impact: delivery delays, container shortages, demurrage costs.
    Mitigation: reroute shipments, switch transport modes, expedite critical orders.
  - Cyber (ransomware, data breaches, IT outages): Response within 30 minutes.
    Typical impact: system downtime, data loss, supply chain visibility gaps.
    Mitigation: activate incident response, switch to manual processes, isolate affected systems.
  - Pandemic (disease outbreaks, quarantines, lockdowns): Response within 6 hours.
    Typical impact: workforce shortages, factory shutdowns, border closures.
    Mitigation: enable remote operations, diversify geographic sourcing, build strategic reserves.

Severity Scoring Matrix:
  1-2: Minimal — localized event, no supply chain disruption expected, monitor only.
  3-4: Low — minor delays possible, single supplier affected, existing buffers sufficient.
  5-6: Moderate — regional impact, multiple suppliers at risk, proactive mitigation needed.
  7-8: High — multi-region cascade, critical components threatened, executive awareness required.
  9-10: Critical — industry-wide disruption, revenue-at-risk exceeds thresholds, war room activation.

=== RESPONSE PROTOCOLS ===
Escalation Tiers:
  - Tier 1 (Severity 1-3): Automated monitoring, weekly digest to supply chain team.
  - Tier 2 (Severity 4-6): Active monitoring, daily status updates, mitigation plan required.
  - Tier 3 (Severity 7-8): War room activation, 4-hour update cadence, VP-level briefing.
  - Tier 4 (Severity 9-10): Executive escalation, continuous monitoring, board-level communication.

Communication Templates:
  - Supplier inquiry: Request status update, capacity impact, estimated recovery timeline.
  - Customer advisory: Potential delay notification, alternative fulfillment options.
  - Executive brief: Revenue impact summary, mitigation status, resource requirements.
  - Board update: Strategic risk assessment, portfolio exposure, long-term resilience plan.

=== COMPLIANCE & REGULATORY REQUIREMENTS ===
  - All mitigation actions must comply with applicable trade regulations and sanctions lists.
  - Supplier qualification changes require documented risk assessment and approval workflow.
  - Expedited shipping authorizations above $50,000 require finance director sign-off.
  - Any single-source component must have a documented dual-source qualification roadmap.
  - Revenue-at-risk calculations must use calibrated severity and duration models, not raw sums.
  - Audit trail required for all automated actions — log signal, classification, actions, approvals.

=== ENVIRONMENTAL, SOCIAL, AND GOVERNANCE (ESG) PROTOCOLS ===
  - Carbon footprint impact must be calculated for all air-freight expedited shipments.
  - Suppliers flagged for labor violations must trigger an immediate localized audit within 48 hours.
  - Any substitution of raw materials (e.g., cobalt, lithium) must preserve conflict-free traceability.
  - If a disruption affects a Tier-2 or Tier-3 supplier, we must guarantee they have local environmental clearance.
  - Temporary labor mobilized for recovery efforts must meet fair wage standards as per ILO conventions.
  - E-waste resulting from scrapped or quarantined inventory must be recycled via certified ISO 14001 partners.
  - Water usage in semiconductor fab contingencies must align with the drought-resistance charter of our local operations.
  - Any rerouting via maritime freight MUST prioritize carriers utilizing low-sulfur fuel or LNG to meet our 2030 net-zero targets.

=== LEGAL & CONTRACTUAL EXPOSURE LIMITS ===
  - Force Majeure clauses can only be invoked by suppliers if verified by an independent third party or government declaration.
  - Service Level Agreement (SLA) penalties for late customer deliveries are capped at 15% of the total PO value.
  - In cases of port strikes, demurrage and detention charges are to be split 50/50 with designated freight forwarders unless explicitly waived.
  - Intellectual Property (IP) protection remains paramount; unauthorized sub-contracting by suppliers during a crisis is grounds for immediate contract termination.
  - Indemnification for lost revenue cannot be demanded from Tier-2 suppliers unless direct negligence in disaster preparedness is proven.
  - All communication regarding delivery delays to publicly traded clients must be cleared by Corporate Comms to avoid SEC disclosure violations.
  - Airfreight capacity block agreements must not exceed a 6-month commitment window without CFO approval.

=== ADVANCED INVENTORY MANAGEMENT STRATEGIES ===
  - Safety stock algorithms must dynamically adjust standard deviations based on real-time geopolitical risk scores.
  - "Postponement" manufacturing should be engaged whenever regional bottlenecks arise, keeping products in semi-finished states.
  - Nearshoring fallback sites (e.g., Mexico, Eastern Europe) operate on a "warm standby" requiring 14 days to reach 50% capacity.
  - Scrappage rates exceeding 2% during a rapid supplier switch automatically pause the transition plan for a root-cause analysis.
  - Vendor Managed Inventory (VMI) hubs must maintain a strict FIFO (First-In, First-Out) rotation to prevent obsolescence during demand spikes.
  - Cross-docking facilities are mandated to process emergency components (Severity 8+) within a 2-hour window.
  - Dead stock resulting from cancelled orders must be liquidated within 90 days or written off against the disruption's overall financial impact.
  - Multi-echelon inventory optimization models will be re-run weekly during any sustained (30+ day) crisis.

=== CUSTOMS AND IMPORT EXPORT (TRADE COMPLIANCE) ===
  - Rerouted shipments must possess verified HS (Harmonized System) Codes to prevent border delays.
  - Goods manufactured in restricted zones are strictly forbidden from entering our supply chain, regardless of the severity of the shortage.
  - Letters of Credit (LC) for alternate suppliers must be expedited through our partner banks with a 24-hour turnaround SLA.
  - Tariffs incurred due to emergency rerouting (e.g., avoiding the Suez Canal by going around the Cape of Good Hope) must be logged as "Extraordinary Transportation Costs."
  - Origin tracing documentation (Certificates of Origin) must be verifiable via blockchain or secure digital ledger for all premium components.
  - Free Trade Agreement (FTA) utilization is optional during a Severity 9+ crisis if speed outweighs the duty savings.
  - Customs brokers must be given pre-arrival notification at least 48 hours prior to vessel docking.

=== INTERNAL SYSTEM CONFIGURATION & REDUNDANCY ===
  - Our primary ERP system operates with a dual-active failover in separate geographical zones to ensure 99.999% uptime.
  - The AI Control Tower syncs with the ERP every 15 minutes, but emergency overrides push data instantaneously.
  - Access to the War Room dashboard is restricted to Level 4+ personnel during a declared "Critical" event.
  - Multi-agent debate thresholds: If the Logistics Agent and Finance Agent diverge by more than 30 points in confidence, human-in-the-loop (HITL) is mandatory.
  - Hallucination Intercept: Any supplier name generated that does not exist in the Spanner graph is automatically blocked and flagged.
  - AI recommendations involving capital expenditure over $1M require a complete reasoning trace review by the VP of Supply Chain.
"""

# ── Cache Manager ────────────────────────────────────────────────────
_context_cache = {
    "cache_id": None,
    "expires_at": 0,
    "model": None,
}


def _get_cached_model():
    """
    Returns a GenerativeModel backed by a valid context cache.
    If no cache exists or it has expired, creates a new one.
    Falls back to a regular model if caching is unavailable.
    """
    if not USE_REAL_VERTEX:
        return None  # Simulator mode — no caching needed

    now = time.time()

    # Return existing cache if still valid
    if _context_cache["model"] and _context_cache["expires_at"] > now:
        logger.debug("♻️  Using existing context cache")
        return _context_cache["model"]

    try:
        from vertexai.generative_models import GenerativeModel
        from vertexai.preview import caching as context_caching
        from config import GCP_PROJECT_ID, GCP_REGION, GEMINI_MODEL
        import vertexai
        import datetime

        vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)

        # Create a new cache with 1-hour TTL
        cache_ttl = datetime.timedelta(hours=1)
        cached_content = context_caching.CachedContent.create(
            model_name=GEMINI_MODEL,
            contents=[WAR_ROOM_STATIC_CONTEXT],
            ttl=cache_ttl,
            display_name="war-room-static-context",
        )

        # Build a model that uses this cache
        cached_model = GenerativeModel.from_cached_content(cached_content)

        _context_cache["cache_id"] = cached_content.resource_name
        _context_cache["expires_at"] = now + 3500  # ~58 min, slightly before actual expiry
        _context_cache["model"] = cached_model

        logger.info(f"✅ Context cache created: {cached_content.resource_name}")
        return cached_model

    except Exception as e:
        logger.warning(f"⚠️  Context caching unavailable: {e} — using standard model")
        return None


def analyze_disruption(signal_text, risk_appetite="balanced"):
    """
    Full disruption analysis pipeline with reasoning trace.
    Returns structured result with trace, actions, confidence, and escalation status.
    """
    trace = []
    start_time = time.time()

    # Check for a valid context cache (reduces latency for agent calls)
    cached_model = _get_cached_model()

    # ── Step 1: Signal Classification & Ingestion ────────────────────
    step_start = time.time()

    # Use the high-speed Flash classifier first for rapid triage
    flash_classification = high_speed_classifier.classify(signal_text)

    # Still run full ingestion for graph linking
    ingestion_result = ingest_signal(signal_text, signal_type="disruption")
    classification = ingestion_result["classification"]

    # Merge Flash classifier's richer output into the classification
    classification["reasoning"] = flash_classification.get("reasoning", "")
    classification["classifier_used"] = flash_classification.get("classifier", "keyword-fallback")
    if flash_classification.get("category") != "general":
        classification["category"] = flash_classification["category"]
    if flash_classification.get("severity", 5) > classification.get("severity", 5):
        classification["severity"] = flash_classification["severity"]

    affected_suppliers = ingestion_result["affected_suppliers"]

    # Sanitize supplier data (remove embeddings)
    safe_suppliers = []
    for sup in affected_suppliers:
        if sup:
            safe = {k: v for k, v in sup.items() if k != "embedding"}
            safe_suppliers.append(safe)

    trace.append({
        "step": 1,
        "title": "Signal Detected & Classified",
        "description": f"Category: {classification['category'].title()} | Severity: {classification['severity']}/10"
                       f" | Affected Suppliers: {len(safe_suppliers)}"
                       f" | Classifier: {classification.get('classifier_used', 'keyword')}",
        "source": classification.get("source_label", f"Signal: {signal_text[:60]}"),
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete",
        "icon": "radio",
    })

    # ── Step 2: Blast Radius Traversal ───────────────────────────────
    step_start = time.time()
    # BUG FIX: Use list() to avoid modifying the safe_suppliers reference
    blast_radius = {"affected_nodes": list(safe_suppliers), "affected_edges": [], "total_affected": len(safe_suppliers)}

    for sup in affected_suppliers:
        if sup:
            radius = graph_db.traverse_blast_radius(sup["id"])
            # Merge results (deduplicate)
            existing_ids = {n.get("id") for n in blast_radius["affected_nodes"]}
            for node in radius["affected_nodes"]:
                safe_node = {k: v for k, v in node.items() if k != "embedding"}
                if safe_node.get("id") not in existing_ids:
                    blast_radius["affected_nodes"].append(safe_node)
                    existing_ids.add(safe_node.get("id"))
            blast_radius["affected_edges"].extend(radius["affected_edges"])
            blast_radius["total_affected"] = len(blast_radius["affected_nodes"])

    # Recalculate health scores for affected suppliers
    for sup in safe_suppliers:
        health = calculate_health_score(sup["id"])
        if health:
            sup["health_score"] = health["health_score"]
            sup["risk_level"] = health["risk_level"]

    affected_products = [n for n in blast_radius["affected_nodes"] if n.get("type") == "Product"]
    affected_components = [n for n in blast_radius["affected_nodes"] if n.get("type") == "Component"]
    
    # ── Revenue-at-Risk Calculation (calibrated) ─────────────────────
    # Instead of naively summing 100% of all affected product revenues,
    # we estimate a realistic exposure using three scaling factors:
    #
    #   1. Severity factor:    severity / 10  (a severity-3 event ≠ losing all revenue)
    #   2. Duration fraction:  estimated weeks of disruption / 52 weeks in a year
    #   3. BOM concentration:  what % of the product's components are actually affected
    #
    severity = classification.get("severity", 5)
    severity_factor = severity / 10.0  # 0.1 – 1.0

    # Map severity to estimated disruption duration in weeks
    # 1-3: ~1 week, 4-6: ~3 weeks, 7-8: ~6 weeks, 9-10: ~12 weeks
    duration_weeks = {1: 0.5, 2: 1, 3: 1.5, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 10, 10: 12}.get(severity, 3)
    duration_fraction = duration_weeks / 52.0

    # For each product, calculate what fraction of its BOM is disrupted
    affected_component_ids = {c.get("id") for c in affected_components}
    total_revenue_at_risk = 0
    for prod in affected_products:
        # Count total components in this product's BOM
        prod_component_edges = graph_db.get_edges(edge_type="USED_IN")
        prod_bom_size = sum(1 for e in prod_component_edges if e["target_id"] == prod["id"])
        # Count how many of those are affected
        affected_in_bom = sum(1 for e in prod_component_edges
                              if e["target_id"] == prod["id"] and e["source_id"] in affected_component_ids)
        bom_fraction = (affected_in_bom / max(prod_bom_size, 1))

        product_exposure = prod.get("annual_revenue", 0) * severity_factor * duration_fraction * bom_fraction
        total_revenue_at_risk += product_exposure

    total_revenue_at_risk = round(total_revenue_at_risk)

    # Also keep the raw total for context (but don't use it for escalation)
    total_annual_revenue = total_revenue_at_risk

    trace.append({
        "step": 2,
        "title": "Graph Context — Blast Radius Mapped",
        "description": f"Impact: {len(safe_suppliers)} supplier(s), {len(affected_components)} component(s), "
                       f"{len(affected_products)} product(s) at risk",
        "source": "GQL Blast Radius Traversal — Spanner Graph",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete",
        "icon": "git-branch",
    })

    # ── Step 3: Memory Retrieval ─────────────────────────────────────
    step_start = time.time()
    relevant_lessons = retrieve_relevant_lessons(signal_text, top_k=3)
    lessons_context = format_lessons_for_context(relevant_lessons)
    lesson_docs = [l["document"] for l in relevant_lessons]

    # ── Simulated Live ERP Data ──────────────────────────────────────
    erp_inventory_status = []
    for comp in affected_components:
        stock_days = comp.get("stock_days", random.randint(5, 45))
        erp_inventory_status.append({
            "component_id": comp.get("id"),
            "name": comp.get("name"),
            "current_stock_days": stock_days,
            "safety_stock_threshold_days": 21,
            "status": "CRITICAL" if stock_days < 14 else "WARNING" if stock_days < 28 else "HEALTHY",
        })

    # Get dynamic agent adjustments from past negative feedback
    reflection = reflect_on_outcomes()
    agent_adjustments = reflection.get("adjustments", [])
    if agent_adjustments:
        trace.append({
            "step": 3.5,
            "title": "Agent Prompt Calibration",
            "description": f"Applied {len(agent_adjustments)} learned adjustment(s) from past negative feedback.",
            "source": "Memory Reflection Engine",
            "duration_ms": 0,
            "status": "complete",
            "icon": "zap",
        })

    trace.append({
        "step": 3,
        "title": "Past Memory Retrieved",
        "description": f"{len(relevant_lessons)} relevant lesson(s) found."
                       + (f" Top match: Lesson #{relevant_lessons[0]['document']['id']} "
                          f"({relevant_lessons[0]['similarity']:.0%} relevance)"
                          if relevant_lessons else " No prior lessons available."),
        "source": f"Firestore Memory — Similarity Search ({len(relevant_lessons)} matches)" if relevant_lessons
                  else "Firestore Memory — No matches",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete",
        "icon": "brain",
    })

    # ── Step 4: Multi-Agent Debate ───────────────────────────────────
    step_start = time.time()
    debate_context = {
        "signal": signal_text,
        "classification": classification,
        "affected_suppliers": safe_suppliers,
        "blast_radius": blast_radius,
        "total_annual_revenue": total_annual_revenue,
        "calibrated_revenue_at_risk": total_revenue_at_risk,
        "erp_inventory_status": erp_inventory_status,
        "risk_appetite": risk_appetite,
        "past_lessons": lesson_docs,
        "agent_adjustments": agent_adjustments,
    }

    with concurrent.futures.ThreadPoolExecutor() as executor:
        logistics_future = executor.submit(logistics_agent.analyze, debate_context)
        finance_future = executor.submit(finance_agent.analyze, debate_context)
        
        logistics_analysis = logistics_future.result()
        finance_analysis = finance_future.result()

    trace.append({
        "step": 4,
        "title": "Multi-Agent Debate Complete",
        "description": f"Logistics Agent: {logistics_analysis.get('priority', 'HIGH')} priority | "
                       f"Finance Agent: Revenue-at-Risk ${finance_analysis.get('revenue_at_risk', 0):,}",
        "source": f"{'Cached ' if cached_model else ''}Gemini — Dual Persona Debate (Risk Appetite: {risk_appetite.title()})",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete",
        "icon": "swords",
    })

    # ── Step 5: Synthesis & Strategy ─────────────────────────────────
    step_start = time.time()
    settings = graph_db.company_settings
    revenue_threshold = settings.get("revenue_at_risk_threshold", 500000)

    synthesis = vertex_ai.generate_response(
        prompt="Synthesize mitigation strategy",
        persona="synthesis",
        context={
            "logistics_analysis": logistics_analysis,
            "finance_analysis": finance_analysis,
            "risk_appetite": risk_appetite,
            "past_lessons": lesson_docs,
            "revenue_threshold": revenue_threshold,
        }
    )

    confidence_score = synthesis.get("confidence_score", 70)
    # Use the deterministic calibrated revenue — do NOT trust the AI's number
    revenue_at_risk = total_revenue_at_risk
    requires_manual_review = confidence_score < CONFIDENCE_THRESHOLD
    executive_escalation = revenue_at_risk > revenue_threshold

    # Generate emails for affected suppliers in parallel
    actions = synthesis.get("mitigation_actions", [])
    
    def _generate_email_for_supplier(sup):
        return vertex_ai.generate_response(
            prompt="Generate supplier email",
            persona="email_generator",
            context={
                "supplier_name": sup.get("name", "Supplier"),
                "company_name": "NexGen Electronics",
                "disruption": signal_text,
            }
        ), sup.get("name", "Supplier")

    with concurrent.futures.ThreadPoolExecutor() as executor:
        email_futures = [executor.submit(_generate_email_for_supplier, sup) for sup in safe_suppliers[:2]]
        
        for future in email_futures:
            try:
                email_body, sup_name = future.result()
                # Attach email to the supplier_email action
                for act in actions:
                    if act["type"] == "supplier_email" and "email" not in act:
                        act["email"] = email_body
                        act["target_supplier"] = sup_name
                        break
            except Exception as e:
                logger.error(f"Failed to generate parallel email: {e}")

    # Executive escalation action
    if executive_escalation:
        actions.append({
            "id": "act-esc",
            "type": "executive_escalation",
            "title": "⚠️ Executive Escalation Alert",
            "description": f"Revenue-at-Risk (${revenue_at_risk:,}) exceeds company threshold "
                           f"(${revenue_threshold:,}). Immediate executive review required.",
            "priority": "CRITICAL",
            "timeline": "Immediate",
        })

    trace.append({
        "step": 5,
        "title": "Final Strategy Synthesized",
        "description": f"\"{synthesis.get('strategy_name', 'Mitigation Plan')}\" — "
                       f"Confidence: {confidence_score}% | "
                       f"{len(actions)} action(s) generated"
                       + (" | ⚠️ EXECUTIVE ESCALATION" if executive_escalation else "")
                       + (" | 🔶 Manual Review Required" if requires_manual_review else ""),
        "source": "Gemini 1.5 Pro — Synthesis Engine",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete",
        "icon": "shield-check",
    })

    # ── Step 6: Guardrails & Fact-Check ──────────────────────────────
    step_start = time.time()
    strategy_data = {
        "revenue_at_risk": revenue_at_risk,
        "confidence_score": confidence_score,
        "past_lessons_used": len(relevant_lessons),
    }
    guardrails_report = fact_checker.validate_strategy(
        strategy_data, actions, {"logistics": logistics_analysis, "finance": finance_analysis}
    )

    # Update HITL requirements
    hitl_required = guardrails_report.get("hitl_required", False)
    if hitl_required:
        requires_manual_review = True

    trace.append({
        "step": 6,
        "title": "Guardrails & Fact-Check",
        "description": f"Trust Score: {guardrails_report['trust_score']}% | "
                       f"{guardrails_report['passed_checks']}/{guardrails_report['total_checks']} checks passed"
                       + (" | ⚠️ HITL OVERRIDE REQUIRED" if hitl_required else ""),
        "source": "Deterministic Fact-Checker — Spanner Graph Validation",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete",
        "icon": "shield-check",
    })

    # Store as lesson for future reference
    strategy_id = f"strat-{int(time.time())}"
    store_lesson(
        strategy_id=strategy_id,
        strategy_summary=synthesis.get("summary", ""),
        context=signal_text,
    )

    total_duration = round((time.time() - start_time) * 1000)

    return {
        "strategy_id": strategy_id,
        "signal": signal_text,
        "classification": classification,
        "affected_suppliers": safe_suppliers,
        "blast_radius": {
            "total_affected": blast_radius["total_affected"],
            "products_at_risk": len(affected_products),
            "components_at_risk": len(affected_components),
            "affected_products": affected_products,
            "affected_components": affected_components,
        },
        "debate": {
            "logistics": logistics_analysis,
            "finance": finance_analysis,
        },
        "strategy": {
            "name": synthesis.get("strategy_name", "Mitigation Plan"),
            "summary": synthesis.get("summary", ""),
            "confidence_score": confidence_score,
            "requires_manual_review": requires_manual_review,
            "revenue_at_risk": revenue_at_risk,
            "executive_escalation": executive_escalation,
            "hitl_required": hitl_required,
            "hitl_reason": guardrails_report.get("hitl_reason"),
        },
        "guardrails": guardrails_report,
        "actions": actions,
        "reasoning_trace": trace,
        "total_duration_ms": total_duration,
        "past_lessons_used": len(relevant_lessons),
    }


# ══════════════════════════════════════════════════════════════════════
# STREAMING PIPELINE — yields step-by-step JSON for SSE
# ══════════════════════════════════════════════════════════════════════

def analyze_disruption_streaming(signal_text, risk_appetite="balanced"):
    """
    Generator version of analyze_disruption that yields JSON-serialisable
    dicts for each pipeline step, then yields the final result.
    Each intermediate yield has {"event": "step", ...}.
    The final yield has {"event": "result", ...}.
    """
    trace = []
    start_time = time.time()

    cached_model = _get_cached_model()

    # ── Step 1: Signal Classification ────────────────────────────────
    yield {"event": "step", "step": 1, "total": 6, "title": "Signal Classification",
           "status": "running", "description": "Analyzing signal category and severity..."}

    step_start = time.time()
    flash_classification = high_speed_classifier.classify(signal_text)
    ingestion_result = ingest_signal(signal_text, signal_type="disruption")
    classification = ingestion_result["classification"]
    classification["reasoning"] = flash_classification.get("reasoning", "")
    classification["classifier_used"] = flash_classification.get("classifier", "keyword-fallback")
    if flash_classification.get("category") != "general":
        classification["category"] = flash_classification["category"]
    if flash_classification.get("severity", 5) > classification.get("severity", 5):
        classification["severity"] = flash_classification["severity"]

    affected_suppliers = ingestion_result["affected_suppliers"]
    safe_suppliers = [{k: v for k, v in sup.items() if k != "embedding"} for sup in affected_suppliers if sup]

    trace.append({
        "step": 1, "title": "Signal Detected & Classified",
        "description": f"Category: {classification['category'].title()} | Severity: {classification['severity']}/10"
                       f" | Affected Suppliers: {len(safe_suppliers)}"
                       f" | Classifier: {classification.get('classifier_used', 'keyword')}",
        "source": classification.get("source_label", f"Signal: {signal_text[:60]}"),
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete", "icon": "radio",
    })

    yield {"event": "step", "step": 1, "total": 6, "title": "Signal Classification",
           "status": "complete",
           "description": f"Category: {classification['category'].title()} — Severity: {classification['severity']}/10 — {len(safe_suppliers)} supplier(s) matched"}

    # ── Step 2: Blast Radius ─────────────────────────────────────────
    yield {"event": "step", "step": 2, "total": 6, "title": "Blast Radius Traversal",
           "status": "running", "description": "Querying Spanner Graph for downstream impact..."}

    step_start = time.time()
    blast_radius = {"affected_nodes": list(safe_suppliers), "affected_edges": [], "total_affected": len(safe_suppliers)}
    for sup in affected_suppliers:
        if sup:
            radius = graph_db.traverse_blast_radius(sup["id"])
            existing_ids = {n.get("id") for n in blast_radius["affected_nodes"]}
            for node in radius["affected_nodes"]:
                safe_node = {k: v for k, v in node.items() if k != "embedding"}
                if safe_node.get("id") not in existing_ids:
                    blast_radius["affected_nodes"].append(safe_node)
                    existing_ids.add(safe_node.get("id"))
            blast_radius["affected_edges"].extend(radius["affected_edges"])
            blast_radius["total_affected"] = len(blast_radius["affected_nodes"])

    for sup in safe_suppliers:
        health = calculate_health_score(sup["id"])
        if health:
            sup["health_score"] = health["health_score"]
            sup["risk_level"] = health["risk_level"]

    affected_products = [n for n in blast_radius["affected_nodes"] if n.get("type") == "Product"]
    affected_components = [n for n in blast_radius["affected_nodes"] if n.get("type") == "Component"]

    severity = classification.get("severity", 5)
    severity_factor = severity / 10.0
    duration_weeks = {1: 0.5, 2: 1, 3: 1.5, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 10, 10: 12}.get(severity, 3)
    duration_fraction = duration_weeks / 52.0
    affected_component_ids = {c.get("id") for c in affected_components}
    total_revenue_at_risk = 0
    for prod in affected_products:
        prod_component_edges = graph_db.get_edges(edge_type="USED_IN")
        prod_bom_size = sum(1 for e in prod_component_edges if e["target_id"] == prod["id"])
        affected_in_bom = sum(1 for e in prod_component_edges
                              if e["target_id"] == prod["id"] and e["source_id"] in affected_component_ids)
        bom_fraction = (affected_in_bom / max(prod_bom_size, 1))
        product_exposure = prod.get("annual_revenue", 0) * severity_factor * duration_fraction * bom_fraction
        total_revenue_at_risk += product_exposure
    total_revenue_at_risk = round(total_revenue_at_risk)
    total_annual_revenue = total_revenue_at_risk

    trace.append({
        "step": 2, "title": "Graph Context — Blast Radius Mapped",
        "description": f"Impact: {len(safe_suppliers)} supplier(s), {len(affected_components)} component(s), {len(affected_products)} product(s) at risk",
        "source": "GQL Blast Radius Traversal — Spanner Graph",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete", "icon": "git-branch",
    })

    yield {"event": "step", "step": 2, "total": 6, "title": "Blast Radius Traversal",
           "status": "complete",
           "description": f"{len(safe_suppliers)} supplier(s), {len(affected_components)} component(s), {len(affected_products)} product(s) at risk — Revenue exposure: ${total_revenue_at_risk:,}"}

    # ── Step 3: Memory Retrieval ─────────────────────────────────────
    yield {"event": "step", "step": 3, "total": 6, "title": "Memory Retrieval",
           "status": "running", "description": "Searching Firestore for similar historical disruptions..."}

    step_start = time.time()
    relevant_lessons = retrieve_relevant_lessons(signal_text, top_k=3)
    lessons_context = format_lessons_for_context(relevant_lessons)
    lesson_docs = [l["document"] for l in relevant_lessons]

    memory_desc = f"{len(relevant_lessons)} relevant lesson(s) found"
    if relevant_lessons:
        memory_desc += f" — Top match: Lesson #{relevant_lessons[0]['document']['id']} ({relevant_lessons[0]['similarity']:.0%} relevance)"

    # ── Simulated Live ERP Data ──────────────────────────────────────
    erp_inventory_status = []
    for comp in affected_components:
        stock_days = comp.get("stock_days", random.randint(5, 45))
        erp_inventory_status.append({
            "component_id": comp.get("id"),
            "name": comp.get("name"),
            "current_stock_days": stock_days,
            "safety_stock_threshold_days": 21,
            "status": "CRITICAL" if stock_days < 14 else "WARNING" if stock_days < 28 else "HEALTHY",
        })

    # Get dynamic agent adjustments from past negative feedback
    reflection = reflect_on_outcomes()
    agent_adjustments = reflection.get("adjustments", [])
    if agent_adjustments:
        trace.append({
            "step": 3.5, "title": "Agent Prompt Calibration",
            "description": f"Applied {len(agent_adjustments)} learned adjustment(s) from past negative feedback.",
            "source": "Memory Reflection Engine",
            "duration_ms": 0, "status": "complete", "icon": "zap",
        })

    trace.append({
        "step": 3, "title": "Past Memory Retrieved",
        "description": memory_desc,
        "source": f"Firestore Memory — Similarity Search ({len(relevant_lessons)} matches)",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete", "icon": "brain",
    })

    yield {"event": "step", "step": 3, "total": 6, "title": "Memory Retrieval",
           "status": "complete", "description": memory_desc}

    # ── Step 4: Multi-Agent Debate ───────────────────────────────────
    yield {"event": "step", "step": 4, "total": 6, "title": "Multi-Agent Debate",
           "status": "running", "description": f"Logistics Agent vs Finance Agent debating (appetite: {risk_appetite.title()})..."}

    step_start = time.time()
    debate_context = {
        "signal": signal_text, "classification": classification,
        "affected_suppliers": safe_suppliers, "blast_radius": blast_radius,
        "total_annual_revenue": total_annual_revenue, "calibrated_revenue_at_risk": total_revenue_at_risk,
        "erp_inventory_status": erp_inventory_status,
        "risk_appetite": risk_appetite, "past_lessons": lesson_docs,
        "agent_adjustments": agent_adjustments,
    }
    with concurrent.futures.ThreadPoolExecutor() as executor:
        logistics_future = executor.submit(logistics_agent.analyze, debate_context)
        finance_future = executor.submit(finance_agent.analyze, debate_context)
        logistics_analysis = logistics_future.result()
        finance_analysis = finance_future.result()

    trace.append({
        "step": 4, "title": "Multi-Agent Debate Complete",
        "description": f"Logistics Agent: {logistics_analysis.get('priority', 'HIGH')} priority | Finance Agent: Revenue-at-Risk ${finance_analysis.get('revenue_at_risk', 0):,}",
        "source": f"{'Cached ' if cached_model else ''}Gemini — Dual Persona Debate (Risk Appetite: {risk_appetite.title()})",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete", "icon": "swords",
    })

    yield {"event": "step", "step": 4, "total": 6, "title": "Multi-Agent Debate",
           "status": "complete",
           "description": f"Debate resolved — Logistics: {logistics_analysis.get('priority', 'HIGH')} | Finance: ${finance_analysis.get('revenue_at_risk', 0):,} at risk"}

    # ── Step 5: Synthesis & Strategy ─────────────────────────────────
    yield {"event": "step", "step": 5, "total": 6, "title": "Strategy Synthesis",
           "status": "running", "description": "Generating mitigation paths and supplier outreach drafts..."}

    step_start = time.time()
    settings = graph_db.company_settings
    revenue_threshold = settings.get("revenue_at_risk_threshold", 500000)

    synthesis = vertex_ai.generate_response(
        prompt="Synthesize mitigation strategy", persona="synthesis",
        context={
            "logistics_analysis": logistics_analysis, "finance_analysis": finance_analysis,
            "risk_appetite": risk_appetite, "past_lessons": lesson_docs,
            "revenue_threshold": revenue_threshold,
        }
    )

    confidence_score = synthesis.get("confidence_score", 70)
    revenue_at_risk = total_revenue_at_risk
    requires_manual_review = confidence_score < CONFIDENCE_THRESHOLD
    executive_escalation = revenue_at_risk > revenue_threshold

    actions = synthesis.get("mitigation_actions", [])

    def _generate_email_for_supplier(sup):
        return vertex_ai.generate_response(
            prompt="Generate supplier email", persona="email_generator",
            context={
                "supplier_name": sup.get("name", "Supplier"),
                "company_name": "NexGen Electronics",
                "disruption": signal_text,
            }
        ), sup.get("name", "Supplier")

    with concurrent.futures.ThreadPoolExecutor() as executor:
        email_futures = [executor.submit(_generate_email_for_supplier, sup) for sup in safe_suppliers[:2]]
        for future in email_futures:
            try:
                email_body, sup_name = future.result()
                for act in actions:
                    if act["type"] == "supplier_email" and "email" not in act:
                        act["email"] = email_body
                        act["target_supplier"] = sup_name
                        break
            except Exception as e:
                logger.error(f"Failed to generate parallel email: {e}")

    if executive_escalation:
        actions.append({
            "id": "act-esc", "type": "executive_escalation",
            "title": "⚠️ Executive Escalation Alert",
            "description": f"Revenue-at-Risk (${revenue_at_risk:,}) exceeds company threshold (${revenue_threshold:,}). Immediate executive review required.",
            "priority": "CRITICAL", "timeline": "Immediate",
        })

    trace.append({
        "step": 5, "title": "Final Strategy Synthesized",
        "description": f"\"{synthesis.get('strategy_name', 'Mitigation Plan')}\" — Confidence: {confidence_score}% | {len(actions)} action(s) generated"
                       + (" | ⚠️ EXECUTIVE ESCALATION" if executive_escalation else "")
                       + (" | 🔶 Manual Review Required" if requires_manual_review else ""),
        "source": "Gemini 1.5 Pro — Synthesis Engine",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete", "icon": "shield-check",
    })

    yield {"event": "step", "step": 5, "total": 6, "title": "Strategy Synthesis",
           "status": "complete",
           "description": f"\"{synthesis.get('strategy_name', 'Mitigation Plan')}\" — {confidence_score}% confidence, {len(actions)} actions"}

    # ── Step 6: Guardrails & Fact-Check ──────────────────────────────
    yield {"event": "step", "step": 6, "total": 6, "title": "Guardrails Validation",
           "status": "running", "description": "Running fact-checks and trust scoring..."}

    step_start = time.time()
    strategy_data = {
        "revenue_at_risk": revenue_at_risk,
        "confidence_score": confidence_score,
        "past_lessons_used": len(relevant_lessons),
    }
    guardrails_report = fact_checker.validate_strategy(
        strategy_data, actions, {"logistics": logistics_analysis, "finance": finance_analysis}
    )

    hitl_required = guardrails_report.get("hitl_required", False)
    if hitl_required:
        requires_manual_review = True

    trace.append({
        "step": 6, "title": "Guardrails & Fact-Check",
        "description": f"Trust Score: {guardrails_report['trust_score']}% | {guardrails_report['passed_checks']}/{guardrails_report['total_checks']} checks passed"
                       + (" | ⚠️ HITL OVERRIDE REQUIRED" if hitl_required else ""),
        "source": "Deterministic Fact-Checker — Spanner Graph Validation",
        "duration_ms": round((time.time() - step_start) * 1000),
        "status": "complete", "icon": "shield-check",
    })

    yield {"event": "step", "step": 6, "total": 6, "title": "Guardrails Validation",
           "status": "complete",
           "description": f"Trust Score: {guardrails_report['trust_score']}% — {guardrails_report['passed_checks']}/{guardrails_report['total_checks']} checks passed"}

    # Store lesson
    strategy_id = f"strat-{int(time.time())}"
    store_lesson(strategy_id=strategy_id, strategy_summary=synthesis.get("summary", ""), context=signal_text)

    total_duration = round((time.time() - start_time) * 1000)

    # ── Final Result ─────────────────────────────────────────────────
    yield {
        "event": "result",
        "data": {
            "strategy_id": strategy_id,
            "signal": signal_text,
            "classification": classification,
            "affected_suppliers": safe_suppliers,
            "blast_radius": {
                "total_affected": blast_radius["total_affected"],
                "products_at_risk": len(affected_products),
                "components_at_risk": len(affected_components),
                "affected_products": affected_products,
                "affected_components": affected_components,
            },
            "debate": {"logistics": logistics_analysis, "finance": finance_analysis},
            "strategy": {
                "name": synthesis.get("strategy_name", "Mitigation Plan"),
                "summary": synthesis.get("summary", ""),
                "confidence_score": confidence_score,
                "requires_manual_review": requires_manual_review,
                "revenue_at_risk": revenue_at_risk,
                "executive_escalation": executive_escalation,
                "hitl_required": hitl_required,
                "hitl_reason": guardrails_report.get("hitl_reason"),
            },
            "guardrails": guardrails_report,
            "actions": actions,
            "reasoning_trace": trace,
            "total_duration_ms": total_duration,
            "past_lessons_used": len(relevant_lessons),
        }
    }
