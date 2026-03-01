"""GET /api/graph — Return full graph for visualization."""

from flask import Blueprint, jsonify
from services.spanner_simulator import graph_db

graph_bp = Blueprint("graph", __name__)


@graph_bp.route("/api/graph", methods=["GET"])
def get_graph():
    return jsonify(graph_db.to_graph_json())
