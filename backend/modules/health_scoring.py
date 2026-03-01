"""
Supplier Health Scoring Engine — calculates 1-100 health score per supplier.
Integrates ERP signals (on-time delivery), quality, news sentiment, and financial stability.
"""

from services.spanner_simulator import graph_db
from config import HEALTH_WEIGHTS


def calculate_health_score(supplier_id):
    """
    Weighted health score (1-100) with breakdown and trend.
    Weights: on-time delivery (40%), quality (25%), news sentiment (20%), financial (15%).
    """
    supplier = graph_db.get_node("Supplier", supplier_id)
    if not supplier:
        return None

    metrics = supplier.get("metrics", {})

    # Individual scores (each 0-100)
    otd = metrics.get("on_time_delivery", 85)
    quality = metrics.get("quality_score", 90)
    financial = metrics.get("financial_stability", 75)

    # News sentiment — check recent signals
    news_score = _calculate_news_sentiment(supplier_id)

    # Weighted composite
    composite = (
        otd * HEALTH_WEIGHTS["on_time_delivery"]
        + quality * HEALTH_WEIGHTS["quality_score"]
        + news_score * HEALTH_WEIGHTS["news_sentiment"]
        + financial * HEALTH_WEIGHTS["financial_stability"]
    )

    score = max(1, min(100, round(composite)))

    # Trend indicator
    prev_score = supplier.get("prev_health_score", score)
    if score > prev_score + 3:
        trend = "improving"
    elif score < prev_score - 3:
        trend = "declining"
    else:
        trend = "stable"

    # Update node
    graph_db.update_node("Supplier", supplier_id, {
        "health_score": score,
        "prev_health_score": prev_score,
    })

    return {
        "supplier_id": supplier_id,
        "supplier_name": supplier.get("name", "Unknown"),
        "health_score": score,
        "trend": trend,
        "breakdown": {
            "on_time_delivery": {"score": otd, "weight": HEALTH_WEIGHTS["on_time_delivery"]},
            "quality_score": {"score": quality, "weight": HEALTH_WEIGHTS["quality_score"]},
            "news_sentiment": {"score": news_score, "weight": HEALTH_WEIGHTS["news_sentiment"]},
            "financial_stability": {"score": financial, "weight": HEALTH_WEIGHTS["financial_stability"]},
        },
        "risk_level": _risk_level(score),
    }


def calculate_all_health_scores():
    """Recalculate health scores for all suppliers."""
    suppliers = graph_db.get_all_nodes("Supplier")
    results = []
    for sup in suppliers:
        result = calculate_health_score(sup["id"])
        if result:
            results.append(result)
    return results


def _calculate_news_sentiment(supplier_id):
    """
    Derive a 0-100 news sentiment score from signals affecting this supplier.
    Uses the 'Geopolitical Sentiment' weight from the Vertex AI news classifier.
    """
    signals = graph_db.query_neighbors("Supplier", supplier_id, edge_type="AFFECTS", direction="incoming")
    if not signals:
        return 70  # Neutral baseline if no news

    severities = []
    for match in signals:
        node = match.get("node", {})
        severity = node.get("severity", 5)
        severities.append(severity)

    avg_severity = sum(severities) / len(severities)
    # Convert severity (1-10 scale, higher=worse) to sentiment (0-100, higher=better)
    sentiment = max(0, min(100, round(100 - (avg_severity * 10))))
    return sentiment


def _risk_level(score):
    if score >= 80:
        return "low"
    elif score >= 60:
        return "medium"
    elif score >= 40:
        return "high"
    else:
        return "critical"
