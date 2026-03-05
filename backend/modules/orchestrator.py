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
from modules.ingestion import ingest_signal
from modules.agents import logistics_agent, finance_agent
from modules.memory import retrieve_relevant_lessons, format_lessons_for_context, store_lesson
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
  - Component:    {id, name, category, critical(bool), unit_cost}
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
    
    # Pre-calculate deterministic revenue to ground the AI agents
    total_annual_revenue = sum(p.get("annual_revenue", 0) for p in affected_products)

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
        "risk_appetite": risk_appetite,
        "past_lessons": lesson_docs,
    }

    logistics_analysis = logistics_agent.analyze(debate_context)
    finance_analysis = finance_agent.analyze(debate_context)

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
    revenue_at_risk = synthesis.get("revenue_at_risk", finance_analysis.get("revenue_at_risk", 0))
    requires_manual_review = confidence_score < CONFIDENCE_THRESHOLD
    executive_escalation = revenue_at_risk > revenue_threshold

    # Generate emails for affected suppliers
    actions = synthesis.get("mitigation_actions", [])
    for sup in safe_suppliers[:2]:
        email = vertex_ai.generate_response(
            prompt="Generate supplier email",
            persona="email_generator",
            context={
                "supplier_name": sup.get("name", "Supplier"),
                "company_name": "NexGen Electronics",
                "disruption": signal_text,
            }
        )
        # Attach email to the supplier_email action
        for act in actions:
            if act["type"] == "supplier_email" and "email" not in act:
                act["email"] = email
                act["target_supplier"] = sup.get("name", "Supplier")
                break

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
