"""
Ingestion Pipeline — Text chunking, embedding generation, signal classification.
Simulates a Cloud Run function for processing news/ERP signals into the knowledge graph.
"""

from services.spanner_simulator import graph_db
from services.vertex_simulator import vertex_ai

# Minimum cosine similarity to consider a supplier "affected"
VECTOR_MATCH_THRESHOLD = 0.75


def ingest_signal(text, signal_type="news"):
    """
    Ingest a raw signal: chunk text, generate embeddings, link to relevant suppliers.
    Returns the classified signal with metadata.
    """
    # Step 1: Classify the signal
    classification = vertex_ai.generate_response(text, persona="classifier")

    # Step 2: Generate embedding for the full signal
    embedding = vertex_ai.generate_embedding(text)

    # Step 3: Find relevant suppliers via vector search (with similarity threshold)
    all_matches = graph_db.vector_search(embedding, node_type="Supplier", top_k=8)
    relevant_suppliers = [m for m in all_matches if m["similarity"] >= VECTOR_MATCH_THRESHOLD]

    # Step 4: Match by country/keyword from classification
    # Use country-level matching, not broad region, to avoid false positives
    region_matched = []
    detected_region = classification.get("region")
    detected_keywords = classification.get("keywords", [])
    signal_lower = text.lower()

    if detected_region:
        for sup in graph_db.get_all_nodes("Supplier"):
            # Already matched by vector search? Skip.
            if any(r["node"]["id"] == sup["id"] for r in relevant_suppliers):
                continue

            sup_country = sup.get("country", "").lower()
            sup_region = sup.get("region", "")
            
            # Map demonyms to country names for better matching
            demonym_map = {"german": "germany", "french": "france", "chinese": "china", "japanese": "japan", "indian": "india", "mexican": "mexico", "taiwanese": "taiwan"}
            
            # Direct country mention in signal text = strong match
            if sup_country and (sup_country in signal_lower or any(d in signal_lower for d, c in demonym_map.items() if c == sup_country)):
                region_matched.append(sup)
            # Region match only if country is also mentioned or region is very specific (South Asia = 1 supplier)
            elif sup_region == detected_region:
                # Count how many suppliers share this region
                same_region_count = sum(
                    1 for s in graph_db.get_all_nodes("Supplier")
                    if s.get("region") == detected_region
                )
                # Auto-match if it's a narrow region (≤2) OR if the region name itself is explicitly in the text
                if same_region_count <= 2 or detected_region.lower() in signal_lower:
                    region_matched.append(sup)

    # Step 5: Store signal as a node
    signal_id = graph_db.add_node("Signal", properties={
        "text": text,
        "type": signal_type,
        "category": classification["category"],
        "severity": classification["severity"],
        "region": classification.get("region"),
        "keywords": classification.get("keywords", []),
        "embedding": embedding,
        "source_label": classification.get("source_label", f"Signal: {text[:60]}"),
    })

    # Step 6: Link signal to matched suppliers
    affected_supplier_ids = []
    for match in relevant_suppliers:
        sup = match["node"]
        graph_db.add_edge("Signal", signal_id, "Supplier", sup["id"], "AFFECTS", {
            "similarity": round(match["similarity"], 3),
            "match_type": "vector",
        })
        affected_supplier_ids.append(sup["id"])

    for sup in region_matched:
        graph_db.add_edge("Signal", signal_id, "Supplier", sup["id"], "AFFECTS", {
            "match_type": "region",
        })
        if sup["id"] not in affected_supplier_ids:
            affected_supplier_ids.append(sup["id"])

    return {
        "signal_id": signal_id,
        "classification": classification,
        "affected_supplier_ids": affected_supplier_ids,
        "affected_suppliers": [
            graph_db.get_node("Supplier", sid) for sid in affected_supplier_ids
        ],
    }


def classify_signal(text):
    """Quick classification without full ingestion."""
    return vertex_ai.generate_response(text, persona="classifier")
