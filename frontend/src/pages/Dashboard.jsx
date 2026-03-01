import { useState, useEffect } from 'react';
import { Users, Activity, AlertTriangle, DollarSign, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import HealthBadge from '../components/HealthBadge';
import api from '../api/client';

export default function Dashboard() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/suppliers').then(res => {
            setSuppliers(res.data.suppliers || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const avgScore = suppliers.length
        ? Math.round(suppliers.reduce((sum, s) => sum + s.health_score, 0) / suppliers.length)
        : 0;
    const atRisk = suppliers.filter(s => s.health_score < 70).length;
    const totalRevenue = 147847500;
    const revenueAtRisk = suppliers
        .filter(s => s.risk_level === 'high' || s.risk_level === 'critical')
        .length * 12000000;

    const trendIcon = (trend) => {
        if (trend === 'improving') return <TrendingUp size={14} className="text-emerald-400" />;
        if (trend === 'declining') return <TrendingDown size={14} className="text-red-400" />;
        return <Minus size={14} className="text-slate-400" />;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Control Tower
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Real-time supply chain health monitoring • NexGen Electronics
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
                <KpiCard title="Active Suppliers" value={suppliers.length} subtitle="Across 5 countries" icon={Users} color="blue" />
                <KpiCard title="Avg Health Score" value={avgScore} subtitle="Weighted composite" icon={Activity} color="green" trend={avgScore > 80 ? 'up' : 'stable'} />
                <KpiCard title="At-Risk Suppliers" value={atRisk} subtitle="Health score below 70" icon={AlertTriangle} color="amber" />
                <KpiCard title="Revenue at Risk" value={`$${(revenueAtRisk / 1000000).toFixed(1)}M`} subtitle={`of $${(totalRevenue / 1000000).toFixed(1)}M total`} icon={DollarSign} color="red" />
            </div>

            {/* Supplier Health Grid */}
            <div className="glass-card">
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Supplier Health Matrix
                </h3>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="spinner" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Supplier</th>
                                    <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Country</th>
                                    <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Category</th>
                                    <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Health</th>
                                    <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>OTD</th>
                                    <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Quality</th>
                                    <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Trend</th>
                                    <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suppliers.map((s, i) => (
                                    <tr key={i} className="transition-colors hover:bg-white/3" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td className="py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>{s.supplier_name}</td>
                                        <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                                            {s.breakdown?.on_time_delivery ? suppliers.find(sup => sup.supplier_name === s.supplier_name)?.supplier_name : ''}
                                            {/* Show from supplier data */}
                                        </td>
                                        <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>—</td>
                                        <td className="py-3 px-4 text-center"><HealthBadge score={s.health_score} size="sm" /></td>
                                        <td className="py-3 px-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                            {s.breakdown?.on_time_delivery?.score ?? '—'}%
                                        </td>
                                        <td className="py-3 px-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                            {s.breakdown?.quality_score?.score ?? '—'}%
                                        </td>
                                        <td className="py-3 px-4 text-center">{trendIcon(s.trend)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`badge badge-${s.risk_level}`}>{s.risk_level}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
