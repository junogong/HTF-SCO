import { useState, useEffect } from 'react';
import MapCommandCenter from '../components/MapCommandCenter';
import api from '../api/client';

export default function SupplyGraph({ analysisResult }) {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/suppliers').then(res => {
            setSuppliers(res.data.suppliers || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Geospatial Command Center
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Bloomberg Terminal view • Live PO transit • GraphRAG impact overlay
                    </p>
                </div>
            </div>

            <div className="glass-card p-0 overflow-hidden" style={{ borderRadius: '16px' }}>
                {loading ? (
                    <div className="flex items-center justify-center" style={{ height: '550px' }}>
                        <div className="spinner" />
                    </div>
                ) : (
                    <MapCommandCenter analysisResult={analysisResult} suppliers={suppliers} />
                )}
            </div>

            {/* Status legend below map */}
            <div className="glass-card">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 font-mono" style={{ color: 'var(--text-muted)' }}>
                    Network Status
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {suppliers.slice(0, 8).map((s, i) => {
                        const isAffected = analysisResult?.affected_suppliers?.some(
                            a => a.supplier_name === s.supplier_name || a.name === s.supplier_name
                        );
                        return (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs"
                                style={{ background: 'var(--bg-secondary)' }}>
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                                    backgroundColor: isAffected ? '#ef4444' : s.health_score >= 70 ? '#10b981' : '#f59e0b'
                                }} />
                                <div className="min-w-0">
                                    <p className="font-semibold truncate font-mono" style={{ color: 'var(--text-primary)', fontSize: '11px' }}>
                                        {s.supplier_name}
                                    </p>
                                    <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                        HP: {s.health_score} | {isAffected ? '🔴 IMPACTED' : s.risk_level?.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
