import { useState } from 'react';
import { AlertTriangle, Send, Truck, DollarSign, ShieldAlert, Zap, Info, CheckCircle, ShieldCheck, Lock, History, Clock, Wind, ArrowRight, Package, Newspaper, Loader2, Radio } from 'lucide-react';
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

export default function Disruption({ disruptionHistory = [], activeIndex = -1, setActiveIndex, onAddDisruption }) {
    const [signal, setSignal] = useState('');
    const [riskAppetite, setRiskAppetite] = useState('balanced');
    const [loading, setLoading] = useState(false);
    const [showOverride, setShowOverride] = useState(false);

    // News scraping state
    const [scraping, setScraping] = useState(false);
    const [scrapeResult, setScrapeResult] = useState(null);

    const result = activeIndex >= 0 ? disruptionHistory[activeIndex] : null;

    const analyze = async () => {
        if (!signal.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/disruption', { signal, risk_appetite: riskAppetite });
            onAddDisruption?.(res.data);
            setSignal('');
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const scanNews = async () => {
        setScraping(true);
        setScrapeResult(null);
        try {
            const res = await api.post('/cron/scrape-finviz');
            setScrapeResult(res.data);

            // Auto-fetch and add any auto-analyzed disruptions to the history
            if (res.data.auto_analyzed > 0) {
                const disruptionsRes = await api.get('/cron/auto-disruptions');
                const newDisruptions = disruptionsRes.data.disruptions || [];
                // Add each auto-disruption to history (newest first)
                for (const d of newDisruptions.reverse()) {
                    // Avoid duplicates (check by strategy name)
                    const isDuplicate = disruptionHistory.some(
                        h => h.strategy?.name === d.strategy?.name
                    );
                    if (!isDuplicate) {
                        onAddDisruption?.(d);
                    }
                }
            }
        } catch (err) {
            console.error('Scrape failed:', err);
            setScrapeResult({ status: 'error', message: err.message });
        }
        setScraping(false);
    };

    return (
        <div className="flex gap-6 h-full items-start">
            {/* Main Content Area */}
            <div className={`space-y-6 animate-fade-in ${disruptionHistory.length > 0 ? 'flex-1 min-w-0' : 'w-full'}`}>
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

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>or</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    </div>

                    {/* Scan Live News Button */}
                    <button
                        className="w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                        onClick={scanNews}
                        disabled={scraping}
                        style={{
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.12))',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: '#f59e0b',
                        }}
                    >
                        {scraping ? <Loader2 size={16} className="animate-spin" /> : <Newspaper size={16} />}
                        {scraping ? 'Scanning Finviz News Feed...' : 'Scan Live News Feed'}
                    </button>
                </div>

                {/* Scrape Results */}
                {scrapeResult && (
                    <div className="glass-card" style={{ borderColor: scrapeResult.auto_analyzed > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Radio size={14} className="text-amber-400" />
                                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                    News Feed Scan Results
                                </h3>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400">
                                    {scrapeResult.scraped_total} scraped
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400">
                                    {scrapeResult.classified} classified
                                </span>
                                {scrapeResult.auto_analyzed > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400 animate-pulse">
                                        {scrapeResult.auto_analyzed} disruption(s) detected!
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* High-severity signals */}
                        {scrapeResult.high_severity_signals?.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>High-Severity Signals (auto-analyzed)</p>
                                {scrapeResult.high_severity_signals.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)' }}>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.severity >= 8 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                            SEV {s.severity}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-500/15" style={{ color: 'var(--text-secondary)' }}>
                                            {s.category}
                                        </span>
                                        <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                                            {s.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {scrapeResult.auto_analyzed === 0 && scrapeResult.status === 'success' && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                No high-severity supply chain disruptions detected in the current news cycle.
                            </p>
                        )}
                    </div>
                )}

                {/* Wind Tunnel Result — distinct UI */}
                {result && result.source === 'wind-tunnel' && result.wind_tunnel_reasoning && (
                    <div className="space-y-4 stagger-children">
                        {/* Wind Tunnel banner */}
                        <div className="glass-card" style={{ borderColor: 'rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.06)' }}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
                                    <Wind size={20} className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-purple-400 text-lg">{result.wind_tunnel_reasoning.scenario_name}</h3>
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Generated by Wind Tunnel Monte Carlo Simulation</p>
                                </div>
                                <div className="ml-auto flex gap-2">
                                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                                        {result.wind_tunnel_reasoning.category}
                                    </span>
                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${result.wind_tunnel_reasoning.probability === 'high' ? 'bg-red-500/15 text-red-400' : result.wind_tunnel_reasoning.probability === 'medium' ? 'bg-orange-500/15 text-orange-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                                        {result.wind_tunnel_reasoning.probability} probability
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                                {result.wind_tunnel_reasoning.description}
                            </p>

                            {/* Simulation reasoning chain */}
                            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)' }}>
                                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                    <Zap size={12} /> Simulation Reasoning Chain
                                </h4>

                                {/* Step 1: Signal */}
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>1</div>
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Trigger Signal Detected</p>
                                        <p className="text-[11px] font-mono mt-1 p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                                            &quot;{result.wind_tunnel_reasoning.signal}&quot;
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2: Region */}
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>2</div>
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Region Identified</p>
                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            Affected region: <span className="font-bold text-purple-400">{result.wind_tunnel_reasoning.affected_region}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3: Tier-1 Impact */}
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>3</div>
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Tier-1 Blast Radius Traversal</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {result.wind_tunnel_reasoning.tier1_impact.map((name, j) => (
                                                <span key={j} className="text-[10px] px-2 py-0.5 rounded-lg font-medium" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Step 4: Revenue */}
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>4</div>
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue-at-Risk Calculated</p>
                                        <p className="text-lg font-black text-red-400 mt-0.5">
                                            ${((result.wind_tunnel_reasoning.revenue_at_risk || 0) / 1e6).toFixed(1)}M
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pre-emptive Actions from Wind Tunnel */}
                        {result.wind_tunnel_reasoning.preemptive_actions?.length > 0 && (
                            <div className="glass-card" style={{ borderColor: 'rgba(34,197,94,0.3)' }}>
                                <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                    <Package size={14} /> Recommended Pre-emptive Actions
                                </h3>
                                <div className="space-y-2">
                                    {result.wind_tunnel_reasoning.preemptive_actions.map((a, j) => (
                                        <div key={j} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                                            <ArrowRight size={14} className="text-emerald-400 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                                                {a.description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>}
                                            </div>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                                {a.timeline}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* KPIs row */}
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
                )}

                {/* Regular Disruption Results */}
                {result && result.source !== 'wind-tunnel' && (
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

            {/* History Sidebar */}
            {disruptionHistory.length > 0 && (
                <div className="w-80 flex-shrink-0 space-y-3 animate-fade-in sticky top-0">
                    <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4" style={{ color: 'var(--text-muted)' }}>
                        <History size={14} /> Analysis History
                    </h3>
                    <div className="space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
                        {disruptionHistory.map((item, idx) => (
                            <button
                                key={item.strategy_id || idx}
                                onClick={() => setActiveIndex(idx)}
                                className="w-full text-left p-4 rounded-xl transition-all"
                                style={{
                                    background: activeIndex === idx ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                                    border: `1px solid ${activeIndex === idx ? 'rgba(59, 130, 246, 0.3)' : 'var(--border)'}`
                                }}
                            >
                                <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        {item.source === 'wind-tunnel' && (
                                            <Wind size={10} className="text-purple-400" />
                                        )}
                                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {item.classification?.category || 'Disruption Analysis'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                        <Clock size={10} className="inline mr-1 mb-0.5" />
                                        {idx === 0 ? 'Just now' : `${idx} items ago`}
                                    </span>
                                </div>
                                <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {item.strategy?.name || 'Simulation Strategy Result'}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                                        ${((item.strategy?.revenue_at_risk || 0) / 1000000).toFixed(1)}M Risk
                                    </span>
                                    {item.source === 'wind-tunnel' && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                                            Wind Tunnel
                                        </span>
                                    )}
                                    {item.guardrails?.trust_score && (
                                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${item.guardrails.trust_score >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                                            Trust: {item.guardrails.trust_score}%
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
