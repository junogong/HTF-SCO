"""GET /api/safety — Responsible AI safety report endpoint."""

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
        return jsonify(report), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
