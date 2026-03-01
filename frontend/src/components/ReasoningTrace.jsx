import {
    Radio, GitBranch, Brain, Swords, ShieldCheck,
    CheckCircle, Clock, AlertTriangle, Tag, Bookmark
} from 'lucide-react';

const iconMap = {
    'radio': Radio,
    'git-branch': GitBranch,
    'brain': Brain,
    'swords': Swords,
    'shield-check': ShieldCheck,
};

// Source type → color scheme
const sourceColors = {
    'Signal': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', icon: Radio },
    'GQL': { bg: 'rgba(16,185,129,0.12)', color: '#34d399', icon: GitBranch },
    'Spanner': { bg: 'rgba(16,185,129,0.12)', color: '#34d399', icon: GitBranch },
    'Firestore': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', icon: Bookmark },
    'Memory': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', icon: Bookmark },
    'Gemini': { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', icon: Brain },
    'Vertex': { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', icon: Brain },
    'Fact-Checker': { bg: 'rgba(239,68,68,0.12)', color: '#f87171', icon: ShieldCheck },
    'Deterministic': { bg: 'rgba(239,68,68,0.12)', color: '#f87171', icon: ShieldCheck },
    'Risk Control': { bg: 'rgba(239,68,68,0.12)', color: '#f87171', icon: AlertTriangle },
    'Multi-Agent': { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', icon: Swords },
};

function getSourceStyle(source) {
    if (!source) return { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' };
    for (const [key, style] of Object.entries(sourceColors)) {
        if (source.includes(key)) return style;
    }
    return { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' };
}

export default function ReasoningTrace({ trace = [] }) {
    if (!trace.length) return null;

    return (
        <div className="relative pl-8">
            {/* Vertical line */}
            <div
                className="absolute left-[15px] top-4 bottom-4 w-[2px]"
                style={{ background: 'linear-gradient(180deg, var(--accent-blue) 0%, var(--accent-cyan) 50%, var(--accent-emerald) 100%)' }}
            />

            <div className="space-y-6">
                {trace.map((step, i) => {
                    const Icon = iconMap[step.icon] || CheckCircle;
                    const sourceStyle = getSourceStyle(step.source);
                    return (
                        <div
                            key={i}
                            className="relative animate-slide-in"
                            style={{ animationDelay: `${i * 0.12}s` }}
                        >
                            {/* Node dot */}
                            <div
                                className="absolute -left-8 top-1 w-[30px] h-[30px] rounded-full flex items-center justify-center z-10"
                                style={{
                                    background: step.status === 'complete' ? 'var(--gradient-primary)' : 'var(--bg-card)',
                                    border: '2px solid var(--accent-blue)',
                                }}
                            >
                                <Icon size={14} className="text-white" />
                            </div>

                            {/* Content card */}
                            <div className="glass-card ml-2 py-3 px-4">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                        Step {step.step}: {step.title}
                                    </h4>
                                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                        <Clock size={10} className="inline mr-1" />
                                        {step.duration_ms}ms
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    {step.description}
                                </p>
                                {/* Source attribution tag — enhanced with type-specific coloring */}
                                {step.source && (
                                    <div
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold"
                                        style={{ background: sourceStyle.bg, color: sourceStyle.color }}
                                    >
                                        <Tag size={10} />
                                        <span className="font-mono tracking-wide">Source:</span> {step.source}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
