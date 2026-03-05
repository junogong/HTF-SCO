import { useState, useEffect } from 'react';
import { Users, Activity, AlertTriangle, DollarSign, TrendingDown, TrendingUp, Minus, Zap, ShieldAlert, Globe, Clock, Layers, BarChart3, Radio } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import HealthBadge from '../components/HealthBadge';
import api from '../api/client';

export default function Dashboard({ activeResult, disruptionHistory = [], signals = [] }) {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        api.get('/suppliers').then(res => {
            setSuppliers(res.data.suppliers || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ── Apply disruption impact to supplier health ──────────────────
    const affectedSupplierIds = new Set(
        (activeResult?.affected_suppliers || []).map(s => s.id)
    );
    const severity = activeResult?.classification?.severity ?? 0;

    const adjustedSuppliers = suppliers.map(s => {
        if (!activeResult || !affectedSupplierIds.has(s.supplier_id)) return s;
        const penalty = Math.min(severity * 3, 50);
        const adjustedScore = Math.max(15, s.health_score - penalty);
        const newRisk = adjustedScore >= 80 ? 'low'
            : adjustedScore >= 60 ? 'medium'
                : adjustedScore >= 40 ? 'high'
                    : 'critical';
        return { ...s, health_score: adjustedScore, risk_level: newRisk, trend: 'declining', disrupted: true };
    });

    // ── KPI Computations ────────────────────────────────────────────
    const avgScore = adjustedSuppliers.length
        ? Math.round(adjustedSuppliers.reduce((sum, s) => sum + s.health_score, 0) / adjustedSuppliers.length)
        : 0;
    const atRisk = adjustedSuppliers.filter(s => s.health_score < 70).length;
    const totalPortfolio = 147847500;
    const revenueAtRisk = activeResult?.strategy?.revenue_at_risk
        ?? adjustedSuppliers.filter(s => s.risk_level === 'high' || s.risk_level === 'critical').length * 500000;

    // Risk distribution for the heat strip
    const riskCounts = {
        critical: adjustedSuppliers.filter(s => s.risk_level === 'critical').length,
        high: adjustedSuppliers.filter(s => s.risk_level === 'high').length,
        medium: adjustedSuppliers.filter(s => s.risk_level === 'medium').length,
        low: adjustedSuppliers.filter(s => s.risk_level === 'low').length,
    };
    const totalS = adjustedSuppliers.length || 1;

    // Threat level
    const threatLevel = severity >= 8 ? 'CRITICAL' : severity >= 6 ? 'ELEVATED' : severity >= 3 ? 'GUARDED' : disruptionHistory.length > 0 ? 'ADVISORY' : 'NOMINAL';
    const threatColor = severity >= 8 ? '#ef4444' : severity >= 6 ? '#f59e0b' : severity >= 3 ? '#3b82f6' : disruptionHistory.length > 0 ? '#06b6d4' : '#10b981';

    const trendIcon = (s) => {
        if (s.disrupted) return <TrendingDown size={14} className="text-red-400" />;
        if (s.trend === 'improving') return <TrendingUp size={14} className="text-emerald-400" />;
        if (s.trend === 'declining') return <TrendingDown size={14} className="text-red-400" />;
        return <Minus size={14} className="text-slate-400" />;
    };

    return (
        <div className="space-y-5 animate-fade-in">
            {/* ═══ TOP BAR: Branded Command Center Header ═══════════════════ */}
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight text-white">
                            Supply Chain Control Tower
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest"
                            style={{ background: `${threatColor}22`, color: threatColor, border: `1px solid ${threatColor}44` }}>
                            {threatLevel}
                        </span>
                    </div>
                    <p className="text-[13px] mt-1 flex items-center gap-4" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1.5"><Globe size={12} /> NexGen Electronics — 8 Tier-1 suppliers across 5 regions</span>
                        <span className="text-slate-600">|</span>
                        <span className="flex items-center gap-1.5"><Layers size={12} /> Portfolio: ${(totalPortfolio / 1e6).toFixed(1)}M</span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1.5 text-[13px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                        <Clock size={13} />
                        {now.toUTCString().slice(17, 25)} UTC
                    </div>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> GRAPH</span>
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> AI</span>
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> INGEST</span>
                    </div>
                </div>
            </div>

            {/* ═══ RISK HEAT STRIP ══════════════════════════════════════════ */}
            <div className="glass-card p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><BarChart3 size={11} /> Risk Distribution</span>
                    <span className="text-[10px] text-slate-500">{adjustedSuppliers.length} suppliers monitored</span>
                </div>
                <div className="flex h-2 w-full overflow-hidden" style={{ borderRadius: '2px' }}>
                    {riskCounts.critical > 0 && <div style={{ width: `${(riskCounts.critical / totalS) * 100}%`, background: '#ef4444' }} title={`${riskCounts.critical} critical`} />}
                    {riskCounts.high > 0 && <div style={{ width: `${(riskCounts.high / totalS) * 100}%`, background: '#f59e0b' }} title={`${riskCounts.high} high`} />}
                    {riskCounts.medium > 0 && <div style={{ width: `${(riskCounts.medium / totalS) * 100}%`, background: '#3b82f6' }} title={`${riskCounts.medium} medium`} />}
                    <div style={{ width: `${(riskCounts.low / totalS) * 100}%`, background: '#10b981' }} title={`${riskCounts.low} low`} />
                </div>
                <div className="flex items-center gap-4 mt-2">
                    {[['CRITICAL', riskCounts.critical, '#ef4444'], ['HIGH', riskCounts.high, '#f59e0b'], ['MEDIUM', riskCounts.medium, '#3b82f6'], ['LOW', riskCounts.low, '#10b981']].map(([label, count, color]) => (
                        <span key={label} className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color }}>
                            <span className="w-2 h-2" style={{ background: color, borderRadius: '1px' }} /> {count} {label}
                        </span>
                    ))}
                </div>
            </div>

            {/* ═══ ACTIVE DISRUPTION BANNER ═════════════════════════════════ */}
            {activeResult && (
                <div className="relative p-4 overflow-hidden border transition-all"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'linear-gradient(90deg, rgba(239,68,68,0.06) 0%, rgba(2,6,23,0.8) 60%)', borderRadius: '12px', boxShadow: '0 8px 32px -4px rgba(239, 68, 68, 0.12)' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/25 shrink-0">
                            <ShieldAlert size={22} className="text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-black text-red-400 uppercase tracking-wider text-[11px]">⚠ Active Disruption</span>
                                <span className="text-slate-600">—</span>
                                <span className="font-bold text-white">{activeResult.classification?.category?.toUpperCase()}</span>
                                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider"
                                    style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                                    SEV {severity}/10
                                </span>
                            </div>
                            <p className="text-[13px] font-medium mt-1 truncate text-slate-300">
                                {activeResult.signal || activeResult.strategy?.name}
                                <span className="mx-2 text-slate-600">|</span>
                                <strong className="text-white">{activeResult.affected_suppliers?.length || 0}</strong> suppliers impacted
                            </p>
                        </div>
                        <div className="text-right shrink-0 pl-4" style={{ borderLeft: '1px solid rgba(239,68,68,0.15)' }}>
                            <p className="text-[9px] font-bold text-red-500/60 uppercase tracking-widest">Revenue at Risk</p>
                            <span className="text-2xl font-black text-red-400 tabular-nums">
                                ${(revenueAtRisk / 1e6).toFixed(1)}M
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ KPI CARDS + RECENT EVENTS GRID ══════════════════════════ */}
            <div className="grid grid-cols-12 gap-4">
                {/* KPI Cards — 8 cols */}
                <div className="col-span-8 grid grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
                    <KpiCard title="Active Suppliers" value={adjustedSuppliers.length} subtitle="Across 5 regions" icon={Users} color="blue" />
                    <KpiCard title="Avg Health Score" value={avgScore} subtitle={activeResult ? "Disruption-adjusted" : "Weighted composite"} icon={Activity} color={avgScore > 80 ? "green" : avgScore > 60 ? "amber" : "red"} trend={avgScore > 80 ? 'up' : activeResult ? 'down' : 'stable'} />
                    <KpiCard title="At-Risk Suppliers" value={atRisk} subtitle={`Health below 70${activeResult ? ' (disrupted)' : ''}`} icon={AlertTriangle} color="amber" />
                    <KpiCard title="Revenue at Risk" value={`$${(revenueAtRisk / 1e6).toFixed(1)}M`} subtitle={`of $${(totalPortfolio / 1e6).toFixed(1)}M portfolio`} icon={DollarSign} color="red" />
                </div>

                {/* Recent Signals — 4 cols */}
                <div className="col-span-4">
                    <div className="glass-card h-full p-4">
                        <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Radio size={13} className="text-amber-400" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Signal Feed</span>
                            <span className="ml-auto text-[10px] text-slate-500">{signals.length} signals</span>
                        </div>
                        {signals.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">No real-time signals detected. Scanning Bloomberg...</p>
                        ) : (
                            <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                {signals.slice(0, 12).map((d, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors hover:bg-white/5"
                                        style={{ borderLeft: `2px solid ${d.severity >= 7 ? '#ef4444' : '#3b82f6'}` }}>
                                        <div className="flex-1 min-w-0 mr-2">
                                            <p className="text-[11px] font-bold text-white uppercase tracking-tight" style={{ fontSize: '9px', opacity: 0.7 }}>
                                                {d.category || 'General'}
                                            </p>
                                            <p className="text-[11px] truncate text-slate-300" title={d.text}>
                                                {d.text}
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap">
                                            {new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ SUPPLIER HEALTH MATRIX ═══════════════════════════════════ */}
            <div className="glass-card p-0 overflow-hidden">
                <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-white tracking-tight">
                            Supplier Health Matrix
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 font-bold text-slate-400 uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                            {adjustedSuppliers.length} Tier-1
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="spinner" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                                    <th className="text-left py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Supplier</th>
                                    <th className="text-left py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Type</th>
                                    <th className="text-left py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest" style={{ minWidth: '180px' }}>Health</th>
                                    <th className="text-center py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest">OTD</th>
                                    <th className="text-center py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Quality</th>
                                    <th className="text-center py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Trend</th>
                                    <th className="text-center py-3 px-5 font-bold text-[10px] text-slate-500 uppercase tracking-widest">Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustedSuppliers.map((s, i) => {
                                    const barColor = s.health_score >= 80 ? '#10b981' : s.health_score >= 60 ? '#3b82f6' : s.health_score >= 40 ? '#f59e0b' : '#ef4444';
                                    return (
                                        <tr key={i}
                                            className="transition-colors hover:bg-white/[0.03] group"
                                            style={{
                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                background: s.disrupted ? 'linear-gradient(90deg, rgba(239,68,68,0.06) 0%, transparent 50%)' : 'transparent',
                                            }}
                                        >
                                            <td className="py-3 px-5">
                                                <div className="font-semibold flex items-center gap-2" style={{ color: s.disrupted ? '#fca5a5' : '#e2e8f0' }}>
                                                    {s.supplier_name}
                                                    {s.disrupted && <span className="text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20" style={{ borderRadius: '3px' }}>Impacted</span>}
                                                </div>
                                            </td>
                                            <td className="py-3 px-5 text-slate-400 text-[12px]">
                                                {s.component_type || '—'}
                                            </td>
                                            {/* Inline bar chart for health */}
                                            <td className="py-3 px-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] font-bold tabular-nums w-7" style={{ color: barColor }}>{s.health_score}</span>
                                                    <div className="flex-1 h-1.5 bg-white/5 overflow-hidden" style={{ borderRadius: '1px' }}>
                                                        <div className="h-full transition-all" style={{ width: `${s.health_score}%`, background: barColor, borderRadius: '1px' }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-5 text-center font-medium text-slate-300 text-[12px] tabular-nums">
                                                {s.breakdown?.on_time_delivery?.score ?? '—'}%
                                            </td>
                                            <td className="py-3 px-5 text-center font-medium text-slate-300 text-[12px] tabular-nums">
                                                {s.breakdown?.quality_score?.score ?? '—'}%
                                            </td>
                                            <td className="py-3 px-5 text-center">{trendIcon(s)}</td>
                                            <td className="py-3 px-5 text-center">
                                                <span className={`badge badge-${s.risk_level}`}>{s.risk_level}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
