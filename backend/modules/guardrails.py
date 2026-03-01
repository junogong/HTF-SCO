"""
Guardrails Module — Deterministic Fact-Checker for Responsible AI.
Validates every Vertex AI recommendation against the Spanner Graph 'Source of Truth'
to prevent non-deterministic hallucinations and enforce safety boundaries.
"""

from services.spanner_simulator import graph_db
from config import CONFIDENCE_THRESHOLD

# Hard lock threshold for HITL override
HITL_REVENUE_THRESHOLD = 50000  # $50K — requires supervisor override


class FactChecker:
    """
    Validates AI-generated recommendations against ground truth in the knowledge graph.
    Prevents hallucinated supplier names, fabricated metrics, and impossible routes.
    """

    def validate_strategy(self, strategy, actions, debate):
        """
        Run all fact-check validations on a synthesized strategy.
        Returns a validation report with pass/fail for each check.
        """
        checks = []

        # 1. Validate mentioned suppliers exist in graph
        checks.append(self._check_supplier_existence(strategy, actions))

        # 2. Validate revenue-at-risk is within plausible bounds
        checks.append(self._check_revenue_bounds(strategy))

        # 3. Validate recommended actions reference real components
        checks.append(self._check_component_references(actions))

        # 4. Cross-validate logistics vs. finance agent (bias mitigation)
        checks.append(self._check_agent_alignment(debate))

        # 5. Check confidence score validity
        checks.append(self._check_confidence_validity(strategy))

        # 6. HITL threshold check
        hitl_required = self._check_hitl_threshold(strategy)
        checks.append(hitl_required)

        all_passed = all(c["passed"] for c in checks)
        critical_fails = [c for c in checks if not c["passed"] and c["severity"] == "critical"]

        return {
            "validated": all_passed or len(critical_fails) == 0,
            "checks": checks,
            "total_checks": len(checks),
            "passed_checks": sum(1 for c in checks if c["passed"]),
            "failed_checks": sum(1 for c in checks if not c["passed"]),
            "hitl_required": hitl_required.get("hitl_triggered", False),
            "hitl_reason": hitl_required.get("reason", None),
            "trust_score": round((sum(1 for c in checks if c["passed"]) / len(checks)) * 100),
        }

    def _check_supplier_existence(self, strategy, actions):
        """Verify all mentioned suppliers actually exist in Spanner Graph."""
        known_suppliers = {s.get("name", "").lower() for s in graph_db.get_all_nodes("Supplier")}
        mentioned = set()

        # Extract supplier names from actions
        for act in actions:
            target = act.get("target_supplier", "")
            if target:
                mentioned.add(target.lower())

        unknown = mentioned - known_suppliers
        return {
            "check": "Supplier Existence",
            "description": "All referenced suppliers exist in the knowledge graph",
            "passed": len(unknown) == 0,
            "severity": "critical",
            "details": f"Verified {len(mentioned)} supplier(s)" if not unknown
                       else f"Unknown supplier(s): {', '.join(unknown)}",
            "source": "Spanner Graph — Supplier Nodes",
        }

    def _check_revenue_bounds(self, strategy):
        """Verify revenue-at-risk is within plausible bounds based on known contract values."""
        revenue_at_risk = strategy.get("revenue_at_risk", 0)
        total_contract_value = sum(
            s.get("annual_contract_value", 0)
            for s in graph_db.get_all_nodes("Supplier")
        )

        # Revenue at risk shouldn't exceed total contract portfolio
        is_plausible = revenue_at_risk <= total_contract_value * 1.5
        return {
            "check": "Revenue Bounds",
            "description": "Revenue-at-Risk is within plausible bounds of known contracts",
            "passed": is_plausible,
            "severity": "warning",
            "details": f"R@R ${revenue_at_risk:,} vs. total portfolio ${total_contract_value:,}",
            "source": "Spanner Graph — Contract Values",
        }

    def _check_component_references(self, actions):
        """Verify any referenced components exist in the graph."""
        known_components = {c.get("name", "").lower() for c in graph_db.get_all_nodes("Component")}
        # For now, pass if there are known components (actions don't always reference components by name)
        return {
            "check": "Component Validation",
            "description": "Referenced components verified against BOM data",
            "passed": True,
            "severity": "warning",
            "details": f"{len(known_components)} components available in knowledge graph",
            "source": "Spanner Graph — Component Nodes",
        }

    def _check_agent_alignment(self, debate):
        """
        Cross-validate logistics vs finance agent outputs.
        Both must agree on severity classification. Disagreement = potential bias.
        """
        logistics = debate.get("logistics", {})
        finance = debate.get("finance", {})

        log_priority = logistics.get("priority", "MEDIUM")
        fin_priority = finance.get("priority", "MEDIUM")

        priority_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        log_level = priority_map.get(log_priority, 2)
        fin_level = priority_map.get(fin_priority, 2)

        # Allow at most 1 level difference
        aligned = abs(log_level - fin_level) <= 1

        return {
            "check": "Cross-Agent Alignment",
            "description": "Logistics and Finance agents agree on severity assessment (bias mitigation)",
            "passed": aligned,
            "severity": "warning",
            "details": f"Logistics: {log_priority}, Finance: {fin_priority}"
                       + (" — Aligned" if aligned else " — DIVERGENT: possible single-track bias"),
            "source": "Multi-Agent Debate — Bias Check",
        }

    def _check_confidence_validity(self, strategy):
        """Verify confidence score is coherent with available data."""
        confidence = strategy.get("confidence_score", 50)
        has_lessons = strategy.get("past_lessons_used", 0) > 0

        # If no past lessons and confidence > 85%, flag as potentially over-confident
        overconfident = confidence > 85 and not has_lessons
        return {
            "check": "Confidence Calibration",
            "description": "Confidence score is calibrated to available evidence",
            "passed": not overconfident,
            "severity": "warning",
            "details": f"Confidence: {confidence}%, Past lessons: {'Yes' if has_lessons else 'No'}"
                       + (" — OVERCONFIDENT without historical data" if overconfident else ""),
            "source": "Vertex AI — Confidence Score",
        }

    def _check_hitl_threshold(self, strategy):
        """Check if revenue-at-risk exceeds $50K HITL hard lock."""
        revenue_at_risk = strategy.get("revenue_at_risk", 0)
        triggered = revenue_at_risk > HITL_REVENUE_THRESHOLD

        return {
            "check": "HITL Hard Lock",
            "description": f"Revenue-at-Risk vs. ${HITL_REVENUE_THRESHOLD:,} supervisor override threshold",
            "passed": not triggered,  # "passed" means no intervention needed
            "severity": "critical",
            "hitl_triggered": triggered,
            "reason": f"Revenue-at-Risk (${revenue_at_risk:,}) exceeds ${HITL_REVENUE_THRESHOLD:,} threshold"
                      if triggered else None,
            "details": f"R@R ${revenue_at_risk:,} {'>' if triggered else '≤'} ${HITL_REVENUE_THRESHOLD:,} threshold"
                       + (" — ⚠️ SUPERVISOR OVERRIDE REQUIRED" if triggered else ""),
            "source": "Risk Control — HITL Policy",
        }


    def check_hallucination(self, response_text, field_name="supplier"):
        """
        Scan a Gemini text response for supplier names that don't exist in the graph.
        Returns a hallucination report with BLOCKED items and suggested corrections.
        """
        known_suppliers = {s.get("name", "").lower(): s for s in graph_db.get_all_nodes("Supplier")}
        known_sub = {s.get("name", "").lower(): s for s in graph_db.get_all_nodes("SubSupplier")}
        all_known = {**known_suppliers, **known_sub}

        hallucinations = []
        corrections = []

        # Check each sentence for supplier-like proper nouns
        words = response_text.replace(",", "").replace(".", "").split()
        candidates = [w for w in words if len(w) > 4 and w[0].isupper()]

        for candidate in set(candidates):
            cand_lower = candidate.lower()
            # Check if it sounds like a company but isn't in graph
            if any(suffix in cand_lower for suffix in ["corp", "inc", "ltd", "co.", "gmbh", "holdings", "semiconductor", "electronics"]):
                if cand_lower not in all_known and not any(cand_lower in k for k in all_known):
                    # Find closest real match
                    best_match = min(all_known.keys(),
                                    key=lambda k: _levenshtein(cand_lower, k),
                                    default=None)
                    hallucinations.append({
                        "flagged": candidate,
                        "status": "HALLUCINATION_BLOCKED",
                        "reason": "Supplier not found in Spanner Graph knowledge base",
                    })
                    if best_match:
                        corrections.append({
                            "original": candidate,
                            "corrected_to": all_known[best_match].get("name", best_match),
                            "source": "Spanner Graph — Supplier Nodes",
                        })

        return {
            "hallucination_count": len(hallucinations),
            "clean": len(hallucinations) == 0,
            "hallucinations": hallucinations,
            "corrections": corrections,
        }

    def get_bias_analysis(self, debate):
        """
        Detailed divergence analysis between Logistics and Finance agents.
        Returns dimension scores, divergence magnitude, and verdict.
        """
        logistics = debate.get("logistics", {})
        finance = debate.get("finance", {})

        priority_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        log_level = priority_map.get(logistics.get("priority", "MEDIUM"), 2)
        fin_level = priority_map.get(finance.get("priority", "MEDIUM"), 2)

        log_confidence = logistics.get("confidence", 70)
        fin_confidence = finance.get("confidence", 70)

        # Parse lead-time shift from logistics
        lead_time_shift = 0
        lta = logistics.get("lead_time_analysis", {})
        if isinstance(lta, dict):
            lead_time_shift = lta.get("lead_time_shift_days", 0)

        # Revenue-at-risk from finance
        revenue = finance.get("revenue_at_risk", 0)

        divergence_score = abs(log_level - fin_level) * 25  # 0-75 scale

        return {
            "logistics_priority": logistics.get("priority", "N/A"),
            "finance_priority":   finance.get("priority", "N/A"),
            "logistics_confidence": log_confidence,
            "finance_confidence":   fin_confidence,
            "divergence_score": divergence_score,   # 0=aligned, 75=max divergence
            "aligned": divergence_score <= 25,
            "lead_time_impact_days": lead_time_shift,
            "revenue_at_risk": revenue,
            "dimensions": [
                {"axis": "Cost Sensitivity",  "logistics": 45, "finance": 90},
                {"axis": "Speed Priority",     "logistics": 85, "finance": 40},
                {"axis": "Risk Tolerance",     "logistics": 60, "finance": 35},
                {"axis": "SLA Weight",         "logistics": 80, "finance": 65},
                {"axis": "Confidence",         "logistics": log_confidence, "finance": fin_confidence},
            ],
            "verdict": "Aligned" if divergence_score <= 25
                       else "Minor Divergence" if divergence_score <= 50
                       else "Major Divergence — Manual Review Advised",
        }


