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
            className="fixed left-0 top-0 h-screen z-50 flex flex-col w-[240px] transition-all"
            style={{
                background: 'rgba(2, 6, 23, 0.65)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '10px 0 30px -10px rgba(0, 0, 0, 0.5)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-8 relative">
                <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative group"
                    style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px -2px rgba(99, 102, 241, 0.4)' }}>
                    <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                    <Shield size={20} className="text-white drop-shadow-md" />
                </div>
                <div>
                    <h1 className="text-[15px] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                        SCR Agent
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--accent-cyan)' }}>
                        Control Tower
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden group
                                ${isActive ? 'text-white' : 'hover:bg-white/5 hover:text-slate-200'}
                            `}
                            style={{
                                background: isActive ? 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, transparent 100%)' : 'transparent',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                                border: '1px solid transparent',
                                borderColor: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                            }}
                        >
                            {/* Active pill indicator */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
                            )}

                            <Icon size={18} className={`flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] text-indigo-400' : 'group-hover:scale-110'}`} />
                            <span className={`text-[13px] tracking-wide transition-all ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Status indicator */}
            <div className="p-4 mt-auto">
                <div className="relative rounded-xl overflow-hidden p-4" style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-50" />
                    <div className="relative flex items-center gap-3">
                        <div className="relative flex w-3 h-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full w-3 h-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-white tracking-wide">System Active</p>
                            <p className="text-[10px] font-medium text-emerald-400/80 mt-0.5">All services online</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
