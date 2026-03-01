"""
Multi-Agent Debate — Logistics Agent & Finance Agent personas.
Each agent analyzes disruption context and produces structured recommendations.
Agents accept risk_appetite to weight their priorities accordingly.
"""

from services.vertex_simulator import vertex_ai
from config import RISK_APPETITE_PROFILES


class LogisticsAgent:
    """Optimizes for speed, rerouting, and service level targets."""

    name = "Logistics Agent"
    icon = "truck"

    def analyze(self, context):
        """
        Analyze disruption from logistics perspective.
        Calculates lead-time sensitivity shifts (days gained/lost per reroute option).
        """
        risk_appetite = context.get("risk_appetite", "balanced")
        profile = RISK_APPETITE_PROFILES.get(risk_appetite, RISK_APPETITE_PROFILES["balanced"])

        analysis = vertex_ai.generate_response(
            prompt=f"Logistics analysis for: {context.get('signal', '')}",
            persona="logistics_agent",
            context={
                "affected_suppliers": context.get("affected_suppliers", []),
                "blast_radius": context.get("blast_radius", {}),
                "signal": context.get("signal", ""),
                "risk_appetite": risk_appetite,
                "past_lessons": context.get("past_lessons", []),
            }
        )

        # Apply risk appetite weighting
        analysis["risk_appetite_applied"] = risk_appetite
        analysis["speed_weight"] = profile["speed_weight"]

        return analysis


class FinanceAgent:
    """Optimizes for cost, margins, SLA penalties, and contract risk."""

    name = "Finance Agent"
    icon = "dollar-sign"

    def analyze(self, context):
        """
        Analyze disruption from financial perspective.
        Simulates SLA penalty costs vs. expedited shipping costs with dollar breakdowns.
        """
        risk_appetite = context.get("risk_appetite", "balanced")
        profile = RISK_APPETITE_PROFILES.get(risk_appetite, RISK_APPETITE_PROFILES["balanced"])

        analysis = vertex_ai.generate_response(
            prompt=f"Financial analysis for: {context.get('signal', '')}",
            persona="finance_agent",
            context={
                "affected_suppliers": context.get("affected_suppliers", []),
                "blast_radius": context.get("blast_radius", {}),
                "signal": context.get("signal", ""),
                "risk_appetite": risk_appetite,
                "past_lessons": context.get("past_lessons", []),
            }
        )

        # Apply risk appetite weighting
        analysis["risk_appetite_applied"] = risk_appetite
        analysis["cost_weight"] = profile["cost_weight"]

        return analysis


# Agent instances
logistics_agent = LogisticsAgent()
finance_agent = FinanceAgent()
