"""GET /api/suppliers — Return supplier list with health scores."""

from flask import Blueprint, jsonify
from modules.health_scoring import calculate_all_health_scores

suppliers_bp = Blueprint("suppliers", __name__)


@suppliers_bp.route("/api/suppliers", methods=["GET"])
def get_suppliers():
    scores = calculate_all_health_scores()
    return jsonify({"suppliers": scores})
