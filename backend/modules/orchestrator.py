"""
Risk Orchestrator — Central controller for the disruption analysis pipeline.
Manages: signal classification → blast radius → memory retrieval → multi-agent debate →
synthesis → action generation → executive escalation → reasoning trace with source citations.
"""

import time
from modules.ingestion import ingest_signal
from modules.agents import logistics_agent, finance_agent
from modules.memory import retrieve_relevant_lessons, format_lessons_for_context, store_lesson
from modules.health_scoring import calculate_health_score
from modules.guardrails import fact_checker, HITL_REVENUE_THRESHOLD
from services.vertex_simulator import vertex_ai
from services.spanner_simulator import graph_db
from config import CONFIDENCE_THRESHOLD


def analyze_disruption(signal_text, risk_appetite="balanced"):
    """
    Full disruption analysis pipeline with reasoning trace.
    Returns structured result with trace, actions, confidence, and escalation status.
    """
    trace = []
    start_time = time.time()

    # ── Step 1: Signal Classification & Ingestion ────────────────────
    step_start = time.time()
    ingestion_result = ingest_signal(signal_text, signal_type="disruption")
    classification = ingestion_result["classification"]
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
                       f" | Affected Suppliers: {len(safe_suppliers)}",
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
        "source": f"Gemini 1.5 Pro — Dual Persona Debate (Risk Appetite: {risk_appetite.title()})",
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
