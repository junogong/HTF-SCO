from flask import Blueprint, jsonify
from modules.finviz_scraper import scrape_finviz_news
from modules.ingestion import ingest_signal
from modules.classifier import classifier as high_speed_classifier
from modules.orchestrator import analyze_disruption
import logging
import time

cron_bp = Blueprint('cron', __name__)
logger = logging.getLogger(__name__)

# ── In-memory store for scraped + classified signals ─────────────────
_scraped_signals = []          # All classified headlines
_auto_disruptions = []         # Full orchestrator results for high-severity signals

# Severity threshold: signals at or above this run through the full orchestrator
AUTO_ANALYZE_THRESHOLD = 6


@cron_bp.route('/scrape-finviz', methods=['POST'])
def cron_scrape_finviz():
    """
    Cron endpoint triggered by Google Cloud Scheduler (or manually).
    1. Scrapes Finviz news headlines
    2. Classifies each with the HighSpeedClassifier
    3. High-severity signals automatically run through the full orchestrator
    4. Results are stored in memory for the Dashboard to fetch
    """
    logger.info("Cron triggered: /api/cron/scrape-finviz")
    
    # 1. Scrape headlines
    headlines = scrape_finviz_news()
    if not headlines:
        return jsonify({"status": "error", "message": "Failed to scrape any headlines"}), 500
        
    # Cap processing to top 20 to avoid blowing up the API quota in one run
    headlines_to_process = headlines[:20]
    
    classified_signals = []
    new_disruptions = []
    
    # 2. Classify each headline with the HighSpeedClassifier
    for text in headlines_to_process:
        try:
            classification = high_speed_classifier.classify(text)
            
            signal_entry = {
                "text": text,
                "category": classification.get("category", "general"),
                "severity": classification.get("severity", 1),
                "region": classification.get("region"),
                "reasoning": classification.get("reasoning", ""),
                "keywords": classification.get("keywords", []),
                "classifier": classification.get("classifier", "keyword-fallback"),
                "timestamp": time.time(),
                "source": "finviz",
            }
            classified_signals.append(signal_entry)
            
            # 3. If severity >= threshold AND supply-chain related, run full orchestrator
            if classification.get("severity", 0) >= AUTO_ANALYZE_THRESHOLD and classification.get("category") != "general":
                logger.info(f"   🚨 High-severity signal detected (sev {classification['severity']}): {text[:60]}...")
                try:
                    result = analyze_disruption(text)
                    result["source"] = "finviz-auto"
                    result["scraped_headline"] = text
                    new_disruptions.append(result)
                    logger.info(f"   ✅ Auto-analyzed: Revenue-at-Risk ${result['strategy']['revenue_at_risk']:,}")
                except Exception as e:
                    logger.error(f"   ❌ Orchestrator failed for '{text[:40]}': {e}")
            else:
                # Still ingest low-severity signals into the graph for context
                try:
                    ingest_signal(text, signal_type="news")
                except Exception as e:
                    logger.error(f"   Error ingesting headline '{text[:40]}': {e}")

        except Exception as e:
            logger.error(f"Error classifying headline '{text[:40]}': {e}")
            continue
    
    # 4. Store results in memory for Dashboard polling
    _scraped_signals.extend(classified_signals)
    # Keep only last 100 signals
    if len(_scraped_signals) > 100:
        _scraped_signals[:] = _scraped_signals[-100:]
    
    _auto_disruptions.extend(new_disruptions)
    # Keep only last 20 disruptions
    if len(_auto_disruptions) > 20:
        _auto_disruptions[:] = _auto_disruptions[-20:]
    
    return jsonify({
        "status": "success",
        "scraped_total": len(headlines),
        "processed": len(headlines_to_process),
        "classified": len(classified_signals),
        "auto_analyzed": len(new_disruptions),
        "high_severity_signals": [
            {"text": s["text"][:80], "category": s["category"], "severity": s["severity"]}
            for s in classified_signals if s["severity"] >= AUTO_ANALYZE_THRESHOLD
        ],
    })


@cron_bp.route('/scraped-signals', methods=['GET'])
def get_scraped_signals():
    """Return all recently scraped + classified signals for the frontend."""
    return jsonify({
        "signals": _scraped_signals[-50:],  # Last 50
        "total": len(_scraped_signals),
    })


@cron_bp.route('/auto-disruptions', methods=['GET'])
def get_auto_disruptions():
    """Return auto-analyzed disruptions from scraped news (high-severity only)."""
    return jsonify({
        "disruptions": _auto_disruptions[-10:],  # Last 10
        "total": len(_auto_disruptions),
    })
