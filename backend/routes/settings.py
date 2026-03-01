"""GET/PUT /api/settings — Company risk appetite and thresholds."""

from flask import Blueprint, request, jsonify
from services.spanner_simulator import graph_db

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(graph_db.company_settings)


@settings_bp.route("/api/settings", methods=["PUT"])
def update_settings():
    data = request.get_json()
    if "risk_appetite" in data:
        graph_db.company_settings["risk_appetite"] = data["risk_appetite"]
    if "revenue_at_risk_threshold" in data:
        graph_db.company_settings["revenue_at_risk_threshold"] = data["revenue_at_risk_threshold"]
    if "sla_penalty_per_day" in data:
        graph_db.company_settings["sla_penalty_per_day"] = data["sla_penalty_per_day"]

    return jsonify({"success": True, "settings": graph_db.company_settings})
