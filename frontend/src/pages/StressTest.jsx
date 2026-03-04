import { useState } from 'react';
import api from '../api/client';
import { Wind, Play, AlertTriangle, TrendingUp, Package, ChevronDown, ChevronRight, Zap, CheckCircle } from 'lucide-react';

const PROB_COLOR = { high: '#ef4444', medium: '#f97316', low: '#eab308' };
const CAT_COLOR = { geopolitical: '#a855f7', weather: '#06b6d4', financial: '#22c55e', logistics: '#f97316', quality: '#eab308' };

export default function StressTest({
    onAcceptScenario,
    stressTestResult: result,
    setStressTestResult: setResult,
    acceptedScenarios,
    setAcceptedScenarios
}) {
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(null);

    const run = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await api.post('/simulate/stress-test');
            setResult(res.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Digital Wind Tunnel
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Monte Carlo stress-testing — simulate black-swan scenarios before they happen
                    </p>
                </div>
                <button className="btn-primary" onClick={run} disabled={loading}>
                    {loading ? <div className="spinner" /> : <><Play size={16} /> Run Simulation</>}
                </button>
            </div>

            {loading && (
                <div className="glass-card flex flex-col items-center justify-center py-16 gap-4">
                    <div className="spinner" style={{ width: 48, height: 48 }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Gemini is generating black-swan scenarios and running blast radius analysis...
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This may take 20-40 seconds</p>
                </div>
            )}

            {result && (
                <div className="space-y-5">
                    {/* Summary KPIs */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="glass-card text-center py-5">
                            <p className="text-3xl font-black text-red-400">${(result.total_revenue_exposed / 1e6).toFixed(1)}M</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total Revenue Exposed</p>
                        </div>
                        <div className="glass-card text-center py-5">
                            <p className="text-3xl font-black text-amber-400">{result.scenarios?.length ?? 0}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Scenarios Simulated</p>
                        </div>
                        <div className="glass-card text-center py-5">
                            <p className="text-sm font-bold text-purple-400 leading-tight px-2">{result.highest_risk_scenario}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Highest Risk Scenario</p>
                        </div>
                    </div>

                    {/* Critical Failure Points */}
                    {result.critical_failure_points?.length > 0 && (
                        <div className="glass-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle size={18} className="text-red-400" />
                                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                                    Top Critical Failure Points
                                </h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">Pre-emptive Action Required</span>
                            </div>
                            <div className="space-y-3">
                                {result.critical_failure_points.map((cfp, i) => (
                                    <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                                                    #{i + 1} — {cfp.supplier?.name}
                                                </p>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {cfp.supplier?.country} · Appears in {cfp.appears_in_scenarios} scenario{cfp.appears_in_scenarios !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-red-400">${(cfp.cumulative_revenue_at_risk / 1e6).toFixed(1)}M</p>
                                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>cumulative exposure</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>
                                            <Zap size={12} className="inline mr-1" />
                                            {cfp.recommendation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Scenario Results */}
                    <div className="glass-card">
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                            Scenario Results — Ranked by Revenue Exposure
                        </h3>
                        <div className="space-y-2">
                            {result.scenarios?.map((s, i) => (
                                <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                    <button
                                        className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-white/5"
                                        style={{ background: 'var(--bg-secondary)' }}
                                        onClick={() => setExpanded(expanded === i ? null : i)}
                                    >
                                        <span className="text-xs font-mono font-bold w-6 text-center" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                                    style={{ background: `${CAT_COLOR[s.category] ?? '#6366f1'}20`, color: CAT_COLOR[s.category] ?? '#6366f1' }}>
                                                    {s.category}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                                    style={{ background: `${PROB_COLOR[s.probability] ?? '#6366f1'}20`, color: PROB_COLOR[s.probability] ?? '#6366f1' }}>
                                                    {s.probability} probability
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right mr-2">
                                            <p className="font-black text-red-400 text-sm">${((s.revenue_at_risk ?? 0) / 1e6).toFixed(1)}M</p>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.tier1_suppliers_impacted ?? 0} suppliers hit</p>
                                        </div>
                                        {expanded === i ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                                    </button>

                                    {expanded === i && (
                                        <div className="p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border)' }}>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>
                                            <p className="text-xs font-mono p-2 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                                Signal: "{s.signal}"
                                            </p>
                                            {s.affected_tier1?.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Tier-1 Suppliers Impacted:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {s.affected_tier1.map((t, j) => (
                                                            <span key={j} className="text-xs px-2 py-1 rounded-lg font-medium"
                                                                style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                                                                {t.name} ({t.country})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {s.preemptive_actions?.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Pre-emptive Actions:</p>
                                                    {s.preemptive_actions.map((a, j) => (
                                                        <div key={j} className="text-xs p-2 rounded" style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>
                                                            <Package size={11} className="inline mr-1" />{a.title} — {a.timeline}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* Accept scenario button */}
                                    <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                                        {acceptedScenarios.has(i) ? (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                                <CheckCircle size={14} /> Accepted — Sent to Action Center
                                            </span>
                                        ) : (
                                            <button
                                                className="btn-primary text-xs py-2 px-4"
                                                onClick={() => {
                                                    // Build a disruption-shaped result from the scenario
                                                    const disruptionResult = {
                                                        source: 'wind-tunnel',
                                                        strategy_id: `wind-tunnel-${Date.now()}-${i}`,
                                                        classification: {
                                                            category: s.category || 'stress-test',
                                                            severity: s.probability === 'high' ? 'critical' : 'moderate',
                                                            region: s.affected_region || 'Global',
                                                        },
                                                        strategy: {
                                                            name: `[Wind Tunnel] ${s.name}`,
                                                            summary: s.description,
                                                            revenue_at_risk: s.revenue_at_risk || 0,
                                                            confidence_score: 75,
                                                        },
                                                        wind_tunnel_reasoning: {
                                                            scenario_name: s.name,
                                                            description: s.description,
                                                            category: s.category,
                                                            probability: s.probability,
                                                            signal: s.signal,
                                                            affected_region: s.affected_region || 'Global',
                                                            tier1_impact: (s.affected_tier1 || []).map(t => `${t.name} (${t.country})`),
                                                            preemptive_actions: s.preemptive_actions || [],
                                                            revenue_at_risk: s.revenue_at_risk || 0,
                                                            products_at_risk: s.products_at_risk || 0,
                                                        },
                                                        affected_suppliers: (s.affected_tier1 || []).map(t => ({
                                                            id: `sup-${t.name?.toLowerCase().split(' ')[0]}`,
                                                            name: t.name,
                                                            country: t.country,
                                                            health_score: t.health_score || 70,
                                                        })),
                                                        blast_radius: {
                                                            products_at_risk: s.products_at_risk || 0,
                                                            tier1_suppliers: s.affected_tier1 || [],
                                                        },
                                                        actions: (s.preemptive_actions || []).map((a, j) => ({
                                                            id: `wt-action-${Date.now()}-${j}`,
                                                            type: 'preemptive_stock_build',
                                                            title: a.title,
                                                            description: a.description || a.title,
                                                            priority: 'High',
                                                            timeline: a.timeline,
                                                        })),
                                                        reasoning_trace: [
                                                            { step: 'Wind Tunnel Simulation', detail: `Generated from stress test scenario: ${s.name}`, duration_ms: 0 },
                                                        ],
                                                        debate: null,
                                                        guardrails: { trust_score: 75, validated: true, checks: [] },
                                                        total_duration_ms: 0,
                                                        past_lessons_used: 0,
                                                    };
                                                    onAcceptScenario?.(disruptionResult);
                                                    setAcceptedScenarios(prev => new Set([...prev, i]));
                                                }}
                                            >
                                                <Zap size={14} /> Accept & Send to Action Center
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!result && !loading && (
                <div className="glass-card flex flex-col items-center justify-center py-20 gap-4">
                    <Wind size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Run the simulation to generate black-swan scenarios and identify critical failure points
                    </p>
                </div>
            )}
        </div>
    );
}
