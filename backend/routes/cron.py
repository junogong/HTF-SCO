from flask import Blueprint, jsonify
from modules.finviz_scraper import scrape_finviz_news
from modules.ingestion import ingest_signal
import logging

cron_bp = Blueprint('cron', __name__)
logger = logging.getLogger(__name__)

@cron_bp.route('/scrape-finviz', methods=['POST'])
def cron_scrape_finviz():
    """
    Cron endpoint triggered by Google Cloud Scheduler.
    Scrapes Finviz news and ingests it through the intelligence pipeline.
    """
    logger.info("Cron triggered: /api/cron/scrape-finviz")
    
    # 1. Scrape headlines
    headlines = scrape_finviz_news()
    if not headlines:
        return jsonify({"status": "error", "message": "Failed to scrape any headlines"}), 500
        
    # Cap processing to top 20 to avoid blowing up the API quota in one run
    headlines_to_process = headlines[:20]
    
    ingested_signals = []
    
    # 2. Process each headline through ingestion
    for text in headlines_to_process:
        try:
            # ingest_signal classifies, embeds, and links to affected suppliers
            result = ingest_signal(text, signal_type="news")
            
            # If the ingestion linked this signal to at least 1 supplier, keep it
            if result.get("affected_supplier_ids") and len(result["affected_supplier_ids"]) > 0:
                ingested_signals.append({
                    "text": text,
                    "category": result["classification"].get("category"),
                    "revenue_at_risk_trigger": result["classification"].get("severity", 0) > 7,
                    "affected_suppliers": [s["name"] for s in result.get("affected_suppliers", [])]
                })
        except Exception as e:
            logger.error(f"Error ingesting headline '{text}': {e}")
            continue
            
    return jsonify({
        "status": "success",
        "scraped_total": len(headlines),
        "processed": len(headlines_to_process),
        "disruptive_signals_ingested": len(ingested_signals),
        "signals": ingested_signals
    })
