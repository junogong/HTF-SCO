import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react';

export default function HealthBadge({ score, size = 'md' }) {
    const config = getConfig(score);
    const sizes = {
        sm: { badge: 'px-2 py-0.5 text-[10px]', icon: 12 },
        md: { badge: 'px-3 py-1 text-xs', icon: 14 },
        lg: { badge: 'px-4 py-1.5 text-sm', icon: 16 },
    };
    const s = sizes[size] || sizes.md;
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-bold ${s.badge}`}
            style={{ background: config.bg, color: config.color }}
        >
            <Icon size={s.icon} />
            {score}
        </span>
    );
}

function getConfig(score) {
    if (score >= 80) return { icon: ShieldCheck, color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    if (score >= 60) return { icon: Shield, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
    if (score >= 40) return { icon: ShieldAlert, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { icon: ShieldX, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}