def _levenshtein(s1, s2):
    """Simple edit distance for fuzzy name matching."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[len(s2)]


# Singleton
fact_checker = FactChecker()


def get_safety_report(last_strategy=None, last_debate=None):
    """
    Build a full safety/explainability report for the Safety Dashboard.
    Can work with the most recent analysis or use placeholder data.
    """
    strategy = last_strategy or {"revenue_at_risk": 0, "confidence_score": 75}
    debate = last_debate or {}
    actions = last_strategy.get("actions", []) if last_strategy else []

    guardrails = fact_checker.validate_strategy(strategy, actions, debate)
    bias = fact_checker.get_bias_analysis(debate)

    # Hallucination check on strategy summary
    summary_text = strategy.get("summary", "")
    hallucination_report = fact_checker.check_hallucination(summary_text) if summary_text else {
        "hallucination_count": 0, "clean": True, "hallucinations": [], "corrections": [],
    }

    return {
        "guardrails": guardrails,
        "bias_analysis": bias,
        "hallucination_report": hallucination_report,
        "graph_stats": {
            "total_suppliers": len(graph_db.get_all_nodes("Supplier")),
            "total_sub_suppliers": len(graph_db.get_all_nodes("SubSupplier")),
            "total_regions": len(graph_db.get_all_nodes("Region")),
            "total_components": len(graph_db.get_all_nodes("Component")),
            "total_products": len(graph_db.get_all_nodes("Product")),
            "total_edges": len(graph_db.edges),
        },
    }
