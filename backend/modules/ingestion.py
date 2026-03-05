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

    # Step 4: Match by country from classification
    country_matched = []
    detected_countries = classification.get("affected_countries", [])
    
    if detected_countries:
        detected_countries_lower = [c.lower() for c in detected_countries]
        for sup in graph_db.get_all_nodes("Supplier"):
            # Already matched by vector search? Skip.
            if any(r["node"]["id"] == sup["id"] for r in relevant_suppliers):
                continue

            sup_country = sup.get("country", "").lower()
            
            # Direct country match based on the AI classifier's explicit extraction
            if sup_country and sup_country in detected_countries_lower:
                country_matched.append(sup)

    # Step 5: Store signal as a node
    signal_id = graph_db.add_node("Signal", properties={
        "text": text,
        "type": signal_type,
        "category": classification["category"],
        "severity": classification["severity"],
        "affected_countries": classification.get("affected_countries", []),
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

    for sup in country_matched:
        graph_db.add_edge("Signal", signal_id, "Supplier", sup["id"], "AFFECTS", {
            "match_type": "country",
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
