"""
Supervised Fine-Tuning Dataset Generator — "Teacher" Script.
Uses Gemini 1.5 Pro to generate synthetic supply chain news signals
paired with ideal classification and severity scores, then exports
as a .jsonl file for Vertex AI fine-tuning on Gemini 1.5 Flash.
"""

import json
import time
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# ── "Teacher" Prompt — tells Gemini Pro what to generate ─────────────
TEACHER_SYSTEM_PROMPT = """You are a supply chain intelligence data engineer creating training data
for a fine-tuned classifier model. Generate a DIVERSE batch of realistic news headlines/signals
that relate to global supply chain disruptions.

For each signal, provide the ideal classification. Cover ALL of these categories evenly:
- geopolitical (sanctions, tariffs, trade wars, conflicts, embargoes)
- weather (earthquakes, floods, typhoons, wildfires, monsoons, tsunamis)
- financial (bankruptcies, recessions, credit crises, mergers, acquisitions)
- quality (recalls, defects, contamination, inspections, compliance failures)
- logistics (port closures, shipping delays, container shortages, strikes, customs issues)
- cyber (ransomware, data breach, IT outage, system failure)
- pandemic (disease outbreak, quarantine, lockdown, travel ban)

Each signal must specify:
- The news headline text (realistic, varied lengths, varied sources)
- category: one of the 7 above
- severity: 1-10 (1=minor, 10=catastrophic)
- region: the geographic region (e.g., "East Asia", "Europe", "Southeast Asia", "South America", etc.)
- reasoning: 1 sentence explaining WHY this severity score is appropriate
- keywords: list of 2-4 risk keywords detected in the signal

Return a JSON array of objects. Generate exactly {batch_size} examples per call.
Each object must have: "input", "category", "severity", "region", "reasoning", "keywords".
The "input" field is the raw news headline text.
"""

BATCH_SIZE = 25  # Signals per API call


