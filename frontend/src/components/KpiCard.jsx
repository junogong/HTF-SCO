export default function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
    const accentColors = {
        blue: 'var(--accent-primary)',
        green: 'var(--accent-success)',
        red: 'var(--accent-danger)',
        amber: 'var(--accent-warning)',
        purple: '#AB47BC',
    };

    const trendColors = {
        up: 'var(--accent-success)',
        down: 'var(--accent-danger)',
        stable: 'var(--text-secondary)',
    };

    const mainColor = accentColors[color] || accentColors.blue;

    return (
        <div className="glass-card flex flex-col gap-3 group" style={{ padding: '20px 24px' }}>
            <div className="flex items-start justify-between">
                <span style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '0',
                }}>
                    {title}
                </span>
                <div
                    style={{
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '9px',
                        background: `color-mix(in srgb, ${mainColor} 10%, transparent)`,
                        color: mainColor,
                    }}
                >
                    {Icon && <Icon size={18} />}
                </div>
            </div>
            <div>
                <div className="flex items-baseline gap-3">
                    <span style={{
                        fontSize: '28px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                    }}>
                        {value}
                    </span>
                    {trend && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                fontFamily: 'var(--font-sans)',
                                background: `color-mix(in srgb, ${trendColors[trend] || trendColors.stable} 10%, transparent)`,
                                color: trendColors[trend] || trendColors.stable,
                            }}
                        >
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
                            <span>{trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Stable'}</span>
                        </div>
                    )}
                </div>
                {subtitle && (
                    <p style={{
                        fontSize: '11px',
                        fontWeight: 400,
                        marginTop: '6px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                    }}>
                        {subtitle}
                    </p>
                )}
            </div>
            {/* Clean bottom accent on hover */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: '16px',
                right: '16px',
                height: '2px',
                borderRadius: '2px',
                background: mainColor,
                opacity: 0,
                transition: 'opacity 0.2s ease',
            }}
                className="group-hover:!opacity-100"
            />
        </div>
    );
}
