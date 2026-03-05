import { useState, useEffect } from 'react';
import {
    Mail, Settings, Package, AlertTriangle, Check, X,
    ChevronDown, ChevronUp, MessageSquare, Radio
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

    // Derive visible actions by flattening from all disruptions in history
    const actions = [];
    for (const disruption of disruptionHistory) {
        const dActions = disruption.actions || [];
        for (const a of dActions) {
            if (!dismissedActionIds.has(a.id)) {
                actions.push({
                    ...a,
                    disruptionName: disruption.strategy?.name || disruption.classification?.category || 'Disruption Event',
                    strategyId: disruption.strategy_id || 'unknown',
                    lowConfidence: disruption.strategy?.requires_manual_review
                });
            }
        }
    }

    // Reset UI state when navigating
    useEffect(() => {
        setExpandedEmail(null);
        setFeedbackSent(false);
        setRating(0);
        setFeedback('');
        setActualOutcome('');
        setRatedActionId(null);
    }, [disruptionHistory.length]);

    const handleApprove = async (actionId) => {
        try {
            await api.post('/action/approve', { action_id: actionId, approved: true });
            onDismissAction?.(actionId);  // permanently remove
        } catch (err) {
            console.error(err);
        }
    };

    const handleReject = async (actionId) => {
        try {
            await api.post('/action/approve', { action_id: actionId, approved: false });
            onDismissAction?.(actionId);  // permanently remove
        } catch (err) {
            console.error(err);
        }
    };

    const submitFeedback = async (actionId, strategyId) => {
        if (!rating) return;
        try {
            await api.post('/feedback', {
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

            {!actions.length && (
                <div className="glass-card text-center py-16">
                    <Check size={40} className="mx-auto mb-3 opacity-30 text-emerald-500" />
                    <h3 className="text-lg font-bold text-white mb-1">You're all caught up!</h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No pending actions require your attention across the supply chain.
                    </p>
                </div>
            )}

            {/* Action cards */}
            <div className="space-y-3 stagger-children">
                {actions.map((action) => {
                    const Icon = ACTION_ICONS[action.type] || Settings;
                    const color = ACTION_COLORS[action.type] || '#3b82f6';

                    return (
                        <div
                            key={action.id}
                            className="glass-card transition-all relative overflow-hidden group"
                            style={{
                                borderColor: action.lowConfidence ? 'rgba(245, 158, 11, 0.4)' : undefined,
                                background: action.lowConfidence ? 'rgba(245, 158, 11, 0.04)' : undefined,
                            }}
                        >
                            {/* Context banner across the top */}
                            <div className="absolute top-0 left-0 right-0 px-4 py-1.5 text-[10px] font-bold tracking-wider flex items-center gap-2"
                                style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <Radio size={10} className="text-indigo-400" />
                                <span style={{ color: 'var(--text-muted)' }}>TRIGGERED BY:</span>
                                <span className="text-slate-300 truncate">{action.disruptionName}</span>
                            </div>

                            {/* Low confidence banner */}
                            {action.lowConfidence && (
                                <div className="flex items-center gap-2 mt-7 mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                                    <AlertTriangle size={12} />
                                    Manual Review Required — Confidence below 70%
                                </div>
                            )}

                            <div className={`flex items-start gap-4 ${!action.lowConfidence ? 'mt-8' : ''}`}>
                                {/* Icon */}
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
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

            {/* Global Context Feedback Note */}
            {actions.length > 0 && (
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