def generate_sft_dataset(total_examples=200, output_dir=None):
    """
    Generate a supervised fine-tuning dataset using Gemini Pro as the "teacher".
    
    Args:
        total_examples: Target number of training examples (default 200).
        output_dir: Directory to write output files. Defaults to backend/data/sft/.
    
    Returns:
        Path to the generated .jsonl file.
    """
    from services.vertex_simulator import vertex_ai
    from config import USE_REAL_VERTEX

    if not USE_REAL_VERTEX:
        logger.warning("⚠️  USE_REAL_VERTEX is False — generating synthetic dataset from templates instead.")
        return _generate_template_dataset(total_examples, output_dir)

    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "data" / "sft"
    else:
        output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_examples = []
    num_batches = max(1, total_examples // BATCH_SIZE)

    logger.info(f"🎓 Generating SFT dataset: {total_examples} examples in {num_batches} batches...")

    for batch_idx in range(num_batches):
        logger.info(f"   Batch {batch_idx + 1}/{num_batches}...")
        try:
            prompt = TEACHER_SYSTEM_PROMPT.format(batch_size=BATCH_SIZE)
            prompt += f"\n\nThis is batch {batch_idx + 1} of {num_batches}. "
            prompt += "Ensure variety — do NOT repeat signals from prior batches. "
            prompt += "Focus this batch more on: " + [
                "geopolitical and weather events",
                "financial and quality incidents",
                "logistics and cyber disruptions",
                "pandemic and cross-category cascading events",
                "emerging markets and rare supply chain risks",
                "semiconductor and electronics supply chain",
                "energy and raw materials supply chain",
                "food and agriculture supply chain",
            ][batch_idx % 8]

            # Use Gemini Pro to generate
            import vertexai
            from vertexai.generative_models import GenerativeModel
            from config import GCP_PROJECT_ID, GCP_REGION

            model = GenerativeModel("gemini-1.5-pro")
            response = model.generate_content(
                prompt + "\n\nRespond with ONLY a valid JSON array. No markdown, no code fences."
            )

            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            if text.startswith("json"):
                text = text[4:].strip()

            batch_data = json.loads(text)
            if isinstance(batch_data, list):
                all_examples.extend(batch_data)
                logger.info(f"   ✅ Got {len(batch_data)} examples (total: {len(all_examples)})")
            else:
                logger.warning(f"   ⚠️ Batch {batch_idx + 1} returned non-array, skipping")

        except Exception as e:
            logger.error(f"   ❌ Batch {batch_idx + 1} failed: {e}")

        # Rate limit protection
        if batch_idx < num_batches - 1:
            time.sleep(2)

    if not all_examples:
        logger.error("No examples generated! Falling back to templates.")
        return _generate_template_dataset(total_examples, output_dir)

    # ── Step B: Format as .jsonl for Vertex AI fine-tuning ──────────────
    jsonl_path = output_dir / "sft_training_data.jsonl"
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for ex in all_examples:
            training_line = {
                "input": ex.get("input", ""),
                "output": json.dumps({
                    "category": ex.get("category", "general"),
                    "severity": ex.get("severity", 5),
                    "region": ex.get("region"),
                    "reasoning": ex.get("reasoning", ""),
                    "keywords": ex.get("keywords", []),
                }, ensure_ascii=False),
            }
            f.write(json.dumps(training_line, ensure_ascii=False) + "\n")

    logger.info(f"✅ SFT dataset written: {jsonl_path} ({len(all_examples)} examples)")

    # Also save raw JSON for inspection
    raw_path = output_dir / "sft_raw_examples.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(all_examples, f, indent=2, ensure_ascii=False)

    return str(jsonl_path)


def _generate_template_dataset(total_examples, output_dir):
    """Fallback: generate from handcrafted templates when Gemini Pro is unavailable."""
    import random

    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "data" / "sft"
    else:
        output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    templates = [
        # Geopolitical
        {"input": "US imposes new tariffs on Chinese semiconductor imports, escalating trade war", "category": "geopolitical", "severity": 8, "region": "East Asia", "reasoning": "Direct impact on semiconductor supply chain from world's largest chip manufacturer", "keywords": ["tariff", "trade war", "sanction"]},
        {"input": "EU sanctions on Russian raw materials affect European manufacturers", "category": "geopolitical", "severity": 7, "region": "Europe", "reasoning": "Sanctions disrupt raw material flows to European industry", "keywords": ["sanction", "embargo"]},
        {"input": "Taiwan Strait tensions spike as military exercises intensify", "category": "geopolitical", "severity": 9, "region": "East Asia", "reasoning": "Taiwan is the world's semiconductor hub — any conflict would be catastrophic", "keywords": ["conflict", "political"]},
        {"input": "India bans export of key pharmaceutical intermediates", "category": "geopolitical", "severity": 6, "region": "South Asia", "reasoning": "India supplies 20% of global pharma intermediates", "keywords": ["embargo", "political"]},
        # Weather
        {"input": "Magnitude 7.2 earthquake strikes central Japan, disrupting automotive supply chain", "category": "weather", "severity": 9, "region": "East Asia", "reasoning": "Japan is a critical automotive and electronics component supplier", "keywords": ["earthquake"]},
        {"input": "Severe flooding in Thailand submerges industrial estates near Bangkok", "category": "weather", "severity": 8, "region": "Southeast Asia", "reasoning": "Thailand's industrial zones house major HDD and automotive parts factories", "keywords": ["flood"]},
        {"input": "Hurricane Category 4 approaches Gulf of Mexico oil refineries", "category": "weather", "severity": 8, "region": "North America", "reasoning": "Gulf Coast refineries produce 45% of US petrochemical output", "keywords": ["hurricane", "storm"]},
        {"input": "Wildfires in Indonesia destroy palm oil plantations and resin factories", "category": "weather", "severity": 7, "region": "Southeast Asia", "reasoning": "Indonesia is the world's largest palm oil producer, affecting epoxy resin supply", "keywords": ["wildfire"]},
        # Financial
        {"input": "Major tier-2 battery supplier files for Chapter 11 bankruptcy protection", "category": "financial", "severity": 8, "region": "North America", "reasoning": "Bankruptcy of a key battery supplier cascades to multiple OEMs", "keywords": ["bankruptcy", "default"]},
        {"input": "Global recession fears mount as central banks raise interest rates", "category": "financial", "severity": 6, "region": "Global", "reasoning": "Recession reduces demand and tightens credit for suppliers", "keywords": ["recession", "credit"]},
        {"input": "Hostile acquisition bid for critical rare earth mining company", "category": "financial", "severity": 5, "region": "Global", "reasoning": "Acquisition could consolidate rare earth supply under single entity", "keywords": ["acquisition", "merger"]},
        # Quality
        {"input": "Samsung recalls 2 million batteries due to overheating defect", "category": "quality", "severity": 7, "region": "East Asia", "reasoning": "Battery recalls affect multiple product lines and consumer safety", "keywords": ["recall", "defect"]},
        {"input": "FDA inspection finds contamination at pharmaceutical API plant in India", "category": "quality", "severity": 7, "region": "South Asia", "reasoning": "Contamination at API source blocks entire drug production pipeline", "keywords": ["contamination", "inspection"]},
        {"input": "Automotive airbag manufacturer issues global safety recall", "category": "quality", "severity": 8, "region": "Global", "reasoning": "Safety recalls halt production lines across multiple OEMs", "keywords": ["recall", "compliance"]},
        # Logistics
        {"input": "Container ship runs aground in Suez Canal blocking global shipping", "category": "logistics", "severity": 9, "region": "Middle East", "reasoning": "Suez Canal handles 12% of global trade — blockage causes weeks of delays", "keywords": ["shipping", "canal", "blockage"]},
        {"input": "Dockworkers strike at Port of Los Angeles enters second week", "category": "logistics", "severity": 7, "region": "North America", "reasoning": "LA/LB ports handle 40% of US containerized imports", "keywords": ["strike", "port", "delay"]},
        {"input": "Global container shortage worsens as shipping rates hit record highs", "category": "logistics", "severity": 6, "region": "Global", "reasoning": "Container scarcity increases costs and delays across all trade lanes", "keywords": ["container", "freight", "shipping"]},
        {"input": "Customs delays at Chinese ports due to new COVID inspection protocols", "category": "logistics", "severity": 5, "region": "East Asia", "reasoning": "Additional inspections add 3-5 days to clearance times", "keywords": ["customs", "delay"]},
        # Cyber
        {"input": "Ransomware attack takes down major logistics provider's tracking systems", "category": "cyber", "severity": 8, "region": "Global", "reasoning": "Loss of tracking visibility affects thousands of shipments globally", "keywords": ["ransomware", "outage"]},
        {"input": "Data breach at semiconductor fab exposes proprietary chip designs", "category": "cyber", "severity": 7, "region": "East Asia", "reasoning": "IP theft could undermine competitive advantage in chip manufacturing", "keywords": ["data breach", "cyber"]},
        # Pandemic
        {"input": "New respiratory virus outbreak forces factory shutdowns in Guangdong province", "category": "pandemic", "severity": 8, "region": "East Asia", "reasoning": "Guangdong is a major electronics manufacturing hub", "keywords": ["outbreak", "lockdown"]},
        {"input": "WHO declares new pandemic variant, countries reimpose travel restrictions", "category": "pandemic", "severity": 7, "region": "Global", "reasoning": "Travel bans disrupt supply chain personnel and logistics", "keywords": ["pandemic", "travel ban"]},
    ]

    # Augment templates to reach target count
    all_examples = []
    while len(all_examples) < total_examples:
        for t in templates:
            if len(all_examples) >= total_examples:
                break
            example = dict(t)
            # Add slight variation
            variations = [
                f"BREAKING: {t['input']}",
                f"Reuters: {t['input']}",
                f"Bloomberg reports: {t['input']}",
                f"ALERT — {t['input']}",
                t["input"],
            ]
            example["input"] = random.choice(variations)
            all_examples.append(example)

    # Write .jsonl
    jsonl_path = output_dir / "sft_training_data.jsonl"
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for ex in all_examples:
            training_line = {
                "input": ex["input"],
                "output": json.dumps({
                    "category": ex["category"],
                    "severity": ex["severity"],
                    "region": ex.get("region"),
                    "reasoning": ex.get("reasoning", ""),
                    "keywords": ex.get("keywords", []),
                }, ensure_ascii=False),
            }
            f.write(json.dumps(training_line, ensure_ascii=False) + "\n")

    logger.info(f"✅ Template SFT dataset written: {jsonl_path} ({len(all_examples)} examples)")
    return str(jsonl_path)


# ── Step C: Launch Fine-Tuning Job ──────────────────────────────────
def launch_tuning_job(dataset_path=None, tuned_model_name=None):
    """
    Upload dataset to Vertex AI and launch a supervised fine-tuning job
    on the gemini-1.5-flash base model.
    
    Args:
        dataset_path: Path to the .jsonl training file.
        tuned_model_name: Display name for the tuned model.
    
    Returns:
        The tuning job object.
    """
    from config import GCP_PROJECT_ID, GCP_REGION, USE_REAL_VERTEX

    if not USE_REAL_VERTEX:
        logger.warning("⚠️  Cannot launch tuning job in simulator mode. Set USE_REAL_VERTEX=true.")
        return None

    if dataset_path is None:
        dataset_path = str(Path(__file__).parent.parent / "data" / "sft" / "sft_training_data.jsonl")

    if tuned_model_name is None:
        tuned_model_name = f"scr-classifier-flash-{int(time.time())}"

    try:
        import vertexai
        from vertexai.preview.tuning import sft as sft_tuning

        vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)

        # Upload dataset to GCS first (required by Vertex AI)
        from google.cloud import storage
        bucket_name = f"{GCP_PROJECT_ID}-sft-data"
        blob_name = f"sft/{os.path.basename(dataset_path)}"

        client = storage.Client(project=GCP_PROJECT_ID)
        try:
            bucket = client.get_bucket(bucket_name)
        except Exception:
            bucket = client.create_bucket(bucket_name, location=GCP_REGION)
            logger.info(f"Created GCS bucket: {bucket_name}")

        blob = bucket.blob(blob_name)
        blob.upload_from_filename(dataset_path)
        gcs_uri = f"gs://{bucket_name}/{blob_name}"
        logger.info(f"📤 Uploaded training data to {gcs_uri}")

        # Launch tuning job
        tuning_job = sft_tuning.train(
            source_model="gemini-1.5-flash-002",
            train_dataset=gcs_uri,
            tuned_model_display_name=tuned_model_name,
            epochs=3,
            learning_rate_multiplier=1.0,
        )

        logger.info(f"🚀 Tuning job launched: {tuning_job.resource_name}")
        logger.info(f"   Model name: {tuned_model_name}")
        logger.info(f"   Monitor at: https://console.cloud.google.com/vertex-ai/training/training-pipelines?project={GCP_PROJECT_ID}")

        return tuning_job

    except Exception as e:
        logger.error(f"❌ Failed to launch tuning job: {e}")
        raise


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    print("🎓 Supply Chain Risk — SFT Dataset Generator")
    print("=" * 50)
    
    # Step A+B: Generate + format
    path = generate_sft_dataset(total_examples=200)
    print(f"\n📄 Dataset ready at: {path}")
    
    # Step C: Launch tuning (only if real Vertex)
    from config import USE_REAL_VERTEX
    if USE_REAL_VERTEX:
        response = input("\nLaunch fine-tuning job on Vertex AI? (y/n): ")
        if response.lower() == "y":
            launch_tuning_job(path)
    else:
        print("ℹ️  Skipping tuning job — USE_REAL_VERTEX is False")
