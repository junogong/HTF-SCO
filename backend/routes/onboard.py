"""POST /api/onboard — Add a Company or Supplier to the graph."""

from flask import Blueprint, request, jsonify
from services.spanner_simulator import graph_db
from services.vertex_simulator import vertex_ai

onboard_bp = Blueprint("onboard", __name__)


@onboard_bp.route("/api/onboard", methods=["POST"])
def onboard_entity():
    data = request.get_json()
    entity_type = data.get("type", "Supplier")
    name = data.get("name", "")
    properties = data.get("properties", {})

    if not name:
        return jsonify({"error": "Name is required"}), 400

    if entity_type not in ("Company", "Supplier"):
        return jsonify({"error": "Type must be 'Company' or 'Supplier'"}), 400

    # Build properties
    props = {
        "name": name,
        **properties,
    }

    # Generate embedding
    embed_text = f"{name} {properties.get('country', '')} {properties.get('category', '')} {' '.join(properties.get('capabilities', []))}"
    props["embedding"] = vertex_ai.generate_embedding(embed_text)

    # Default metrics for suppliers
    if entity_type == "Supplier" and "metrics" not in props:
        props["metrics"] = {
            "on_time_delivery": 85,
            "quality_score": 85,
            "financial_stability": 75,
        }
        props["health_score"] = 80
        props["prev_health_score"] = 80

    # Store risk settings
    if data.get("risk_threshold"):
        graph_db.company_settings["revenue_at_risk_threshold"] = data["risk_threshold"]
    if data.get("sla_penalties"):
        props["sla_penalty_per_day"] = data["sla_penalties"]

    node_id = graph_db.add_node(entity_type, properties=props)

    # If supplier, link to company
    if entity_type == "Supplier":
        companies = graph_db.get_all_nodes("Company")
        if companies:
            graph_db.add_edge("Company", companies[0]["id"], "Supplier", node_id, "CONTRACTS_WITH")

    return jsonify({
        "success": True,
        "id": node_id,
        "type": entity_type,
        "name": name,
    })
