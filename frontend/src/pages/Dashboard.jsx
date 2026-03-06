import { useState, useEffect } from 'react';
import { Users, Activity, AlertTriangle, DollarSign, TrendingDown, TrendingUp, Minus, ShieldAlert, Globe, Clock, Layers, BarChart3, Radio, CheckCircle } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import HealthBadge from '../components/HealthBadge';
import api from '../api/client';

// Category badge color mapping
const categoryStyles = {
    financial: 'badge-financial',
    geopolitical: 'badge-geopolitical',
    'supply chain': 'badge-supply-chain',
    'supply-chain': 'badge-supply-chain',
    'natural disaster': 'badge-natural-disaster',
    'natural-disaster': 'badge-natural-disaster',
};

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

    // Risk distribution
    const riskCounts = {
        critical: adjustedSuppliers.filter(s => s.risk_level === 'critical').length,
        high: adjustedSuppliers.filter(s => s.risk_level === 'high').length,
        medium: adjustedSuppliers.filter(s => s.risk_level === 'medium').length,
        low: adjustedSuppliers.filter(s => s.risk_level === 'low').length,
    };
    const totalS = adjustedSuppliers.length || 1;

    // Threat level
    const threatLevel = severity >= 8 ? 'CRITICAL' : severity >= 6 ? 'ELEVATED' : severity >= 3 ? 'GUARDED' : disruptionHistory.length > 0 ? 'ADVISORY' : 'NOMINAL';
    const threatColor = severity >= 8 ? '#EF5350' : severity >= 6 ? '#FFA726' : severity >= 3 ? '#4FC3F7' : disruptionHistory.length > 0 ? '#4DD0E1' : '#81C784';

    const trendIcon = (s) => {
        if (s.disrupted) return <TrendingDown size={14} style={{ color: '#EF5350' }} />;
        if (s.trend === 'improving') return <TrendingUp size={14} style={{ color: '#81C784' }} />;
        if (s.trend === 'declining') return <TrendingDown size={14} style={{ color: '#EF5350' }} />;
        return <Minus size={14} style={{ color: 'var(--text-muted)' }} />;
    };

    const getCategoryBadge = (category) => {
        const cat = (category || 'general').toLowerCase();
        const style = categoryStyles[cat] || 'badge-general';
        return <span className={`badge-category ${style}`}>{category || 'General'}</span>;
    };

    return (
        <div className="space-y-5 animate-fade-in">
            {/* ═══ TOP BAR: Header ════════════════════════════════════════ */}
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 style={{
                            fontSize: '22px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-display)',
                            letterSpacing: '-0.02em',
                        }}>
                            Supply Chain Control Tower
                        </h2>
                        <span style={{
                            fontSize: '11px',
                            padding: '3px 10px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            background: `color-mix(in srgb, ${threatColor} 12%, transparent)`,
                            color: threatColor,
                            border: `1px solid color-mix(in srgb, ${threatColor} 25%, transparent)`,
                            fontFamily: 'var(--font-sans)',
                        }}>
                            {threatLevel}
                        </span>
                    </div>
                    <p style={{
                        fontSize: '13px',
                        marginTop: '6px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <span className="flex items-center gap-1.5"><Globe size={13} /> NexGen Electronics — 8 Tier-1 suppliers across 5 regions</span>
                        <span style={{ color: 'var(--border-light)' }}>·</span>
                        <span className="flex items-center gap-1.5"><Layers size={13} /> Portfolio: ${(totalPortfolio / 1e6).toFixed(1)}M</span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1.5" style={{
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                    }}>
                        <Clock size={14} />
                        {now.toUTCString().slice(17, 25)} UTC
                    </div>
                    <div className="flex items-center gap-3 mt-2 justify-end">
                        {['Graph', 'AI', 'Ingest'].map(sys => (
                            <span key={sys} className="flex items-center gap-1.5" style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#81C784',
                                fontFamily: 'var(--font-sans)',
                            }}>
                                <span style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: '#81C784',
                                    animation: 'pulse-soft 2s ease-in-out infinite',
                                }} />
                                {sys}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ RISK HEAT STRIP ══════════════════════════════════════════ */}
            <div className="glass-card" style={{ padding: '14px 20px' }}>
                <div className="flex items-center justify-between mb-2">
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        <BarChart3 size={12} /> Risk Distribution
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                        {adjustedSuppliers.length} suppliers monitored
                    </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden" style={{ borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }}>
                    {riskCounts.critical > 0 && <div style={{ width: `${(riskCounts.critical / totalS) * 100}%`, background: '#EF5350', borderRadius: '4px 0 0 4px' }} title={`${riskCounts.critical} critical`} />}
                    {riskCounts.high > 0 && <div style={{ width: `${(riskCounts.high / totalS) * 100}%`, background: '#FFA726' }} title={`${riskCounts.high} high`} />}
                    {riskCounts.medium > 0 && <div style={{ width: `${(riskCounts.medium / totalS) * 100}%`, background: '#4FC3F7' }} title={`${riskCounts.medium} medium`} />}
                    <div style={{ width: `${(riskCounts.low / totalS) * 100}%`, background: '#81C784', borderRadius: '0 4px 4px 0' }} title={`${riskCounts.low} low`} />
                </div>
                <div className="flex items-center gap-5 mt-2">
                    {[['Critical', riskCounts.critical, '#EF5350'], ['High', riskCounts.high, '#FFA726'], ['Medium', riskCounts.medium, '#4FC3F7'], ['Low', riskCounts.low, '#81C784']].map(([label, count, color]) => (
                        <span key={label} className="flex items-center gap-1.5" style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            <span style={{ width: '8px', height: '8px', background: color, borderRadius: '2px' }} />
                            {count} {label}
                        </span>
                    ))}
                </div>
            </div>

            {/* ═══ ACTIVE DISRUPTION BANNER ═════════════════════════════════ */}
            {activeResult && (
                <div style={{
                    padding: '18px 24px',
                    background: 'linear-gradient(90deg, rgba(239,83,80,0.06) 0%, var(--bg-secondary) 60%)',
                    border: '1px solid rgba(239, 83, 80, 0.2)',
                    borderRadius: '10px',
                }}>
                    <div className="flex items-center gap-4">
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(239, 83, 80, 0.1)',
                            border: '1px solid rgba(239, 83, 80, 0.2)',
                            flexShrink: 0,
                        }}>
                            <ShieldAlert size={20} color="#EF5350" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: '#EF5350',
                                    fontFamily: 'var(--font-sans)',
                                }}>
                                    ⚠ Active Disruption
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                <span style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-sans)',
                                }}>
                                    {activeResult.classification?.category?.toUpperCase()}
                                </span>
                                <span style={{
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                }}>
                                    SEV {severity}/10
                                </span>
                            </div>
                            <p style={{
                                fontSize: '13px',
                                marginTop: '4px',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-sans)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {activeResult.signal || activeResult.strategy?.name}
                                <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>·</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{activeResult.affected_suppliers?.length || 0}</strong> suppliers impacted
                            </p>
                        </div>
                        <div style={{
                            textAlign: 'right',
                            flexShrink: 0,
                            paddingLeft: '20px',
                            borderLeft: '1px solid rgba(239,83,80,0.12)',
                        }}>
                            <p style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)',
                                marginBottom: '2px',
                            }}>Revenue at Risk</p>
                            <span style={{
                                fontSize: '24px',
                                fontWeight: 700,
                                color: '#EF5350',
                                fontFamily: 'var(--font-mono)',
                            }}>
                                ${(revenueAtRisk / 1e6).toFixed(1)}M
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ KPI CARDS — FULL WIDTH 4 COLUMNS ═══════════════════════ */}
            <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3">
                    <KpiCard title="Active Suppliers" value={adjustedSuppliers.length} subtitle="Across 5 regions" icon={Users} color="blue" />
                </div>
                <div className="col-span-3">
                    <KpiCard title="Avg Health Score" value={avgScore} subtitle={activeResult ? "Disruption-adjusted" : "Weighted composite"} icon={Activity} color={avgScore > 80 ? "green" : avgScore > 60 ? "amber" : "red"} trend={avgScore > 80 ? 'up' : activeResult ? 'down' : 'stable'} />
                </div>
                <div className="col-span-3">
                    <KpiCard title="At-Risk Suppliers" value={atRisk} subtitle={`Health below 70${activeResult ? ' (disrupted)' : ''}`} icon={AlertTriangle} color="amber" />
                </div>
                <div className="col-span-3">
                    <KpiCard title="Revenue at Risk" value={`$${(revenueAtRisk / 1e6).toFixed(1)}M`} subtitle={`of $${(totalPortfolio / 1e6).toFixed(1)}M portfolio`} icon={DollarSign} color="red" />
                </div>
            </div>

            {/* ═══ SIGNAL FEED — FULL WIDTH, BORDERED ROWS ═══════════════ */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.15)',
                }}>
                    <div className="flex items-center gap-2">
                        <Radio size={15} style={{ color: 'var(--accent-warning)' }} />
                        <span style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-sans)',
                        }}>Signal Feed</span>
                    </div>
                    <span style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                    }}>{signals.length} signals detected</span>
                </div>

                {signals.length === 0 ? (
                    <p style={{
                        textAlign: 'center',
                        padding: '32px 24px',
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                    }}>
                        No real-time signals detected. Scanning sources...
                    </p>
                ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {signals.slice(0, 15).map((d, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '16px',
                                    padding: '12px 24px',
                                    borderBottom: '1px solid var(--border)',
                                    transition: 'background 0.15s ease',
                                    cursor: 'default',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {/* Severity indicator */}
                                <div style={{
                                    width: '3px',
                                    height: '32px',
                                    borderRadius: '2px',
                                    background: d.severity >= 7 ? '#EF5350' : d.severity >= 4 ? '#FFA726' : '#4FC3F7',
                                    flexShrink: 0,
                                }} />

                                {/* Category badge */}
                                <div style={{ width: '100px', flexShrink: 0 }}>
                                    {getCategoryBadge(d.category)}
                                </div>

                                {/* Signal text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        fontSize: '13px',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-sans)',
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }} title={d.text}>
                                        {d.text}
                                    </p>
                                </div>

                                {/* Severity + Timestamp */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    flexShrink: 0,
                                }}>
                                    <span style={{
                                        fontSize: '12px',
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 600,
                                        color: d.severity >= 7 ? '#EF5350' : d.severity >= 4 ? '#FFA726' : 'var(--text-muted)',
                                    }}>
                                        {d.severity}/10
                                    </span>
                                    <span style={{
                                        fontSize: '12px',
                                        fontFamily: 'var(--font-mono)',
                                        color: 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ SUPPLIER HEALTH MATRIX ═══════════════════════════════════ */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.15)',
                }}>
                    <div className="flex items-center gap-3">
                        <h3 style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-display)',
                        }}>
                            Supplier Health Matrix
                        </h3>
                        <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            fontWeight: 500,
                            color: 'var(--text-muted)',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.04)',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            {adjustedSuppliers.length} Tier-1
                        </span>
                    </div>
                    <div className="flex items-center gap-2" style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#81C784',
                            animation: 'pulse-soft 2s ease-in-out infinite',
                        }} />
                        Live
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="spinner" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table style={{ width: '100%', fontSize: '13px', fontFamily: 'var(--font-sans)', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                                    {['Supplier', 'Type', 'Health', 'OTD', 'Quality', 'Trend', 'Risk'].map(h => (
                                        <th key={h} style={{
                                            textAlign: h === 'Supplier' || h === 'Type' || h === 'Health' ? 'left' : 'center',
                                            padding: '12px 20px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                            fontFamily: 'var(--font-sans)',
                                            ...(h === 'Health' ? { minWidth: '180px' } : {}),
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {adjustedSuppliers.map((s, i) => {
                                    const barColor = s.health_score >= 80 ? '#81C784' : s.health_score >= 60 ? '#4FC3F7' : s.health_score >= 40 ? '#FFA726' : '#EF5350';
                                    return (
                                        <tr key={i}
                                            style={{
                                                borderBottom: '1px solid var(--border)',
                                                background: s.disrupted ? 'linear-gradient(90deg, rgba(239,83,80,0.04) 0%, transparent 50%)' : 'transparent',
                                                transition: 'background 0.15s ease',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = s.disrupted ? 'linear-gradient(90deg, rgba(239,83,80,0.06) 0%, rgba(255,255,255,0.02) 50%)' : 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = s.disrupted ? 'linear-gradient(90deg, rgba(239,83,80,0.04) 0%, transparent 50%)' : 'transparent'}
                                        >
                                            <td style={{ padding: '12px 20px' }}>
                                                <div className="flex items-center gap-2" style={{
                                                    fontWeight: 600,
                                                    color: s.disrupted ? '#ef9a9a' : 'var(--text-primary)',
                                                }}>
                                                    {s.supplier_name}
                                                    {s.disrupted && (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            padding: '1px 6px',
                                                            fontWeight: 600,
                                                            borderRadius: '4px',
                                                            color: '#EF5350',
                                                            background: 'rgba(239,83,80,0.1)',
                                                            border: '1px solid rgba(239,83,80,0.15)',
                                                        }}>
                                                            Impacted
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                                {s.component_type || '—'}
                                            </td>
                                            <td style={{ padding: '12px 20px' }}>
                                                <div className="flex items-center gap-2">
                                                    <span style={{
                                                        fontSize: '13px',
                                                        fontWeight: 700,
                                                        fontFamily: 'var(--font-mono)',
                                                        color: barColor,
                                                        width: '28px',
                                                    }}>{s.health_score}</span>
                                                    <div style={{
                                                        flex: 1,
                                                        height: '5px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden',
                                                    }}>
                                                        <div style={{
                                                            width: `${s.health_score}%`,
                                                            height: '100%',
                                                            background: barColor,
                                                            borderRadius: '3px',
                                                            transition: 'width 0.3s ease',
                                                        }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{
                                                padding: '12px 20px',
                                                textAlign: 'center',
                                                fontWeight: 500,
                                                color: 'var(--text-secondary)',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)',
                                            }}>
                                                {s.breakdown?.on_time_delivery?.score ?? '—'}%
                                            </td>
                                            <td style={{
                                                padding: '12px 20px',
                                                textAlign: 'center',
                                                fontWeight: 500,
                                                color: 'var(--text-secondary)',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)',
                                            }}>
                                                {s.breakdown?.quality_score?.score ?? '—'}%
                                            </td>
                                            <td style={{ padding: '12px 20px', textAlign: 'center' }}>{trendIcon(s)}</td>
                                            <td style={{ padding: '12px 20px', textAlign: 'center' }}>
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

            {/* ═══ SYSTEM STATUS TICKER ════════════════════════════════════ */}
            <div className="status-ticker">
                <div className="flex items-center gap-3">
                    <span className="status-dot" />
                    <span style={{ fontWeight: 500, color: 'var(--accent-success)', fontFamily: 'var(--font-sans)' }}>All systems operational</span>
                </div>
                <div className="flex items-center gap-4">
                    <span style={{ fontFamily: 'var(--font-sans)' }}>
                        Last scan: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{now.toUTCString().slice(17, 25)} UTC</strong>
                    </span>
                    <span style={{ color: 'var(--border-light)' }}>·</span>
                    <span style={{ fontFamily: 'var(--font-sans)' }}>
                        Active agents: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>3</strong>
                    </span>
                    <span style={{ color: 'var(--border-light)' }}>·</span>
                    <span style={{ fontFamily: 'var(--font-sans)' }}>
                        Uptime: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>99.9%</strong>
                    </span>
                </div>
            </div>
        </div>
    );
}
