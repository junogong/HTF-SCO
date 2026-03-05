import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Brain, GitMerge, Activity, CheckCircle, XCircle, Zap, Eye, BarChart2, Clock, FileText, ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import api from '../api/client';

const PRIORITY_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };

export default function SafetyDashboard({ disruptionHistory = [] }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('guardrails');
    const [expandedChecks, setExpandedChecks] = useState(new Set());

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

    const toggleCheck = (i) => {
        setExpandedChecks(prev => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
    );

    if (!report) return null;

    const { guardrails, bias_analysis, hallucination_report, graph_stats, reasoning_trace } = report;
    const trustScore = guardrails?.trust_score ?? 0;
    const trustColor = trustScore >= 80 ? '#22c55e' : trustScore >= 60 ? '#eab308' : '#ef4444';
    const hitlRequired = guardrails?.hitl_required ?? false;
    const hitlThreshold = guardrails?.hitl_threshold ?? 1000000;

    const tabs = [
        { id: 'guardrails', label: 'Guardrail Checks', icon: ShieldCheck },
        { id: 'trace', label: 'Reasoning Trace', icon: Brain },
        { id: 'hallucination', label: 'Hallucination Log', icon: Eye },
        { id: 'debate', label: 'Agent Debate', icon: GitMerge },
        { id: 'audit', label: 'Audit Trail', icon: FileText },
        { id: 'graph', label: 'Graph Vitals', icon: Activity },
    ];

    return (
        <div className="flex flex-col justify-center min-h-[calc(100vh-120px)] space-y-6 animate-fade-in w-full" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Responsible AI Dashboard
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Explainability • Safety Checks • Bias Monitoring • Decision Audit Trail
                    </p>
                </div>
                {guardrails?.timestamp && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={12} />
                        Last validated: {new Date(guardrails.timestamp).toLocaleString()}
                    </div>
                )}
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Trust Score Gauge */}
                <div className="glass-card col-span-2 flex flex-col items-center justify-center py-6">
                    <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>AI Trust Score</p>
                    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                        <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                            <circle cx="60" cy="60" r="50" fill="none" stroke={trustColor} strokeWidth="12"
                                pathLength="100"
                                strokeDasharray={`${trustScore} 100`}
                                strokeLinecap="round"
                                transform="rotate(-90 60 60)"
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

                {/* HITL Status */}
                <div className="glass-card flex flex-col justify-center items-center py-6 gap-1"
                    style={{ borderColor: hitlRequired ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.2)' }}>
                    <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>HITL Override</p>
                    {hitlRequired
                        ? <Lock size={28} className="text-red-400" />
                        : <Unlock size={28} className="text-emerald-400" />}
                    <p className="text-xs font-bold" style={{ color: hitlRequired ? '#ef4444' : '#22c55e' }}>
                        {hitlRequired ? 'REQUIRED' : 'Not Required'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Threshold: ${(hitlThreshold / 1e6).toFixed(1)}M
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

            {/* ═══ GUARDRAILS TAB ═══ */}
            {tab === 'guardrails' && (
                <div className="glass-card space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        Deterministic Fact-Check Results
                    </h3>
                    {(guardrails?.checks ?? []).map((check, i) => (
                        <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                            <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => toggleCheck(i)}>
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
                                <div className="flex-shrink-0 mt-1">
                                    {expandedChecks.has(i)
                                        ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                                        : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                                </div>
                            </div>
                            {/* Expanded Reasoning Trace */}
                            {expandedChecks.has(i) && check.reasoning && (
                                <div className="px-3 pb-3 pt-0 ml-8 mr-3">
                                    <div className="p-3 rounded-lg text-xs font-mono leading-relaxed"
                                        style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)', borderLeft: '2px solid #6366f1' }}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Reasoning Trace</p>
                                        {check.reasoning}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ REASONING TRACE TAB ═══ */}
            {tab === 'trace' && (
                <div className="glass-card">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        AI Decision Pipeline — Reasoning Trace
                    </h3>
                    <div className="space-y-0">
                        {(reasoning_trace ?? []).map((step, i) => (
                            <div key={i} className="flex gap-3 relative">
                                {/* Vertical connector line */}
                                {i < (reasoning_trace?.length ?? 0) - 1 && (
                                    <div className="absolute left-[15px] top-8 w-[2px] h-[calc(100%-8px)]"
                                        style={{ background: step.status === 'completed' ? '#6366f1' : 'rgba(255,255,255,0.08)' }} />
                                )}
                                {/* Step circle */}
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10"
                                    style={{
                                        background: step.status === 'completed' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `2px solid ${step.status === 'completed' ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                                        color: step.status === 'completed' ? '#a5b4fc' : 'var(--text-muted)',
                                    }}>
                                    {step.step}
                                </div>
                                <div className="pb-5 flex-1 min-w-0">
                                    <p className="text-sm font-bold" style={{
                                        color: step.status === 'completed' ? 'var(--text-primary)' : 'var(--text-muted)'
                                    }}>
                                        {step.name}
                                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                            style={{
                                                background: step.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                                                color: step.status === 'completed' ? '#22c55e' : 'var(--text-muted)',
                                            }}>
                                            {step.status}
                                        </span>
                                    </p>
                                    <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                                        {step.detail}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ HALLUCINATION TAB ═══ */}
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

            {/* ═══ DEBATE TAB ═══ */}
            {tab === 'debate' && bias_analysis && (
                <div className="space-y-4">
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

            {/* ═══ AUDIT TRAIL TAB ═══ */}
            {tab === 'audit' && (
                <div className="glass-card">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        Decision Audit Trail
                    </h3>
                    {disruptionHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <FileText size={32} style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                No disruption analyses logged yet. Run an analysis to populate the audit trail.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                                        <th className="text-left py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">#</th>
                                        <th className="text-left py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Signal / Event</th>
                                        <th className="text-center py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Category</th>
                                        <th className="text-center py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Severity</th>
                                        <th className="text-center py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Trust</th>
                                        <th className="text-center py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">HITL</th>
                                        <th className="text-right py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">R@R</th>
                                        <th className="text-center py-3 px-4 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {disruptionHistory.map((entry, i) => {
                                        const cat = entry.classification?.category ?? '—';
                                        const sev = entry.classification?.severity ?? '—';
                                        const trust = entry.guardrails?.trust_score ?? '—';
                                        const hitl = entry.guardrails?.hitl_required;
                                        const rar = entry.strategy?.revenue_at_risk ?? 0;
                                        const source = entry.source === 'wind-tunnel' ? 'Simulation' : 'Analysis';

                                        return (
                                            <tr key={i} className="transition-colors hover:bg-white/[0.03]"
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td className="py-3 px-4 font-mono text-slate-500">{disruptionHistory.length - i}</td>
                                                <td className="py-3 px-4">
                                                    <p className="font-medium text-slate-200 truncate max-w-[250px]">
                                                        {entry.strategy?.name || entry.signal?.slice(0, 50) || 'Disruption event'}
                                                    </p>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                                        style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                                                        {cat}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold tabular-nums"
                                                    style={{ color: sev >= 8 ? '#ef4444' : sev >= 5 ? '#f59e0b' : '#22c55e' }}>
                                                    {sev}/10
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold tabular-nums"
                                                    style={{ color: trust >= 80 ? '#22c55e' : trust >= 60 ? '#eab308' : '#ef4444' }}>
                                                    {trust !== '—' ? `${trust}%` : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {hitl === true
                                                        ? <Lock size={14} className="text-red-400 mx-auto" />
                                                        : hitl === false
                                                            ? <Unlock size={14} className="text-emerald-400 mx-auto" />
                                                            : <span className="text-slate-500">—</span>}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-red-400/80">
                                                    ${(rar / 1e6).toFixed(1)}M
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                                        style={{
                                                            background: source === 'Simulation' ? 'rgba(139,92,246,0.15)' : 'rgba(239,68,68,0.15)',
                                                            color: source === 'Simulation' ? '#a78bfa' : '#fca5a5',
                                                        }}>
                                                        {source}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ GRAPH VITALS TAB ═══ */}
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
