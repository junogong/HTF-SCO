import { useState } from 'react';
import { AlertTriangle, Send, Truck, DollarSign, ShieldAlert, Zap, Info, CheckCircle, ShieldCheck, Lock } from 'lucide-react';
import ReasoningTrace from '../components/ReasoningTrace';
import HealthBadge from '../components/HealthBadge';
import OverrideModal from '../components/OverrideModal';
import api from '../api/client';

const RISK_APPETITES = [
    { value: 'conservative', label: 'Conservative', desc: 'Prioritize cost savings' },
    { value: 'balanced', label: 'Balanced', desc: 'Equal weight' },
    { value: 'aggressive', label: 'Aggressive', desc: 'Prioritize speed' },
];

const SAMPLE_SIGNALS = [
    "Major earthquake detected near TSMC fabrication facilities in Taiwan, magnitude 7.2",
    "Monsoon flooding in Gujarat, India disrupting electronic component logistics",
    "Port of Shanghai congestion: 45+ vessel queue, average delay 12 days",
    "BYD announces battery cell production line shutdown for 2-week maintenance",
    "EU imposes new tariffs on Chinese electronic imports, 25% increase effective immediately",
];

export default function Disruption({ onResult }) {
    const [signal, setSignal] = useState('');
    const [riskAppetite, setRiskAppetite] = useState('balanced');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showOverride, setShowOverride] = useState(false);

    const analyze = async () => {
        if (!signal.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await api.post('/disruption', { signal, risk_appetite: riskAppetite });
            setResult(res.data);
            onResult?.(res.data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Disruption Analysis
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Enter a disruption signal to trigger the full GraphRAG + Multi-Agent reasoning pipeline
                </p>
            </div>

            {/* Input Panel */}
            <div className="glass-card space-y-4">
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                        Disruption Signal
                    </label>
                    <textarea
                        className="input-field"
                        rows={3}
                        placeholder="Describe a supply chain disruption... (e.g., 'Earthquake in Taiwan affecting semiconductor production')"
                        value={signal}
                        onChange={e => setSignal(e.target.value)}
                    />
                </div>

                {/* Quick templates */}
                <div className="flex flex-wrap gap-2">
                    {SAMPLE_SIGNALS.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => setSignal(s)}
                            className="text-[11px] px-2.5 py-1 rounded-lg transition-colors hover:bg-white/10"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                            {s.substring(0, 50)}…
                        </button>
                    ))}
                </div>

                {/* Risk Appetite Selector */}
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                        Risk Appetite
                    </label>
                    <div className="flex gap-2">
                        {RISK_APPETITES.map(ra => (
                            <button
                                key={ra.value}
                                onClick={() => setRiskAppetite(ra.value)}
                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${riskAppetite === ra.value ? 'text-white' : ''}`}
                                style={{
                                    background: riskAppetite === ra.value ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                                    border: `1px solid ${riskAppetite === ra.value ? 'transparent' : 'var(--border)'}`,
                                    color: riskAppetite === ra.value ? '#fff' : 'var(--text-secondary)',
                                }}
                            >
                                {ra.label}
                                <span className="block text-[10px] font-normal mt-0.5 opacity-70">{ra.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    className="btn-primary w-full justify-center"
                    onClick={analyze}
                    disabled={!signal.trim() || loading}
                >
                    {loading ? <div className="spinner" /> : <><Send size={16} /> Analyze Disruption</>}
                </button>
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-6 stagger-children">
                    {/* Executive Escalation Alert */}
                    {result.strategy?.executive_escalation && (
                        <div className="glass-card animate-fade-in" style={{
                            borderColor: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.08)',
                        }}>
                            <div className="flex items-center gap-3">
                                <ShieldAlert size={24} className="text-red-400 flex-shrink-0 animate-pulse" />
                                <div>
                                    <h3 className="font-bold text-red-400">⚠️ Executive Escalation Required</h3>
                                    <p className="text-sm text-red-300/80 mt-1">
                                        Revenue-at-Risk (${result.strategy.revenue_at_risk?.toLocaleString()}) exceeds company threshold.
                                        Immediate executive review required.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Strategy Summary */}
                    <div className="glass-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {result.strategy?.name}
                            </h3>
                            {/* Confidence Badge */}
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${result.strategy?.confidence_score >= 70
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-400'
                                }`}>
                                <Zap size={14} />
                                {result.strategy?.confidence_score}% Confidence
                                {result.strategy?.requires_manual_review && (
                                    <span className="ml-1 text-[10px] uppercase tracking-wider">• Manual Review</span>
                                )}
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                            {result.strategy?.summary}
                        </p>

                        {/* Key metrics */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Revenue at Risk</p>
                                <p className="text-lg font-bold text-red-400">${(result.strategy?.revenue_at_risk || 0).toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Affected Suppliers</p>
                                <p className="text-lg font-bold text-amber-400">{result.affected_suppliers?.length || 0}</p>
                            </div>
                            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Products at Risk</p>
                                <p className="text-lg font-bold text-purple-400">{result.blast_radius?.products_at_risk || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Affected Suppliers */}
                    {result.affected_suppliers?.length > 0 && (
                        <div className="glass-card">
                            <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                Affected Suppliers
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {result.affected_suppliers.map((sup, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{sup.name}</span>
                                        {sup.health_score && <HealthBadge score={sup.health_score} size="sm" />}
                                        {sup.country && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sup.country}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Multi-Agent Debate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Logistics Agent */}
                        <div className="glass-card" style={{ borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                                    <Truck size={16} className="text-cyan-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-cyan-400">Logistics Agent</h4>
                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Speed & Service Level</p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                                {result.debate?.logistics?.recommendation}
                            </p>
                            {result.debate?.logistics?.lead_time_analysis && (
                                <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--bg-secondary)' }}>
                                    <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Lead-Time Shift</p>
                                    <p className="text-sm font-bold text-cyan-400">
                                        +{result.debate.logistics.lead_time_analysis.lead_time_shift_days} days disruption
                                    </p>
                                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        {result.debate.logistics.lead_time_analysis.sensitivity}
                                    </p>
                                </div>
                            )}
                            {result.debate?.logistics?.reroute_options?.map((opt, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{opt.option}</span>
                                    <span className="font-mono font-bold text-cyan-400">{opt.lead_time_shift_days > 0 ? '+' : ''}{opt.lead_time_shift_days}d</span>
                                </div>
                            ))}
                        </div>

                        {/* Finance Agent */}
                        <div className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                                    <DollarSign size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-400">Finance Agent</h4>
                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cost & Margin</p>
                                </div>
                            </div>
                            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                                {result.debate?.finance?.recommendation}
                            </p>
                            {result.debate?.finance?.sla_penalty_analysis?.map((sla, i) => (
                                <div key={i} className="rounded-lg p-2.5 mb-2" style={{ background: 'var(--bg-secondary)' }}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{sla.supplier}</span>
                                        <span className="text-xs font-bold text-amber-400">${sla.total_penalty?.toLocaleString()}</span>
                                    </div>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        ${sla.sla_penalty_per_day?.toLocaleString()}/day × {sla.estimated_delay_days} days
                                    </p>
                                </div>
                            ))}
                            {result.debate?.finance?.cost_breakdown && (
                                <div className="text-xs mt-2 space-y-1" style={{ color: 'var(--text-secondary)' }}>
                                    <div className="flex justify-between">
                                        <span>Expedited Shipping</span>
                                        <span className="font-mono">${result.debate.finance.cost_breakdown.expedited_shipping_cost?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Standard Reroute</span>
                                        <span className="font-mono">${result.debate.finance.cost_breakdown.standard_reroute_cost?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between font-bold pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                                        <span>Total Mitigation</span>
                                        <span className="font-mono text-amber-400">${result.debate.finance.cost_breakdown.total_mitigation_cost?.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Guardrails Validation Panel */}
                    {result.guardrails && (
                        <div className="glass-card" style={{ borderColor: result.guardrails.validated ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                    <ShieldCheck size={14} /> Responsible AI — Guardrails Report
                                </h3>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${result.guardrails.trust_score >= 80 ? 'bg-emerald-500/15 text-emerald-400'
                                        : result.guardrails.trust_score >= 60 ? 'bg-amber-500/15 text-amber-400'
                                            : 'bg-red-500/15 text-red-400'
                                    }`}>
                                    Trust: {result.guardrails.trust_score}%
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {result.guardrails.checks?.map((check, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs py-2 px-3 rounded-lg"
                                        style={{ background: check.passed ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.06)' }}>
                                        {check.passed
                                            ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                                            : <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                                        }
                                        <div className="flex-1">
                                            <span className="font-semibold" style={{ color: check.passed ? 'var(--text-primary)' : '#fca5a5' }}>
                                                {check.check}
                                            </span>
                                            <span className="mx-1.5" style={{ color: 'var(--text-muted)' }}>—</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{check.details}</span>
                                        </div>
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                                            background: 'rgba(139,92,246,0.1)', color: '#a78bfa'
                                        }}>
                                            {check.source}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* HITL Override button */}
                            {result.strategy?.hitl_required && (
                                <div className="mt-4 p-3 rounded-xl flex items-center justify-between"
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    <div className="flex items-center gap-2">
                                        <Lock size={16} className="text-red-400" />
                                        <div>
                                            <p className="text-xs font-bold text-red-400">HITL Hard Lock Active</p>
                                            <p className="text-[10px] text-red-300/60">{result.strategy.hitl_reason}</p>
                                        </div>
                                    </div>
                                    <button className="btn-danger text-xs py-2 px-3" onClick={() => setShowOverride(true)}>
                                        <ShieldAlert size={14} /> Request Override
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reasoning Trace */}
                    <div className="glass-card">
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                            Reasoning Trace — Transparent AI Decision Path
                        </h3>
                        <ReasoningTrace trace={result.reasoning_trace} />
                        <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            <Info size={12} />
                            Total pipeline: {result.total_duration_ms}ms • {result.past_lessons_used} past lesson(s) consulted
                        </div>
                    </div>
                </div>
            )}

            {/* HITL Override Modal */}
            <OverrideModal
                isOpen={showOverride}
                onClose={() => setShowOverride(false)}
                onConfirm={(reason) => {
                    console.log('Override authorized:', reason);
                    setShowOverride(false);
                }}
                strategy={result?.strategy}
                guardrails={result?.guardrails}
            />
        </div>
    );
}
