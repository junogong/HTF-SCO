import {
    LayoutDashboard, GitBranch, AlertTriangle, CheckSquare,
    ShieldCheck, Wind
} from 'lucide-react';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'graph', label: 'Supply Graph', icon: GitBranch },
    { id: 'disruption', label: 'Disruption Analysis', icon: AlertTriangle },
    { id: 'stress-test', label: 'Wind Tunnel', icon: Wind },
    { id: 'actions', label: 'Action Center', icon: CheckSquare },
    { id: 'safety', label: 'Responsible AI', icon: ShieldCheck },
];

export default function Sidebar({ activePage, onNavigate, pendingActionsCount }) {
    return (
        <aside
            className="fixed left-0 top-0 h-screen z-50 flex flex-col w-[240px]"
            style={{
                background: 'var(--bg-primary)',
                borderRight: '1px solid var(--border)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-7" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'transparent',
                        borderRadius: '10px',
                        overflow: 'hidden'
                    }}>
                    <img src="/logo.png" alt="Supplytics Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                    }}>
                        Supplytics
                    </h1>
                    <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--accent-primary)',
                        lineHeight: 1.2,
                        marginTop: '2px',
                    }}>
                        Control Tower
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    const showBadge = item.id === 'actions' && pendingActionsCount > 0;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 transition-all relative group"
                            style={{
                                background: isActive ? 'var(--accent-primary-10)' : 'transparent',
                                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                borderRadius: '8px',
                                border: 'none',
                                fontFamily: 'var(--font-sans)',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }
                            }}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    left: '0',
                                    top: '8px',
                                    bottom: '8px',
                                    width: '3px',
                                    borderRadius: '0 3px 3px 0',
                                    background: 'var(--accent-primary)',
                                }} />
                            )}

                            <Icon size={17} style={{ flexShrink: 0 }} />
                            <span style={{
                                fontSize: '13px',
                                fontWeight: isActive ? 600 : 500,
                                flex: 1,
                                textAlign: 'left',
                            }}>
                                {item.label}
                            </span>

                            {/* Notification Badge */}
                            {showBadge && (
                                <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '20px',
                                    height: '20px',
                                    padding: '0 6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: 'var(--accent-danger)',
                                    color: 'white',
                                    borderRadius: '10px',
                                }}>
                                    {pendingActionsCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Status indicator */}
            <div className="p-4 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
                <div style={{
                    padding: '12px 14px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                }}>
                    <div className="flex items-center gap-3">
                        <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: 'var(--accent-success)',
                            boxShadow: '0 0 8px rgba(129, 199, 132, 0.4)',
                            animation: 'pulse-soft 2s ease-in-out infinite',
                        }} />
                        <div>
                            <p style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-sans)',
                            }}>
                                System Online
                            </p>
                            <p style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)',
                                marginTop: '1px',
                            }}>
                                All services operational
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
