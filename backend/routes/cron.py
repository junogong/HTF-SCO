from flask import Blueprint, jsonify
from modules.finviz_scraper import scrape_finviz_news
from modules.ingestion import ingest_signal
from modules.classifier import classifier as high_speed_classifier
from modules.orchestrator import analyze_disruption
import logging
import time
import threading

cron_bp = Blueprint('cron', __name__)
logger = logging.getLogger(__name__)

# ── In-memory store for scraped + classified signals ─────────────────
_scraped_signals = []          # All classified headlines
_auto_disruptions = []         # Full orchestrator results for high-severity signals

# Severity threshold: signals at or above this run through the full orchestrator
AUTO_ANALYZE_THRESHOLD = 6


def _run_async_analysis(text, classification):
    """Heavy AI orchestration runs in a background thread to keep UI responsive."""
    try:
        # Cross-run deduplication (check last 20 disruptions by exact headline)
        recent_texts = [d.get("scraped_headline", d.get("signal", "")) for d in _auto_disruptions[-20:]]
        
        # Simplified deduplication as requested — no semantic similarity check
        if text in recent_texts:
            logger.info(f"   ⏭️  [Async] Skipped exact duplicate: {text[:60]}...")
            ingest_signal(text, signal_type="news")
            return

        logger.info(f"   🚨 [Async] Starting deep analysis: {text[:60]}...")
        result = analyze_disruption(text)
        result["source"] = "finviz-auto"
        result["scraped_headline"] = text
        
        _auto_disruptions.append(result)
        # Keep only last 30 disruptions
        if len(_auto_disruptions) > 30:
            _auto_disruptions[:] = _auto_disruptions[-30:]
            
        logger.info(f"   ✅ [Async] Analysis complete: ${result['strategy']['revenue_at_risk']:,} at risk")
    except Exception as e:
        logger.error(f"   ❌ [Async] Orchestrator failed for '{text[:40]}': {e}")


@cron_bp.route('/scrape-finviz', methods=['POST'])
def cron_scrape_finviz():
    """
    Cron endpoint triggered by Scheduler.
    Now offloads heavy analysis to background threads for instant UI response.
    """
    logger.info("Cron triggered: /api/cron/scrape-finviz")
    
    headlines = scrape_finviz_news()
    if not headlines:
        return jsonify({"status": "error", "message": "Failed to scrape any headlines"}), 500
        
    headlines_to_process = headlines[:20]
    classified_signals = []
    processed_in_batch = set() # Batch-level deduplication
    threads_started = 0
    
    for text in headlines_to_process:
        try:
            # Batch-level deduplication (exact or near-exact match in this run)
            text_norm = text.lower().strip()
            if any(text_norm in p or p in text_norm for p in processed_in_batch):
                continue
            processed_in_batch.add(text_norm)

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
            
            # High-severity signals trigger background analysis
            if classification.get("severity", 0) >= AUTO_ANALYZE_THRESHOLD and classification.get("category") != "general":
                thread = threading.Thread(target=_run_async_analysis, args=(text, classification))
                thread.daemon = True
                thread.start()
                threads_started += 1
            else:
                # Still ingest for context
                ingest_signal(text, signal_type="news")

        except Exception as e:
            logger.error(f"Error processing headline '{text[:40]}': {e}")
            continue
    
    _scraped_signals.extend(classified_signals)
    if len(_scraped_signals) > 100:
        _scraped_signals[:] = _scraped_signals[-100:]
    
    return jsonify({
        "status": "success",
        "scraped_total": len(headlines),
        "processed": len(headlines_to_process),
        "auto_analyzed_started": threads_started,
        "message": "Scrape complete. Analysis continuing in background." if threads_started > 0 else "Scrape complete."
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
