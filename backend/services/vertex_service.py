"""
Vertex AI Service — Real Google Cloud Vertex AI integration.
Uses Gemini 1.5 Pro for reasoning and text-embedding-004 for embeddings.
Falls back to template responses if the API call fails.
"""

import json
import logging
import vertexai
from vertexai.generative_models import GenerativeModel
from vertexai.language_models import TextEmbeddingModel
from config import GCP_PROJECT_ID, GCP_REGION, GEMINI_MODEL, EMBEDDING_MODEL

logger = logging.getLogger(__name__)


class VertexAIService:
    """Real Vertex AI client for Gemini reasoning and embeddings."""

    def __init__(self):
        self._initialized = False
        self._model = None
        self._embedding_model = None

    def _ensure_init(self):
        if not self._initialized:
            vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
            # We don't load the actual heavy models here, we wait for usage
            self._initialized = True
            logger.info(f"✅ Vertex AI initialized (deferred model loading) — project={GCP_PROJECT_ID}")

    @property
    def model(self):
        self._ensure_init()
        if self._model is None:
            from vertexai.generative_models import GenerativeModel
            self._model = GenerativeModel(GEMINI_MODEL)
            logger.info(f"⚡ Gemini model loaded: {GEMINI_MODEL}")
        return self._model

    @property
    def embedding_model(self):
        self._ensure_init()
        if self._embedding_model is None:
            from vertexai.language_models import TextEmbeddingModel
            self._embedding_model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
            logger.info(f"⚡ Embedding model loaded: {EMBEDDING_MODEL}")
        return self._embedding_model

    # ── Embeddings ────────────────────────────────────────────────────

    def generate_embedding(self, text):
        """Generate a real embedding vector using Vertex AI Embeddings API."""
        try:
            result = self.embedding_model.get_embeddings([text])
            return result[0].values
        except Exception as e:
            logger.error(f"Embedding API error: {e}")
            # Fallback: deterministic hash-based embedding
            import hashlib, math
            h = hashlib.sha256(text.lower().encode()).hexdigest()
            raw = [(int(h[(i*2)%len(h):(i*2)%len(h)+2], 16) - 128) / 128.0 for i in range(768)]
            norm = math.sqrt(sum(x*x for x in raw))
            return [x/norm for x in raw] if norm > 0 else raw

    # ── Gemini Reasoning ──────────────────────────────────────────────

    def generate_response(self, prompt, persona=None, context=None):
        """
        Generate structured AI response using Gemini.
        Uses persona-specific system prompts and expects JSON output.
        Falls back to templates if API fails.
        """
        if persona == "classifier":
            # Keep classifier local — it's deterministic keyword matching
            return self._classifier_response(prompt)

        try:
            system_prompt = self._build_system_prompt(persona)
            context_str = json.dumps(context or {}, default=str)
            full_prompt = (
                f"{system_prompt}\n\n"
                f"--- CONTEXT DATA ---\n{context_str}\n\n"
                f"--- TASK ---\n{prompt}\n\n"
                f"Respond with ONLY valid JSON. No markdown, no code fences, no explanation."
            )

            response = self.model.generate_content(full_prompt)
            text = response.text.strip()

            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            if text.startswith("json"):
                text = text[4:].strip()

            result = json.loads(text)
            return result

        except Exception as e:
            logger.warning(f"Gemini API error for persona={persona}: {e} — using fallback template")
            return self._fallback_response(persona, prompt, context)

    # ── System Prompts ────────────────────────────────────────────────

    def _build_system_prompt(self, persona):
        """Build persona-specific system prompt for Gemini."""
        prompts = {
            "logistics_agent": """You are a Logistics Agent in a supply chain war room.
Analyze the disruption and provide logistics recommendations.
Return JSON with exactly these fields:
{
  "agent": "Logistics Agent",
  "recommendation": "string — your analysis and recommendation",
  "lead_time_analysis": {
    "current_lead_time_days": number,
    "disrupted_lead_time_days": number,
    "lead_time_shift_days": number,
    "sensitivity": "string — impact description"
  },
  "reroute_options": [
    {"option": "string", "lead_time_shift_days": number, "feasibility": "high|medium|low", "capacity_utilization": "string"}
  ],
  "service_level_impact": {
    "current_sla_compliance": "string percentage",
    "projected_sla_compliance": "string percentage",
    "at_risk_orders": number
  },
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": number (0-100)
}""",

            "finance_agent": """You are a Finance Agent in a supply chain war room.
Analyze the financial impact of the disruption.
Return JSON with exactly these fields:
{
  "agent": "Finance Agent",
  "recommendation": "string — your cost analysis and recommendation",
  "sla_penalty_analysis": [
    {"supplier": "string", "sla_penalty_per_day": number, "estimated_delay_days": number, "total_penalty": number}
  ],
  "cost_breakdown": {
    "expedited_shipping_cost": number,
    "standard_reroute_cost": number,
    "inventory_holding_cost": number,
    "total_mitigation_cost": number
  },
  "revenue_at_risk": number (total USD at risk),
  "margin_impact": "string (e.g. -2.3%)",
  "contract_penalties": {
    "triggered_clauses": number,
    "max_exposure": number
  },
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": number (0-100)
}""",

            "synthesis": """You are a Strategy Synthesis Engine combining logistics and finance analyses.
Create a unified mitigation strategy. The risk_appetite setting affects priority (conservative=cost-first, aggressive=speed-first).
Return JSON with exactly these fields:
{
  "strategy_name": "string — name of the strategy",
  "confidence_score": number (0-100),
  "summary": "string — 2-3 sentence executive summary",
  "revenue_at_risk": number (from finance analysis),
  "mitigation_actions": [
    {"id": "act-001", "type": "supplier_email|erp_adjustment|preemptive_stock_build", "title": "string", "description": "string", "priority": "HIGH|MEDIUM|LOW", "timeline": "string"}
  ],
  "executive_escalation_required": boolean
}""",

            "email_generator": """You are a professional supply chain communications specialist.
Generate a formal supplier notification email about a disruption.
Return JSON with exactly these fields:
{
  "subject": "string — email subject line",
  "body": "string — full professional email body with line breaks"
}""",
        }

        return prompts.get(persona, "You are a supply chain analysis AI. Respond with valid JSON.")

    # ── Classifier (kept local, no API call needed) ───────────────────

    def _classifier_response(self, text):
        """Unified signal classification via the HighSpeedClassifier."""
        from modules.classifier import classifier
        return classifier.classify(text)

    # ── Fallback Templates ────────────────────────────────────────────

    def _fallback_response(self, persona, prompt, context):
        """Template-based fallback if Gemini API fails."""
        import random
        ctx = context or {}

        if persona == "logistics_agent":
            affected = ctx.get("affected_suppliers", [])
            primary = affected[0]["name"] if affected else "Primary Supplier"
            return {
                "agent": "Logistics Agent",
                "recommendation": f"Immediate rerouting recommended for {primary}. [FALLBACK — Gemini unavailable]",
                "lead_time_analysis": {"current_lead_time_days": 14, "disrupted_lead_time_days": 28, "lead_time_shift_days": 14, "sensitivity": "CRITICAL"},
                "reroute_options": [{"option": "Air freight via alternative hub", "lead_time_shift_days": -5, "feasibility": "high", "capacity_utilization": "72%"}],
                "service_level_impact": {"current_sla_compliance": "96.2%", "projected_sla_compliance": "78.5%", "at_risk_orders": 142},
                "priority": "HIGH", "confidence": 70,
            }
        elif persona == "finance_agent":
            revenue = random.randint(800000, 2500000)
            return {
                "agent": "Finance Agent",
                "recommendation": f"Cost-optimized mitigation path identified. Revenue-at-Risk: ${revenue:,}. [FALLBACK]",
                "sla_penalty_analysis": [{"supplier": "Affected Supplier", "sla_penalty_per_day": 5000, "estimated_delay_days": 10, "total_penalty": 50000}],
                "cost_breakdown": {"expedited_shipping_cost": round(revenue * 0.12), "standard_reroute_cost": round(revenue * 0.05), "inventory_holding_cost": round(revenue * 0.03), "total_mitigation_cost": round(revenue * 0.15)},
                "revenue_at_risk": revenue, "margin_impact": "-2.5%",
                "contract_penalties": {"triggered_clauses": 2, "max_exposure": round(revenue * 0.15)},
                "priority": "HIGH", "confidence": 75,
            }
        elif persona == "synthesis":
            return {
                "strategy_name": "Balanced Speed-Cost Mitigation",
                "confidence_score": 72,
                "summary": "Multi-vector response targeting revenue exposure. [FALLBACK — Gemini unavailable]",
                "revenue_at_risk": ctx.get("finance_analysis", {}).get("revenue_at_risk", 1500000),
                "mitigation_actions": [
                    {"id": "act-001", "type": "supplier_email", "title": "Supplier Contingency Notification", "description": "Notify affected suppliers.", "priority": "HIGH", "timeline": "Immediate"},
                    {"id": "act-002", "type": "erp_adjustment", "title": "Safety Stock Increase", "description": "Increase safety stock by 30%.", "priority": "HIGH", "timeline": "24 hours"},
                ],
                "executive_escalation_required": ctx.get("finance_analysis", {}).get("revenue_at_risk", 0) > ctx.get("revenue_threshold", 500000),
            }
        elif persona == "email_generator":
            supplier = ctx.get("supplier_name", "Valued Partner")
            company = ctx.get("company_name", "NexGen Electronics")
            return {
                "subject": f"URGENT: Supply Chain Contingency — {ctx.get('disruption', 'Disruption')[:50]}",
                "body": f"Dear {supplier} Team,\n\nWe are writing regarding a developing supply chain situation. [FALLBACK — Gemini unavailable]\n\nBest regards,\n{company}",
            }
        else:
            return {"response": f"Analysis complete for: {prompt[:100]}", "confidence": 75}
