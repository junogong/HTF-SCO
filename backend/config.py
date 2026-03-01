"""Configuration constants for the Supply Chain Resilience Agent."""

# ── GCP Configuration ────────────────────────────────────────────────
GCP_PROJECT_ID = "htf-sco"
GCP_REGION = "us-east1"
FIRESTORE_DATABASE = "htf-sco"  # Named Firestore database

# ── Service Toggle ───────────────────────────────────────────────────
# Set to True to use real GCP services, False for local simulators.
# Option A (prototype): only Vertex AI + Firestore are real.
# Option B (demo):      all three are real (requires Spanner instance).
USE_REAL_VERTEX = True
USE_REAL_FIRESTORE = True
USE_REAL_SPANNER = False  # Flip to True for demo day (requires provisioned Spanner instance)

# ── AI Model Configuration ───────────────────────────────────────────
GEMINI_MODEL = "gemini-2.0-flash"
EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIM = 768 if USE_REAL_VERTEX else 256

# ── Business Logic ───────────────────────────────────────────────────
DEFAULT_RISK_APPETITE = "balanced"  # conservative | balanced | aggressive
REVENUE_AT_RISK_THRESHOLD = 500000  # USD — triggers executive escalation
CONFIDENCE_THRESHOLD = 70  # % — below this requires manual review
DEFAULT_SLA_PENALTY_PER_DAY = 2500  # USD per day late
EXPEDITED_SHIPPING_MULTIPLIER = 2.8  # cost multiplier for rush orders

# Health score weights
HEALTH_WEIGHTS = {
    "on_time_delivery": 0.40,
    "quality_score": 0.25,
    "news_sentiment": 0.20,
    "financial_stability": 0.15,
}

# Agent risk appetite multipliers
RISK_APPETITE_PROFILES = {
    "conservative": {"cost_weight": 2.0, "speed_weight": 0.5},
    "balanced": {"cost_weight": 1.0, "speed_weight": 1.0},
    "aggressive": {"cost_weight": 0.5, "speed_weight": 2.0},
}
