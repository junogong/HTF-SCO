"""POST /api/disruption — Trigger full disruption analysis pipeline."""

from flask import Blueprint, request, jsonify
from modules.orchestrator import analyze_disruption
from routes.safety import update_last_analysis

disruption_bp = Blueprint("disruption", __name__)


@disruption_bp.route("/api/disruption", methods=["POST"])
def trigger_disruption():
    data = request.get_json()
    signal = data.get("signal", "")
    risk_appetite = data.get("risk_appetite", "balanced")

    if not signal:
        return jsonify({"error": "Signal text is required"}), 400

    result = analyze_disruption(signal, risk_appetite=risk_appetite)
    update_last_analysis(result)   # Feed safety monitor
    return jsonify(result)
