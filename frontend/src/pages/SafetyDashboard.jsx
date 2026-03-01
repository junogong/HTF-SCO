import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Brain, GitMerge, Activity, CheckCircle, XCircle, Zap, Eye, BarChart2 } from 'lucide-react';
import api from '../api/client';

const PRIORITY_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };

export default function SafetyDashboard() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('guardrails');

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get('/safety');
            setReport(res.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
    );

    if (!report) return null;

    const { guardrails, bias_analysis, hallucination_report, graph_stats } = report;
    const trustScore = guardrails?.trust_score ?? 0;
    const trustColor = trustScore >= 80 ? '#22c55e' : trustScore >= 60 ? '#eab308' : '#ef4444';

    const tabs = [
        { id: 'guardrails', label: 'Guardrail Checks', icon: ShieldCheck },
        { id: 'hallucination', label: 'Hallucination Log', icon: Eye },
        { id: 'debate', label: 'Agent Debate', icon: GitMerge },
        { id: 'graph', label: 'Graph Vitals', icon: Activity },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Responsible AI Dashboard
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Internal vitals — explainability, safety checks, and agent bias monitoring
                </p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Trust Score Gauge */}
                <div className="glass-card col-span-2 flex flex-col items-center justify-center py-6">
                    <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>AI Trust Score</p>
                    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                        <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                            <circle cx="60" cy="60" r="50" fill="none" stroke={trustColor} strokeWidth="12"
                                strokeDasharray={`${(trustScore / 100) * 314} 314`}
                                strokeDashoffset="78.5" strokeLinecap="round"
                                style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <div className="absolute text-center">
                            <p className="text-3xl font-black" style={{ color: trustColor }}>{trustScore}%</p>
                        </div>
                    </div>
                    <p className="text-sm font-semibold mt-2" style={{ color: trustColor }}>
                        {trustScore >= 80 ? 'Trusted' : trustScore >= 60 ? 'Requires Attention' : 'Low Trust'}
                    </p>
                </div>

                <div className="glass-card flex flex-col justify-center items-center py-6 gap-1">
                    <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Guardrails Passed</p>
                    <p className="text-4xl font-black" style={{ color: '#22c55e' }}>{guardrails?.passed_checks ?? 0}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>of {guardrails?.total_checks ?? 0} checks</p>
                </div>

                <div className="glass-card flex flex-col justify-center items-center py-6 gap-1">
                    <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Hallucinations Blocked</p>
                    <p className="text-4xl font-black" style={{ color: hallucination_report?.clean ? '#22c55e' : '#ef4444' }}>
                        {hallucination_report?.hallucination_count ?? 0}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {hallucination_report?.clean ? '✓ Clean' : 'intercepted'}
                    </p>
                </div>
            </div>

            {/* Agent Alignment Banner */}
            {bias_analysis && (
                <div className="glass-card flex items-center gap-4 py-4 px-5"
                    style={{ borderColor: bias_analysis.aligned ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
                    <GitMerge size={20} style={{ color: bias_analysis.aligned ? '#22c55e' : '#ef4444' }} />
                    <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                            Multi-Agent Debate: {bias_analysis.verdict}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Logistics vs Finance divergence score: {bias_analysis.divergence_score}/75
                        </p>
                    </div>
                    <div className="flex gap-4 text-center">
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Logistics</p>
                            <p className="font-bold text-sm" style={{ color: PRIORITY_COLOR[bias_analysis.logistics_priority] ?? '#fff' }}>
                                {bias_analysis.logistics_priority}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Finance</p>
                            <p className="font-bold text-sm" style={{ color: PRIORITY_COLOR[bias_analysis.finance_priority] ?? '#fff' }}>
                                {bias_analysis.finance_priority}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors"
                        style={{
                            color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                            borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                        }}>
                        <t.icon size={14} />{t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'guardrails' && (
                <div className="glass-card space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        Deterministic Fact-Check Results
                    </h3>
                    {(guardrails?.checks ?? []).map((check, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                            style={{ background: 'var(--bg-secondary)' }}>
                            {check.passed
                                ? <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                : <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{check.check}</p>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                        style={{
                                            background: check.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                                            color: check.severity === 'critical' ? '#ef4444' : '#eab308',
                                        }}>{check.severity}</span>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{check.details}</p>
                                <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                                    Source: {check.source}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'hallucination' && (
                <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Hallucination Intercept Log
                        </h3>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${hallucination_report?.clean ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {hallucination_report?.clean ? '✓ No Hallucinations' : `${hallucination_report?.hallucination_count} Blocked`}
                        </span>
                    </div>

                    {hallucination_report?.clean ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <ShieldCheck size={36} className="text-emerald-400" />
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                All AI responses verified against Spanner Graph
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                No unauthorized supplier names detected in last analysis
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {hallucination_report?.hallucinations?.map((h, i) => (
                                <div key={i} className="p-3 rounded-xl border"
                                    style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.3)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle size={14} className="text-red-400" />
                                        <span className="text-sm font-bold text-red-400">HALLUCINATION_BLOCKED</span>
                                    </div>
                                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                        Flagged: <span className="font-mono text-red-300">"{h.flagged}"</span>
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{h.reason}</p>
                                    {hallucination_report?.corrections?.[i] && (
                                        <p className="text-xs mt-1 text-emerald-400">
                                            ↳ Corrected to: <span className="font-semibold">{hallucination_report.corrections[i].corrected_to}</span>
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'debate' && bias_analysis && (
                <div className="space-y-4">
                    {/* Side-by-side agent cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card" style={{ borderColor: 'rgba(6,182,212,0.3)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={16} className="text-cyan-400" />
                                <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Logistics Agent</h4>
                            </div>
                            <div className="space-y-2">
                                <KV label="Priority" value={bias_analysis.logistics_priority} color={PRIORITY_COLOR[bias_analysis.logistics_priority]} />
                                <KV label="Confidence" value={`${bias_analysis.logistics_confidence}%`} />
                                <KV label="Lead-Time Impact" value={`+${bias_analysis.lead_time_impact_days ?? 0} days`} />
                                <KV label="Stance" value="Optimize for speed & rerouting" />
                            </div>
                        </div>
                        <div className="glass-card" style={{ borderColor: 'rgba(168,85,247,0.3)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart2 size={16} className="text-purple-400" />
                                <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Finance Agent</h4>
                            </div>
                            <div className="space-y-2">
                                <KV label="Priority" value={bias_analysis.finance_priority} color={PRIORITY_COLOR[bias_analysis.finance_priority]} />
                                <KV label="Confidence" value={`${bias_analysis.finance_confidence}%`} />
                                <KV label="Revenue at Risk" value={`$${(bias_analysis.revenue_at_risk ?? 0).toLocaleString()}`} />
                                <KV label="Stance" value="Optimize for cost & SLA penalties" />
                            </div>
                        </div>
                    </div>

                    {/* Divergence bar */}
                    <div className="glass-card">
                        <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-muted)' }}>Agent Reasoning Dimensions</h4>
                        <div className="space-y-3">
                            {bias_analysis.dimensions?.map((d, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                        <span>{d.axis}</span>
                                        <span>Logistics {d.logistics} vs Finance {d.finance}</span>
                                    </div>
                                    <div className="relative h-2 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                                        <div className="absolute h-2 rounded-full bg-cyan-500 opacity-70"
                                            style={{ width: `${d.logistics}%`, transition: 'width 0.8s ease' }} />
                                        <div className="absolute h-2 rounded-l-full bg-purple-500 opacity-70"
                                            style={{ width: `${d.finance}%`, top: 0, mixBlendMode: 'screen', transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" /> Logistics</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Finance</span>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'graph' && graph_stats && (
                <div className="glass-card">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        Knowledge Graph Vitals
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Tier-1 Suppliers', value: graph_stats.total_suppliers, color: '#f97316' },
                            { label: 'Sub-Suppliers (T2/T3)', value: graph_stats.total_sub_suppliers, color: '#eab308' },
                            { label: 'Regions Monitored', value: graph_stats.total_regions, color: '#06b6d4' },
                            { label: 'Components', value: graph_stats.total_components, color: '#22c55e' },
                            { label: 'Products', value: graph_stats.total_products, color: '#a855f7' },
                            { label: 'Graph Edges', value: graph_stats.total_edges, color: '#6366f1' },
                        ].map((stat, i) => (
                            <div key={i} className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-secondary)' }}>
                                <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Source of Truth</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            All AI recommendations fact-checked against {graph_stats.total_edges} graph edges spanning {graph_stats.total_suppliers + graph_stats.total_sub_suppliers} supplier nodes across {graph_stats.total_regions} monitored regions.
                        </p>
                    </div>
                </div>
            )}

            <button onClick={fetchReport}
                className="btn-primary"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <Activity size={14} /> Refresh Report
            </button>
        </div>
    );
}

function KV({ label, value, color }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="font-semibold" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
        </div>
    );
}
