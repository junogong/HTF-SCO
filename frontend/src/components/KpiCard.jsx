export default function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
    const gradients = {
        blue: 'var(--gradient-primary)',
        red: 'var(--gradient-danger)',
        green: 'var(--gradient-success)',
        amber: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        purple: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
    };

    const trendColors = {
        up: '#10b981',
        down: '#ef4444',
        stable: '#94a3b8',
    };

    return (
        <div className="glass-card flex flex-col gap-4 group relative overflow-hidden">
            {/* Very subtle background glow based on color */}
            <div
                className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: gradients[color] || gradients.blue }}
            />

            <div className="flex items-start justify-between relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                    {title}
                </span>
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                    style={{
                        background: gradients[color] || gradients.blue,
                        boxShadow: `0 8px 16px -4px ${color === 'red' ? 'rgba(239,68,68,0.4)' : color === 'green' ? 'rgba(16,185,129,0.4)' : color === 'amber' ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)'}`
                    }}
                >
                    {Icon && <Icon size={18} className="text-white drop-shadow-md" />}
                </div>
            </div>
            <div className="relative z-10 mt-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight text-white drop-shadow-sm">
                        {value}
                    </span>
                    {trend && (
                        <div
                            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                                background: `${trendColors[trend] || trendColors.stable}20`,
                                border: `1px solid ${trendColors[trend] || trendColors.stable}40`,
                                color: trendColors[trend] || trendColors.stable
                            }}
                        >
                            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
                            <span>{trend === 'up' ? 'Inc.' : trend === 'down' ? 'Dec.' : ''}</span>
                        </div>
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                )}
            </div>
        </div>
    );
}
