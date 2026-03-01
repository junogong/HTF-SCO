import {
    LayoutDashboard, GitBranch, AlertTriangle, CheckSquare,
    UserPlus, Shield, ShieldCheck, Wind
} from 'lucide-react';

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'graph', label: 'Supply Graph', icon: GitBranch },
    { id: 'disruption', label: 'Disruption Analysis', icon: AlertTriangle },
    { id: 'stress-test', label: 'Wind Tunnel', icon: Wind },
    { id: 'actions', label: 'Action Center', icon: CheckSquare },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'safety', label: 'Responsible AI', icon: ShieldCheck },
];

export default function Sidebar({ activePage, onNavigate }) {
    return (
        <aside
            className="fixed left-0 top-0 h-screen z-50 flex flex-col w-[220px]"
            style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid var(--border)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--gradient-primary)' }}>
                    <Shield size={18} className="text-white" />
                </div>
                <div>
                    <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>SCR Agent</h1>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Control Tower</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive ? 'text-white' : 'hover:bg-white/5'}`}
                            style={{
                                background: isActive ? 'var(--gradient-primary)' : 'transparent',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                            }}
                        >
                            <Icon size={18} className="flex-shrink-0" />
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Status indicator */}
            <div className="px-4 pb-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        System Active
                    </span>
                </div>
            </div>
        </aside>
    );
}
