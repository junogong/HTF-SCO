export default function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
    const accentColors = {
        blue: 'var(--accent-primary)', // Redirecting 'blue' to the primary green accent
        green: 'var(--accent-primary)',
        red: 'var(--accent-danger)',
        amber: 'var(--accent-warning)',
        purple: 'var(--accent-primary)', // Or mapped to something else, stick to primary
    };

    const trendColors = {
        up: 'var(--accent-primary)',
        down: 'var(--accent-danger)',
        stable: 'var(--text-secondary)',
    };

    const mainColor = accentColors[color] || accentColors.blue;

    return (
        <div className="glass-card flex flex-col gap-4 group">
            <div className="flex items-start justify-between relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-widest font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {title}
                </span>
                <div
                    className="w-8 h-8 flex items-center justify-center transition-all duration-100"
                    style={{
                        background: 'transparent',
                        border: `1px solid ${mainColor}`,
                        color: mainColor
                    }}
                >
                    {Icon && <Icon size={16} />}
                </div>
            </div>
            <div className="relative z-10 mt-1">
                <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold tracking-tight text-white metric-value">
                        {value}
                    </span>
                    {trend && (
                        <div
                            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold font-mono"
                            style={{
                                background: 'transparent',
                                border: `1px solid ${trendColors[trend] || trendColors.stable}`,
                                color: trendColors[trend] || trendColors.stable
                            }}
                        >
                            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'}
                            <span>{trend === 'up' ? 'INC' : trend === 'down' ? 'DEC' : 'STB'}</span>
                        </div>
                    )}
                </div>
                {subtitle && (
                    <p className="text-[10px] font-medium mt-2 font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                )}
            </div>
            {/* Terminal decorative bar at the bottom */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-white opacity-20 transition-all duration-300 group-hover:opacity-100 group-hover:w-full w-0" style={{ background: mainColor }}></div>
        </div>
    );
}
