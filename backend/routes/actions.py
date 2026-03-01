"""POST /api/action/approve — Approve or reject a suggested action."""

from flask import Blueprint, request, jsonify
from services.firestore_simulator import firestore_db

actions_bp = Blueprint("actions", __name__)

# In-memory action store (in production, this would be in Spanner or Firestore)
action_store = {}


@actions_bp.route("/api/action/approve", methods=["POST"])
def approve_action():
    data = request.get_json()
    action_id = data.get("action_id", "")
    approved = data.get("approved", True)

    if not action_id:
        return jsonify({"error": "action_id is required"}), 400

    action_store[action_id] = {
        "action_id": action_id,
        "status": "approved" if approved else "rejected",
    }

    # Log to Firestore
    firestore_db.add_document("action_log", {
        "action_id": action_id,
        "status": "approved" if approved else "rejected",
    })

    return jsonify({
        "success": True,
        "action_id": action_id,
        "status": "approved" if approved else "rejected",
    })


@actions_bp.route("/api/actions", methods=["GET"])
def get_actions():
    return jsonify({"actions": list(action_store.values())})
