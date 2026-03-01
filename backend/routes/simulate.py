"""POST /api/simulate/stress-test — Digital Wind Tunnel endpoint."""

from flask import Blueprint, jsonify, request
from modules.stress_test_engine import run_stress_test

simulate_bp = Blueprint("simulate", __name__)


@simulate_bp.route("/simulate/stress-test", methods=["POST"])
def stress_test():
    """
    Run the Monte Carlo stress test engine.
    Generates 5 black-swan scenarios, runs each through the tiered blast radius,
    and returns ranked critical failure points + preemptive recommendations.
    """
    try:
        result = run_stress_test()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
