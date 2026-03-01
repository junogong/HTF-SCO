import { useState } from 'react';
import { UserPlus, Building2, Truck, Check, Plus } from 'lucide-react';
import api from '../api/client';

export default function Onboarding() {
    const [entityType, setEntityType] = useState('Supplier');
    const [name, setName] = useState('');
    const [country, setCountry] = useState('');
    const [category, setCategory] = useState('');
    const [capabilities, setCapabilities] = useState('');
    const [riskAppetite, setRiskAppetite] = useState(50);
    const [slaPenalty, setSlaPenalty] = useState('2500');
    const [riskThreshold, setRiskThreshold] = useState('500000');
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);
    const [recentlyAdded, setRecentlyAdded] = useState([]);

    const riskLabel = riskAppetite < 33 ? 'Conservative' : riskAppetite < 66 ? 'Balanced' : 'Aggressive';
    const riskValue = riskAppetite < 33 ? 'conservative' : riskAppetite < 66 ? 'balanced' : 'aggressive';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) return;
        setLoading(true);
        try {
            const res = await api.post('/onboard', {
                type: entityType,
                name,
                properties: {
                    country,
                    category,
                    capabilities: capabilities.split(',').map(s => s.trim()).filter(Boolean),
                },
                risk_threshold: parseInt(riskThreshold) || 500000,
                sla_penalties: parseInt(slaPenalty) || 2500,
            });
            setSuccess(res.data);
            setRecentlyAdded(prev => [{ ...res.data, country, category, added: new Date().toLocaleTimeString() }, ...prev]);
            // Reset form
            setName('');
            setCountry('');
            setCategory('');
            setCapabilities('');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Onboarding
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Add new companies and suppliers to the Spanner Graph knowledge base
                </p>
            </div>

            {/* Success toast */}
            {success && (
                <div className="glass-card animate-fade-in flex items-center gap-3"
                    style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.06)' }}>
                    <Check size={20} className="text-emerald-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-400">
                            {success.type} "{success.name}" added successfully
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Node ID: {success.id}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="glass-card space-y-5">
                        {/* Entity Type */}
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                                Entity Type
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { type: 'Company', icon: Building2 },
                                    { type: 'Supplier', icon: Truck },
                                ].map(({ type, icon: Icon }) => (
                                    <button
                                        type="button" key={type}
                                        onClick={() => setEntityType(type)}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                                        style={{
                                            background: entityType === type ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                                            border: `1px solid ${entityType === type ? 'transparent' : 'var(--border)'}`,
                                            color: entityType === type ? '#fff' : 'var(--text-secondary)',
                                        }}
                                    >
                                        <Icon size={16} /> {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Basic fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                                <input className="input-field" placeholder="e.g., Samsung SDI" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Country</label>
                                <input className="input-field" placeholder="e.g., South Korea" value={country} onChange={e => setCountry(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
                                <input className="input-field" placeholder="e.g., Batteries & Power" value={category} onChange={e => setCategory(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Capabilities (comma-separated)</label>
                                <input className="input-field" placeholder="e.g., Li-ion cells, Battery packs" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
                            </div>
                        </div>

                        {/* Risk Appetite Slider */}
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                                Risk Appetite — <span style={{ color: riskAppetite < 33 ? '#10b981' : riskAppetite < 66 ? '#3b82f6' : '#ef4444' }}>{riskLabel}</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Conservative</span>
                                <input
                                    type="range" min="0" max="100" value={riskAppetite}
                                    onChange={e => setRiskAppetite(parseInt(e.target.value))}
                                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                                    style={{ background: `linear-gradient(90deg, #10b981, #3b82f6, #ef4444)` }}
                                />
                                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Aggressive</span>
                            </div>
                        </div>

                        {/* Financial thresholds */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    SLA Penalty ($/day)
                                </label>
                                <input className="input-field" type="number" placeholder="2500" value={slaPenalty} onChange={e => setSlaPenalty(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    Revenue-at-Risk Threshold ($)
                                </label>
                                <input className="input-field" type="number" placeholder="500000" value={riskThreshold} onChange={e => setRiskThreshold(e.target.value)} />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Exceeding this triggers Executive Escalation
                                </p>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary w-full justify-center" disabled={!name || loading}>
                            {loading ? <div className="spinner" /> : <><Plus size={16} /> Add {entityType} to Graph</>}
                        </button>
                    </form>
                </div>

                {/* Recently added */}
                <div className="glass-card h-fit">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        Recently Added
                    </h3>
                    {recentlyAdded.length === 0 ? (
                        <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                            No entities added yet this session
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {recentlyAdded.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg animate-slide-in"
                                    style={{ background: 'var(--bg-secondary)' }}>
                                    {item.type === 'Company' ?
                                        <Building2 size={14} className="text-blue-400 flex-shrink-0" /> :
                                        <Truck size={14} className="text-amber-400 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {item.country || item.type} • {item.added}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
