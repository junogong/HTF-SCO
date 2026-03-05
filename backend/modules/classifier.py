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
  "affected_countries": ["Country1", "Country2"],
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

Important Geographic Rules:
- If a river, landmark, or sub-region is mentioned (e.g. "Rhine river flooding", "Suez canal block"), you MUST map it to the specific countries affected (e.g., ["Germany", "Netherlands"] for Rhine, ["Egypt"] for Suez).
- Do not output broad regions like "Europe" or "Asia" in the `affected_countries` array. Only output specific country names (e.g., "South Korea", "China", "United States", "Germany").
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
                self._model = GenerativeModel(
                    TUNED_MODEL_ENDPOINT,
                    system_instruction=CLASSIFIER_SYSTEM_INSTRUCTION,
                )
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

                # Graceful fallback: The fine-tuned model might return the legacy 'region' field.
                # If so, force keyword fallback to ensure specific countries are extracted.
                if "affected_countries" not in result and "region" in result:
                    logger.warning("⚡ Model returned legacy 'region' instead of 'affected_countries' — forcing keyword fallback")
                    return self._keyword_classify(signal_text)

                result["source_label"] = f"Signal: {signal_text[:80]}..." if len(signal_text) > 80 else f"Signal: {signal_text}"
                result["classifier"] = "fine-tuned-flash" if TUNED_MODEL_ENDPOINT else "base-flash"
                logger.info(f"🟢 Signal classified via {'Fine-Tuned AI' if TUNED_MODEL_ENDPOINT else 'Base AI'}")
                return result

            except Exception as e:
                logger.warning(f"⚡ Flash classifier failed: {e} — falling back to keywords")

        # Fallback: deterministic keyword classification
        logger.info("🟡 Signal classified via Keyword Fallback")
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

        # ── Direct country-name lookups ──────────────────────────────
        direct_countries = {
            "taiwan": "Taiwan", "china": "China", "japan": "Japan",
            "south korea": "South Korea", "korea": "South Korea",
            "india": "India", "vietnam": "Vietnam", "thailand": "Thailand",
            "indonesia": "Indonesia", "germany": "Germany", "france": "France",
            "united kingdom": "United Kingdom", "uk": "United Kingdom",
            "britain": "United Kingdom", "mexico": "Mexico", "brazil": "Brazil",
            "egypt": "Egypt", "panama": "Panama", "ukraine": "Ukraine",
            "congo": "D.R. Congo", "chile": "Chile", "malaysia": "Malaysia",
            "singapore": "Singapore", "philippines": "Philippines",
            "turkey": "Turkey", "iran": "Iran", "iraq": "Iraq",
            "saudi arabia": "Saudi Arabia", "united states": "United States",
            "canada": "Canada", "australia": "Australia", "russia": "Russia",
            "italy": "Italy", "spain": "Spain", "netherlands": "Netherlands",
            "belgium": "Belgium", "poland": "Poland", "sweden": "Sweden",
            "norway": "Norway", "switzerland": "Switzerland",
            "south africa": "South Africa", "nigeria": "Nigeria",
            "argentina": "Argentina", "colombia": "Colombia",
        }

        # ── Geographic features → affected countries ─────────────────
        geographic_mappings = {
            # Rivers
            "rhine": ["Germany", "Netherlands", "France", "Switzerland"],
            "danube": ["Germany", "Austria", "Hungary", "Romania"],
            "mekong": ["Vietnam", "Thailand", "Cambodia", "Laos"],
            "yangtze": ["China"], "yellow river": ["China"],
            "ganges": ["India", "Bangladesh"],
            "nile": ["Egypt", "Sudan"],
            "mississippi": ["United States"],
            "amazon": ["Brazil", "Colombia", "Peru"],
            # Straits & canals
            "suez": ["Egypt"],
            "panama canal": ["Panama"],
            "strait of malacca": ["Malaysia", "Singapore", "Indonesia"],
            "malacca": ["Malaysia", "Singapore", "Indonesia"],
            "strait of hormuz": ["Iran", "Oman"],
            "hormuz": ["Iran", "Oman"],
            "bosphorus": ["Turkey"],
            "taiwan strait": ["Taiwan", "China"],
            # Cities / industrial hubs
            "shanghai": ["China"], "shenzhen": ["China"],
            "guangzhou": ["China"], "beijing": ["China"],
            "tokyo": ["Japan"], "osaka": ["Japan"],
            "seoul": ["South Korea"], "busan": ["South Korea"],
            "mumbai": ["India"], "chennai": ["India"],
            "ho chi minh": ["Vietnam"], "hanoi": ["Vietnam"],
            "bangkok": ["Thailand"],
            "rotterdam": ["Netherlands"],
            "hamburg": ["Germany"],
            "los angeles": ["United States"],
            "long beach": ["United States"],
            # Sub-regions
            "pearl river delta": ["China"],
            "ruhr": ["Germany"],
            "baltic": ["Germany", "Poland", "Sweden", "Finland"],
            "black sea": ["Turkey", "Romania", "Ukraine", "Russia"],
            "south china sea": ["China", "Vietnam", "Philippines"],
            "east china sea": ["China", "Japan", "South Korea"],
        }

        detected_countries = []

        # Match direct country names
        for kw, country in direct_countries.items():
            if kw in text_lower and country not in detected_countries:
                detected_countries.append(country)

        # Match geographic features to their affected countries
        for kw, cntry_list in geographic_mappings.items():
            if kw in text_lower:
                for c in cntry_list:
                    if c not in detected_countries:
                        detected_countries.append(c)

        return {
            "category": detected_category,
            "severity": min(severity, 10),
            "affected_countries": detected_countries,
            "reasoning": f"Detected keywords: {', '.join(detected_keywords)}",
            "keywords": detected_keywords,
            "source_label": f"Signal: {text[:80]}..." if len(text) > 80 else f"Signal: {text}",
            "classifier": "keyword-fallback"
        }

    def is_duplicate_event(self, new_headline: str, recent_headlines: list[str]) -> bool:
        """
        Quickly checks if a new headline describes the exact same event as any recent headlines.
        Returns True if it's a duplicate, False if it's novel.
        """
        if not recent_headlines:
            return False
            
        # If in simulator mode or model is unavailable, use strict string matching fallback
        if not USE_REAL_VERTEX or not self.fast_model:
            new_lower = new_headline.lower().strip()
            for h in recent_headlines:
                if new_lower in h.lower() or h.lower() in new_lower:
                    return True
            return False
            
        try:
            prompt = f"""
You are a supply chain intelligence deduplication engine.
Your job is to determine if a NEW event is describing the EXACT SAME specific underlying event as any of the RECENT events.

NEW EVENT:
"{new_headline}"

RECENT EVENTS:
"""
            for i, h in enumerate(recent_headlines):
                prompt += f"{i+1}. \"{h}\"\n"
            
            prompt += """
Are they describing the exact same specific event? 
(For example: "Port strike in LA" and "Los Angeles port workers walk out" = YES. "Typhoon in Japan" and "Earthquake in Japan" = NO.)

Respond ONLY with YES or NO.
            """
            
            response = self.fast_model.generate_content(
                prompt,
                generation_config={"temperature": 0.0, "max_output_tokens": 5}
            )
            
            text = response.text.upper().strip()
            return "YES" in text
            
        except Exception as e:
            logger.error(f"Error in deduplication check: {e}")
            # Fall back to simple matching on error
            new_lower = new_headline.lower().strip()
            for h in recent_headlines:
                if new_lower in h.lower() or h.lower() in new_lower:
                    return True
            return False


# ── Singleton ────────────────────────────────────────────────────────
classifier = HighSpeedClassifier()
