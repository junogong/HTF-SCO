import {
    LayoutDashboard, GitBranch, AlertTriangle, CheckSquare,
    Shield, ShieldCheck, Wind
} from 'lucide-react';

const navItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'graph', label: 'SUPPLY GRAPH', icon: GitBranch },
    { id: 'disruption', label: 'DISRUPTION ANALYSIS', icon: AlertTriangle },
    { id: 'stress-test', label: 'WIND TUNNEL', icon: Wind },
    { id: 'actions', label: 'ACTION CENTER', icon: CheckSquare },
    { id: 'safety', label: 'RESPONSIBLE AI', icon: ShieldCheck },
];

export default function Sidebar({ activePage, onNavigate, pendingActionsCount }) {
    return (
        <aside
            className="fixed left-0 top-0 h-screen z-50 flex flex-col w-[240px] transition-all"
            style={{
                background: 'var(--bg-primary)',
                borderRight: '1px solid var(--border)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-8 relative" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: 'var(--accent-primary-20)', border: '1px solid var(--accent-primary)' }}>
                    <Shield size={16} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                    <h1 className="text-[16px] font-bold tracking-widest font-mono text-white">
                        SYS_SCR
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 font-mono" style={{ color: 'var(--accent-primary)' }}>
                        [ COMMAND_CENTER ]
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    const showBadge = item.id === 'actions' && pendingActionsCount > 0;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2 transition-all duration-100 relative group font-mono
                                ${isActive ? 'text-[var(--bg-primary)]' : 'hover:bg-[var(--bg-secondary)] hover:text-white'}
                            `}
                            style={{
                                background: isActive ? 'var(--accent-primary)' : 'transparent',
                                color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                border: '1px solid',
                                borderColor: isActive ? 'var(--accent-primary)' : 'transparent',
                            }}
                        >
                            {/* Active pill indicator */}
                            {isActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--bg-primary)] opacity-50" />
                            )}

                            <Icon size={16} className={`flex-shrink-0 transition-transform duration-100 ${isActive ? 'text-[var(--bg-primary)]' : 'group-hover:text-white'}`} />
                            <span className={`text-[12px] tracking-widest flex-1 text-left ${isActive ? 'font-bold' : 'font-medium'}`}>
                                {item.label}
                            </span>

                            {/* Notification Badge */}
                            {showBadge && (
                                <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold"
                                    style={{
                                        background: isActive ? 'var(--bg-primary)' : 'var(--accent-danger)',
                                        color: isActive ? 'var(--accent-danger)' : 'var(--text-on-accent)',
                                        border: isActive ? 'none' : '1px solid var(--accent-danger)',
                                    }}
                                >
                                    {pendingActionsCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Status indicator */}
            <div className="p-4 mt-auto border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="relative flex items-center gap-3">
                        <div className="relative flex w-2 h-2">
                            <span className="animate-blink absolute inline-flex h-full w-full bg-[var(--accent-primary)] opacity-75"></span>
                            <span className="relative inline-flex w-2 h-2 bg-[var(--accent-primary)]"></span>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-white tracking-widest font-mono">STATUS: OK</p>
                            <p className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>// UPLINK_SECURE</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
