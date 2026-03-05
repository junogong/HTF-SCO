"""GET /api/safety — Responsible AI safety report endpoint."""

from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, current_app
from modules.guardrails import get_safety_report

safety_bp = Blueprint("safety", __name__)

# Store the last disruption result for safety introspection
_last_analysis = {}


def update_last_analysis(result):
    """Called by the disruption route to keep safety context fresh."""
    _last_analysis.update(result)


@safety_bp.route("/safety", methods=["GET"])
def safety_report():
    """
    Returns the full Responsible AI safety report:
    - Guardrail check results
    - Hallucination detection log
    - Agent bias/divergence analysis
    - Graph knowledge base stats
    - Reasoning trace pipeline
    """
    try:
        strategy = _last_analysis.get("strategy", {})
        debate = _last_analysis.get("debate", {})
        actions = _last_analysis.get("actions", [])

        # Pass actions into strategy dict for guardrail checks
        full_strategy = {**strategy, "actions": actions}

        report = get_safety_report(
            last_strategy=full_strategy if strategy else None,
            last_debate=debate if debate else None,
        )

        # Build reasoning trace — the AI decision pipeline
        has_analysis = bool(strategy)
        classification = _last_analysis.get("classification", {})
        report["reasoning_trace"] = [
            {
                "step": 1,
                "name": "Signal Classification",
                "status": "completed" if has_analysis else "idle",
                "detail": f"Classified as {classification.get('category', 'N/A').upper()} — "
                          f"Severity {classification.get('severity', 'N/A')}/10 — "
                          f"Region: {classification.get('region', 'N/A')}"
                          if has_analysis else "No signal analyzed yet.",
            },
            {
                "step": 2,
                "name": "Graph Traversal (Blast Radius)",
                "status": "completed" if has_analysis else "idle",
                "detail": f"Identified {len(_last_analysis.get('affected_suppliers', []))} "
                          f"affected Tier-1 suppliers via Spanner Graph path walk."
                          if has_analysis else "Awaiting signal input.",
            },
            {
                "step": 3,
                "name": "Multi-Agent Debate",
                "status": "completed" if debate else "idle",
                "detail": f"Logistics: {debate.get('logistics', {}).get('priority', 'N/A')} | "
                          f"Finance: {debate.get('finance', {}).get('priority', 'N/A')} — "
                          f"Divergence: {report.get('bias_analysis', {}).get('divergence_score', 0)}/75"
                          if debate else "No debate data.",
            },
            {
                "step": 4,
                "name": "Strategy Synthesis",
                "status": "completed" if has_analysis else "idle",
                "detail": f"Generated response strategy with R@R = "
                          f"${strategy.get('revenue_at_risk', 0):,} — "
                          f"Confidence = {strategy.get('confidence_score', 0)}%"
                          if has_analysis else "Awaiting debate output.",
            },
            {
                "step": 5,
                "name": "Guardrails & Fact-Check",
                "status": "completed",
                "detail": f"Trust Score: {report['guardrails']['trust_score']}% — "
                          f"{report['guardrails']['passed_checks']}/{report['guardrails']['total_checks']} checks passed. "
                          f"HITL: {'TRIGGERED' if report['guardrails']['hitl_required'] else 'Not required'}.",
            },
            {
                "step": 6,
                "name": "Hallucination Scan",
                "status": "completed",
                "detail": f"Scanned strategy text — "
                          f"{report['hallucination_report']['hallucination_count']} hallucination(s) detected."
                          if report.get("hallucination_report") else "No text to scan.",
            },
        ]

        return jsonify(report), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

