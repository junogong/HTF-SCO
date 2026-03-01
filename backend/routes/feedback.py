"""POST /api/feedback — Store user feedback + actual outcome in Firestore."""

from flask import Blueprint, request, jsonify
from modules.memory import store_feedback, reflect_on_outcomes

feedback_bp = Blueprint("feedback", __name__)


@feedback_bp.route("/api/feedback", methods=["POST"])
def submit_feedback():
    data = request.get_json()
    strategy_id = data.get("strategy_id", "")
    rating = data.get("rating")
    comment = data.get("comment")
    actual_outcome = data.get("actual_outcome")

    if not strategy_id or rating is None:
        return jsonify({"error": "strategy_id and rating are required"}), 400

    if not (1 <= rating <= 5):
        return jsonify({"error": "Rating must be between 1 and 5"}), 400

    doc_id = store_feedback(strategy_id, rating, comment, actual_outcome)

    # Run reflection after each feedback
    reflection = reflect_on_outcomes()

    return jsonify({
        "success": True,
        "feedback_id": doc_id,
        "reflection": reflection,
    })
