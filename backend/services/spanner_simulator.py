"""
Spanner Graph Simulator — In-memory graph database.
Simulates Google Cloud Spanner Graph with nodes, edges, vector search, and GQL-style traversal.
Drop-in replacement: swap this import for google.cloud.spanner to use real Spanner.
"""

import uuid
import math
from collections import deque


class SpannerGraphSimulator:
    """In-memory graph store with BFS traversal and cosine-similarity vector search."""

    def __init__(self):
        # nodes[node_type][node_id] = {properties}
        self.nodes = {}
        # edges = [{id, source_type, source_id, target_type, target_id, edge_type, properties}]
        self.edges = []
        # Company-level settings
        self.company_settings = {
            "risk_appetite": "balanced",
            "revenue_at_risk_threshold": 500000,
            "sla_penalty_per_day": 2500,
        }

    # ── Node operations ──────────────────────────────────────────────

    def add_node(self, node_type, node_id=None, properties=None):
        node_id = node_id or str(uuid.uuid4())[:8]
        if node_type not in self.nodes:
            self.nodes[node_type] = {}
        self.nodes[node_type][node_id] = {
            "id": node_id,
            "type": node_type,
            **(properties or {}),
        }
        return node_id

    def get_node(self, node_type, node_id):
        return self.nodes.get(node_type, {}).get(node_id)

    def get_all_nodes(self, node_type=None):
        if node_type:
            return list(self.nodes.get(node_type, {}).values())
        all_nodes = []
        for ntype in self.nodes:
            all_nodes.extend(self.nodes[ntype].values())
        return all_nodes

    def update_node(self, node_type, node_id, properties):
        node = self.get_node(node_type, node_id)
        if node:
            node.update(properties)
        return node

    # ── Edge operations ──────────────────────────────────────────────

    def add_edge(self, source_type, source_id, target_type, target_id, edge_type, properties=None):
        edge = {
            "id": str(uuid.uuid4())[:8],
            "source_type": source_type,
            "source_id": source_id,
            "target_type": target_type,
            "target_id": target_id,
            "edge_type": edge_type,
            "properties": properties or {},
        }
        self.edges.append(edge)
        return edge["id"]

    def get_edges(self, source_type=None, source_id=None, edge_type=None):
        results = []
        for e in self.edges:
            if source_type and e["source_type"] != source_type:
                continue
            if source_id and e["source_id"] != source_id:
                continue
            if edge_type and e["edge_type"] != edge_type:
                continue
            results.append(e)
        return results

    # ── Graph queries ────────────────────────────────────────────────

    def query_neighbors(self, node_type, node_id, edge_type=None, direction="outgoing"):
        neighbors = []
        for e in self.edges:
            if direction in ("outgoing", "both"):
                if e["source_type"] == node_type and e["source_id"] == node_id:
                    if edge_type is None or e["edge_type"] == edge_type:
                        target = self.get_node(e["target_type"], e["target_id"])
                        if target:
                            neighbors.append({"edge": e, "node": target})
            if direction in ("incoming", "both"):
                if e["target_type"] == node_type and e["target_id"] == node_id:
                    if edge_type is None or e["edge_type"] == edge_type:
                        source = self.get_node(e["source_type"], e["source_id"])
                        if source:
                            neighbors.append({"edge": e, "node": source})
        return neighbors

    def traverse_tiered_blast_radius(self, start_id, start_type="Supplier", max_depth=4):
        """
        Recursive BFS from ANY node type (Region, SubSupplier, Supplier) outward.
        Identifies Tier-1 suppliers at risk and end-products affected.
        Returns: affected_tier1_suppliers, products_at_risk, risk_path, revenue_at_risk.
        """
        visited = set()
        queue = deque([(start_type, start_id, 0, [f"{start_type}:{start_id}"])])
        visited.add((start_type, start_id))

        tier1_suppliers = []   # Supplier nodes reached
        products = []          # Product nodes reached
        components = []        # Component nodes reached
        risk_paths = []        # How disruption flows
        all_edges = []

        while queue:
            cur_type, cur_id, depth, path = queue.popleft()
            if depth >= max_depth:
                continue

            for e in self.edges:
                # Follow edges both ways to trace the disruption path
                next_type = next_id = None
                if e["source_type"] == cur_type and e["source_id"] == cur_id:
                    next_type, next_id = e["target_type"], e["target_id"]
                elif e["target_type"] == cur_type and e["target_id"] == cur_id:
                    # Only follow backwards for sub-supplier → supplier linkage
                    if e["edge_type"] == "SOURCES_FROM":
                        next_type, next_id = e["source_type"], e["source_id"]

                if next_type and next_id and (next_type, next_id) not in visited:
                    visited.add((next_type, next_id))
                    node = self.get_node(next_type, next_id)
                    if not node:
                        continue
                    new_path = path + [f"{next_type}:{next_id}({node.get('name','?')})"]  
                    all_edges.append(e)

                    if next_type == "Supplier":
                        safe = {k: v for k, v in node.items() if k != "embedding"}
                        safe["risk_path"] = " → ".join(new_path)
                        tier1_suppliers.append(safe)
                        risk_paths.append(new_path)
                        queue.append((next_type, next_id, depth + 1, new_path))
                    elif next_type == "Component":
                        components.append({k: v for k, v in node.items() if k != "embedding"})
                        queue.append((next_type, next_id, depth + 1, new_path))
                    elif next_type == "Product":
                        products.append({k: v for k, v in node.items() if k != "embedding"})
                    elif next_type in ("SubSupplier", "Region"):
                        queue.append((next_type, next_id, depth + 1, new_path))

        revenue_at_risk = sum(p.get("annual_revenue", 0) for p in products)
        return {
            "tier1_suppliers": tier1_suppliers,
            "affected_components": components,
            "products_at_risk": products,
            "revenue_at_risk": revenue_at_risk,
            "risk_paths": risk_paths,
            "affected_edges": all_edges,
            "deepest_tier": max_depth,
        }

    def find_nodes_by_region(self, region_name):
        """Return all SubSupplier/Supplier nodes located in or associated with a region."""
        region_lower = region_name.lower()
        matches = []
        for node in self.get_all_nodes():
            country = node.get("country", "").lower()
            region = node.get("region", "").lower()
            if region_lower in country or region_lower in region:
                matches.append(node)
        return matches

    def traverse_blast_radius(self, supplier_id):
        """
        BFS from a supplier node through all connected components and products.
        Returns the full impact subgraph: affected nodes and edges.
        """
        visited_nodes = set()
        visited_edges = []
        affected_nodes = []

        queue = deque([("Supplier", supplier_id)])
        visited_nodes.add(("Supplier", supplier_id))

        supplier = self.get_node("Supplier", supplier_id)
        if supplier:
            affected_nodes.append(supplier)

        while queue:
            current_type, current_id = queue.popleft()

            for e in self.edges:
                # Forward traversal only (downstream impact: Supplier -> Component -> Product)
                if e["source_type"] == current_type and e["source_id"] == current_id:
                    key = (e["target_type"], e["target_id"])
                    if key not in visited_nodes:
                        visited_nodes.add(key)
                        target = self.get_node(e["target_type"], e["target_id"])
                        if target:
                            affected_nodes.append(target)
                            visited_edges.append(e)
                            queue.append(key)

        return {
            "affected_nodes": affected_nodes,
            "affected_edges": visited_edges,
            "total_affected": len(affected_nodes),
        }

    # ── Vector search ────────────────────────────────────────────────

    def vector_search(self, query_embedding, node_type=None, top_k=5):
        """Cosine similarity search across node embeddings."""
        results = []
        candidates = self.get_all_nodes(node_type)

        for node in candidates:
            emb = node.get("embedding")
            if emb:
                sim = self._cosine_similarity(query_embedding, emb)
                results.append({"node": node, "similarity": sim})

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    @staticmethod
    def _cosine_similarity(a, b):
        if len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    # ── Serialization ────────────────────────────────────────────────

    def to_graph_json(self):
        """Return the full graph as {nodes, edges} for frontend visualization."""
        all_nodes = []
        for ntype in self.nodes:
            for nid, node in self.nodes[ntype].items():
                serialized = {k: v for k, v in node.items() if k != "embedding"}
                all_nodes.append(serialized)

        all_edges = []
        for e in self.edges:
            all_edges.append({
                "id": e["id"],
                "source": e["source_id"],
                "target": e["target_id"],
                "source_type": e["source_type"],
                "target_type": e["target_type"],
                "edge_type": e["edge_type"],
                "properties": e["properties"],
            })

        return {"nodes": all_nodes, "edges": all_edges}


# Singleton instance
graph_db = SpannerGraphSimulator()
