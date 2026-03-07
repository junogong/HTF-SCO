"""POST /api/disruption/stream — SSE streaming disruption analysis pipeline."""

import json
from flask import Blueprint, request, Response, stream_with_context
from modules.orchestrator import analyze_disruption_streaming
from routes.safety import update_last_analysis

disruption_stream_bp = Blueprint("disruption_stream", __name__)


@disruption_stream_bp.route("/api/disruption/stream", methods=["POST"])
def stream_disruption():
    data = request.get_json()
    signal = data.get("signal", "")
    risk_appetite = data.get("risk_appetite", "balanced")

    if not signal:
        return {"error": "Signal text is required"}, 400

    def generate():
        final_result = None
        for msg in analyze_disruption_streaming(signal, risk_appetite=risk_appetite):
            event_type = msg.get("event", "step")
            if event_type == "result":
                final_result = msg["data"]
                update_last_analysis(final_result)
                yield f"event: result\ndata: {json.dumps(final_result)}\n\n"
            else:
                yield f"event: step\ndata: {json.dumps(msg)}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
