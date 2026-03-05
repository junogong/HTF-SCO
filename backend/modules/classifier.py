"""
High-Speed Classifier — Targets a fine-tuned Gemini 1.5 Flash model for
sub-second signal classification. Falls back to the deterministic
keyword classifier if the fine-tuned model is unavailable.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

# ── Fine-Tuned Model Configuration ──────────────────────────────────
# Set via .env: TUNED_CLASSIFIER_MODEL=projects/<id>/locations/<region>/models/<model-id>
TUNED_MODEL_ENDPOINT = os.getenv("TUNED_CLASSIFIER_MODEL", "")

# System instruction that mirrors the Teacher model's classification logic
CLASSIFIER_SYSTEM_INSTRUCTION = """You are a supply chain risk classifier. Given a raw news signal,
classify it with extreme precision and speed.

Return ONLY valid JSON in this exact format:
{
  "category": "geopolitical|weather|financial|quality|logistics|cyber|pandemic|general",
  "severity": <1-10 integer>,
  "region": "<geographic region or null>",
  "reasoning": "<1 sentence explaining why this severity>",
  "keywords": ["keyword1", "keyword2"]
}

Severity scale:
1-3: Low impact, localized, easily mitigated
4-6: Moderate impact, regional, requires monitoring
7-8: High impact, multi-supplier cascade possible  
9-10: Catastrophic, industry-wide, executive escalation required

Categories:
- geopolitical: sanctions, tariffs, trade wars, conflicts, embargoes, political instability
- weather: earthquakes, floods, typhoons, wildfires, hurricanes, tsunamis
- financial: bankruptcies, recessions, credit crises, mergers, debt defaults
- quality: recalls, defects, contamination, inspection failures, compliance violations
- logistics: port closures, shipping delays, container shortages, strikes, customs blocks
- cyber: ransomware, data breaches, IT outages, system failures
- pandemic: disease outbreaks, quarantines, lockdowns, travel bans
- general: does not clearly fit the above categories
"""


class HighSpeedClassifier:
    """
    Signal classifier targeting a fine-tuned Gemini 1.5 Flash model.
    If no fine-tuned endpoint is configured, uses base Flash with the
    system instruction. Falls back to deterministic keywords if API fails.
    """

    def __init__(self):
        self._model = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy-init the model on first call."""
        if self._initialized:
            return

        from config import USE_REAL_VERTEX
        if not USE_REAL_VERTEX:
            logger.info("⚡ Classifier: simulator mode — using keyword fallback")
            self._initialized = True
            return

        try:
            import vertexai
            from vertexai.generative_models import GenerativeModel
            from config import GCP_PROJECT_ID, GCP_REGION

            vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)

            if TUNED_MODEL_ENDPOINT:
                # Use fine-tuned model
                self._model = GenerativeModel(TUNED_MODEL_ENDPOINT)
                logger.info(f"⚡ Classifier: using fine-tuned model → {TUNED_MODEL_ENDPOINT}")
            else:
                # Use base Flash with system instruction
                self._model = GenerativeModel(
                    "gemini-2.0-flash",
                    system_instruction=CLASSIFIER_SYSTEM_INSTRUCTION,
                )
                logger.info("⚡ Classifier: using base Gemini Flash with system instruction")

            self._initialized = True

        except Exception as e:
            logger.error(f"⚡ Classifier init failed: {e} — will use keyword fallback")
            self._initialized = True

    def classify(self, signal_text):
        """
        Classify a raw signal text. Returns structured classification dict.
        
        Args:
            signal_text: Raw news headline or alert text.
        
        Returns:
            dict with keys: category, severity, region, reasoning, keywords, source_label
        """
        self._ensure_initialized()

        # Try the AI model first
        if self._model:
            try:
                prompt = f"Classify this supply chain signal:\n\n\"{signal_text}\""
                response = self._model.generate_content(prompt)
                text = response.text.strip()

                # Strip markdown fences
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    text = text.strip()
                if text.startswith("json"):
                    text = text[4:].strip()

                result = json.loads(text)
                result["source_label"] = f"Signal: {signal_text[:80]}..." if len(signal_text) > 80 else f"Signal: {signal_text}"
                result["classifier"] = "fine-tuned-flash" if TUNED_MODEL_ENDPOINT else "base-flash"
                return result

            except Exception as e:
                logger.warning(f"⚡ Flash classifier failed: {e} — falling back to keywords")

        # Fallback: deterministic keyword classification
        return self._keyword_classify(signal_text)

    def _keyword_classify(self, text):
        """Fast deterministic keyword-based classification."""
        text_lower = text.lower()

        categories = {
            "geopolitical": ["war", "sanction", "tariff", "conflict", "political", "embargo", "trade war"],
            "weather": ["earthquake", "flood", "typhoon", "hurricane", "monsoon", "tsunami", "storm", "wildfire"],
            "financial": ["bankruptcy", "default", "recession", "credit", "debt", "acquisition", "merger"],
            "quality": ["recall", "defect", "contamination", "failure", "inspection", "compliance"],
            "logistics": ["port", "shipping", "container", "freight", "customs", "delay", "strike", "blockage", "canal", "suez"],
            "cyber": ["ransomware", "breach", "outage", "hack", "malware", "cyber"],
            "pandemic": ["outbreak", "quarantine", "lockdown", "pandemic", "virus", "epidemic"],
        }

        detected_category = "general"
        severity = 5
        detected_keywords = []
        for cat, keywords in categories.items():
            for kw in keywords:
                if kw in text_lower:
                    detected_category = cat
                    severity = min(10, severity + 2)
                    detected_keywords.append(kw)
                    break

        regions = {
            "taiwan": "East Asia", "china": "East Asia", "chinese": "East Asia",
            "japan": "East Asia", "japanese": "East Asia", "korea": "East Asia",
            "india": "South Asia", "indian": "South Asia",
            "vietnam": "Southeast Asia", "thailand": "Southeast Asia", "indonesia": "Southeast Asia",
            "germany": "Europe", "german": "Europe", "france": "Europe", "uk": "Europe",
            "mexico": "North America", "brazil": "South America",
            "shanghai": "East Asia", "shenzhen": "East Asia",
            "suez": "Middle East", "panama": "Central America",
        }
        detected_region = None
        for place, region in regions.items():
            if place in text_lower:
                detected_region = region
                break

        return {
            "category": detected_category,
            "severity": min(severity, 10),
            "region": detected_region,
            "reasoning": f"Keyword match: {', '.join(detected_keywords) if detected_keywords else 'no strong signals'}",
            "keywords": detected_keywords,
            "source_label": f"Signal: {text[:80]}..." if len(text) > 80 else f"Signal: {text}",
            "classifier": "keyword-fallback",
        }


# ── Singleton ────────────────────────────────────────────────────────
classifier = HighSpeedClassifier()
