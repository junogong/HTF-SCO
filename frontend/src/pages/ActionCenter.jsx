import { useState, useEffect } from 'react';
import {
    Mail, Settings, Package, AlertTriangle, Check, X,
    ChevronDown, ChevronUp, MessageSquare, Radio, DollarSign
} from 'lucide-react';
import StarRating from '../components/StarRating';
import api from '../api/client';

const ACTION_ICONS = {
    supplier_email: Mail,
    erp_adjustment: Settings,
    preemptive_stock_build: Package,
    executive_escalation: AlertTriangle,
};

const ACTION_COLORS = {
    supplier_email: '#3b82f6',
    erp_adjustment: '#10b981',
    preemptive_stock_build: '#8b5cf6',
    executive_escalation: '#ef4444',
};

export default function ActionCenter({ disruptionHistory = [], dismissedActionIds = new Set(), onDismissAction }) {
    const [expandedEmail, setExpandedEmail] = useState(null);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [actualOutcome, setActualOutcome] = useState('');
    const [feedbackSent, setFeedbackSent] = useState(false);
    const [ratedActionId, setRatedActionId] = useState(null);
    const [expandedDisruptions, setExpandedDisruptions] = useState(new Set());

    // Derive visible actions, grouped by disruption
    const disruptionsWithActions = [];
    let totalActions = 0;
    for (const disruption of disruptionHistory) {
        const dActions = disruption.actions || [];
        const pendingActions = dActions.filter(a => !dismissedActionIds.has(a.id));
        if (pendingActions.length > 0) {
            totalActions += pendingActions.length;
            disruptionsWithActions.push({
                disruptionName: disruption.strategy?.name || disruption.classification?.category || 'Disruption Event',
                strategyId: disruption.strategy_id || 'unknown',
                lowConfidence: disruption.strategy?.requires_manual_review,
                revenueAtRisk: disruption.strategy?.revenue_at_risk || 0,
                severity: disruption.classification?.severity,
                trustScore: disruption.guardrails?.trust_score,
                source: disruption.source,
                actions: pendingActions.map(a => ({
                    ...a,
                    strategyId: disruption.strategy_id || 'unknown'
                }))
            });
        }
    }

    const toggleDisruption = (id) => {
        setExpandedDisruptions(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Reset UI state when navigating
    useEffect(() => {
        setExpandedEmail(null);
        setFeedbackSent(false);
        setRating(0);
        setFeedback('');
        setActualOutcome('');
        setRatedActionId(null);
        setExpandedDisruptions(new Set());
    }, [disruptionHistory.length]);

    const handleApprove = async (actionId) => {
        try {
            await api.post('action/approve', { action_id: actionId, approved: true });
            onDismissAction?.(actionId);  // permanently remove
        } catch (err) {
            console.error(err);
        }
    };

    const handleReject = async (actionId) => {
        try {
            await api.post('action/approve', { action_id: actionId, approved: false });
            onDismissAction?.(actionId);  // permanently remove
        } catch (err) {
            console.error(err);
        }
    };

    const submitFeedback = async (actionId, strategyId) => {
        if (!rating) return;
        try {
            await api.post('feedback', {
                strategy_id: strategyId,
                action_id: actionId,
                rating,
                comment: feedback,
                actual_outcome: actualOutcome || undefined,
            });
            setFeedbackSent(true);
            setRatedActionId(actionId);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Action Center
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Review, approve, or reject AI-generated mitigation actions
                </p>
            </div>

            {totalActions === 0 && (
                <div className="glass-card text-center py-16">
                    <Check size={40} className="mx-auto mb-3 opacity-30 text-emerald-500" />
                    <h3 className="text-lg font-bold text-white mb-1">You're all caught up!</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No pending actions require your attention across the supply chain.
                    </p>
                </div>
            )}

            {/* Disruption Groups */}
            <div className="space-y-4 stagger-children">
                {disruptionsWithActions.map(group => (
                    <div key={group.strategyId} className="glass-card overflow-hidden transition-all" style={{ padding: 0 }}>
                        <div
                            className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => toggleDisruption(group.strategyId)}
                            style={{ borderBottom: expandedDisruptions.has(group.strategyId) ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(79, 195, 247, 0.1)' }}>
                                    <AlertTriangle size={14} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-200">{group.disruptionName}</h3>
                                    <p className="text-xs text-slate-400 mb-1">{group.actions.length} pending action{group.actions.length !== 1 ? 's' : ''}</p>

                                    {/* KPI Chips */}
                                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                        {/* Revenue at Risk */}
                                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1"
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                                color: '#f87171',
                                                fontFamily: 'var(--font-mono)',
                                            }}>
                                            <DollarSign size={9} />
                                            {((group.revenueAtRisk || 0) / 1e6).toFixed(1)}M
                                        </span>

                                        {/* Severity */}
                                        {group.severity != null && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${group.severity >= 7
                                                ? 'bg-red-500/15 text-red-400'
                                                : group.severity >= 4
                                                    ? 'bg-amber-500/15 text-amber-400'
                                                    : 'bg-blue-500/15 text-blue-400'
                                                }`} style={{ fontFamily: 'var(--font-mono)' }}>
                                                SEV {group.severity}
                                            </span>
                                        )}

                                        {/* Trust Score */}
                                        {group.trustScore != null && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${group.trustScore >= 80
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : group.trustScore >= 60
                                                    ? 'bg-amber-500/10 text-amber-400'
                                                    : 'bg-red-500/10 text-red-400'
                                                }`} style={{ fontFamily: 'var(--font-mono)' }}>
                                                Trust {group.trustScore}%
                                            </span>
                                        )}

                                        {/* Wind Tunnel badge */}
                                        {group.source === 'wind-tunnel' && (
                                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                                                Wind Tunnel
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {group.lowConfidence && (
                                    <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-500 font-bold flex items-center gap-1">
                                        <AlertTriangle size={10} /> Review req.
                                    </span>
                                )}
                                {expandedDisruptions.has(group.strategyId) ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </div>
                        </div>

                        {expandedDisruptions.has(group.strategyId) && (
                            <div className="p-4 space-y-3 bg-[rgba(0,0,0,0.2)]">
                                {group.actions.map((action) => {
                                    const Icon = ACTION_ICONS[action.type] || Settings;
                                    const color = ACTION_COLORS[action.type] || '#3b82f6';

                                    return (
                                        <div
                                            key={action.id}
                                            className="glass-card transition-all relative overflow-hidden group"
                                            style={{
                                                borderColor: group.lowConfidence ? 'rgba(245, 158, 11, 0.4)' : undefined,
                                                background: group.lowConfidence ? 'rgba(245, 158, 11, 0.04)' : undefined,
                                            }}
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Icon */}
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
                                                    style={{ background: `${color}15` }}>
                                                    <Icon size={18} style={{ color }} />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{action.title}</h4>
                                                        <span className={`badge badge-${action.priority?.toLowerCase()}`}>{action.priority}</span>
                                                        {action.timeline && (
                                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>⏱ {action.timeline}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{action.description}</p>

                                                    {/* Expandable email */}
                                                    {action.email && (
                                                        <div className="mt-3">
                                                            <button
                                                                onClick={() => setExpandedEmail(expandedEmail === action.id ? null : action.id)}
                                                                className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                                                            >
                                                                <Mail size={12} />
                                                                {expandedEmail === action.id ? 'Hide' : 'View'} Generated Email
                                                                {expandedEmail === action.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                            {expandedEmail === action.id && (
                                                                <div className="mt-2 p-3 rounded-lg text-xs animate-fade-in"
                                                                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                                                    <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                                                                        To: {action.target_supplier}
                                                                    </p>
                                                                    <p className="font-semibold mb-2" style={{ color: 'var(--accent-blue)' }}>
                                                                        Subject: {action.email.subject}
                                                                    </p>
                                                                    <pre className="whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                                        {action.email.body}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Inline Feedback section for this specific action context if rated */}
                                                    {feedbackSent && ratedActionId === action.id && (
                                                        <div className="mt-3 p-3 rounded-lg flex items-center gap-2 animate-fade-in" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                            <Check size={14} className="text-emerald-400" />
                                                            <span className="text-[11px] font-semibold text-emerald-400">Feedback recorded to Reflection Engine</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button onClick={() => handleApprove(action.id)} className="btn-primary py-2 px-3 text-xs">
                                                        <Check size={14} /> Approve
                                                    </button>
                                                    <button onClick={() => handleReject(action.id)} className="btn-outline py-2 px-3 text-xs" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Global Context Feedback Note */}
            {totalActions > 0 && (
                <div className="text-center py-4">
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <MessageSquare size={12} className="inline mr-1" />
                        AI strategy generation is continuously improved by your approval and rejection decisions via the Reflection Engine.
                    </p>
                </div>
            )}
        </div>
    );
}
