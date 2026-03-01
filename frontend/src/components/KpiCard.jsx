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
        <div className="glass-card flex flex-col gap-3 group">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {title}
                </span>
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ background: gradients[color] || gradients.blue }}
                >
                    {Icon && <Icon size={16} className="text-white" />}
                </div>
            </div>
            <div>
                <span className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {value}
                </span>
                {trend && (
                    <span className="ml-2 text-xs font-semibold" style={{ color: trendColors[trend] || trendColors.stable }}>
                        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                    </span>
                )}
            </div>
            {subtitle && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
            )}
        </div>
    );
}
