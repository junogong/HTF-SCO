import { useState } from 'react';
import {
    Mail, Settings, Package, AlertTriangle, Check, X,
    ChevronDown, ChevronUp, MessageSquare
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

export default function ActionCenter({ analysisResult }) {
    const [actions, setActions] = useState(analysisResult?.actions || []);
    const [approvedIds, setApprovedIds] = useState(new Set());
    const [expandedEmail, setExpandedEmail] = useState(null);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [actualOutcome, setActualOutcome] = useState('');
    const [feedbackSent, setFeedbackSent] = useState(false);

    const handleApprove = async (actionId) => {
        try {
            await api.post('/action/approve', { action_id: actionId, approved: true });
            setApprovedIds(prev => new Set([...prev, actionId]));
        } catch (err) {
            console.error(err);
        }
    };

    const handleReject = async (actionId) => {
        try {
            await api.post('/action/approve', { action_id: actionId, approved: false });
            setActions(prev => prev.filter(a => a.id !== actionId));
        } catch (err) {
            console.error(err);
        }
    };

    const submitFeedback = async () => {
        if (!rating) return;
        try {
            await api.post('/feedback', {
                strategy_id: analysisResult?.strategy_id || 'unknown',
                rating,
                comment: feedback,
                actual_outcome: actualOutcome || undefined,
            });
            setFeedbackSent(true);
        } catch (err) {
            console.error(err);
        }
    };

    const lowConfidence = analysisResult?.strategy?.requires_manual_review;

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
                    <Settings size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No pending actions. Run a disruption analysis first.
                    </p>
                </div>
            )}

            {/* Action cards */}
            <div className="space-y-3 stagger-children">
                {actions.map((action) => {
                    const Icon = ACTION_ICONS[action.type] || Settings;
                    const color = ACTION_COLORS[action.type] || '#3b82f6';
                    const isApproved = approvedIds.has(action.id);

                    return (
                        <div
                            key={action.id}
                            className="glass-card transition-all"
                            style={{
                                borderColor: lowConfidence && !isApproved ? 'rgba(245, 158, 11, 0.4)' : undefined,
                                background: lowConfidence && !isApproved ? 'rgba(245, 158, 11, 0.04)' : undefined,
                            }}
                        >
                            {/* Low confidence banner */}
                            {lowConfidence && !isApproved && (
                                <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                                    <AlertTriangle size={12} />
                                    Manual Review Required — Confidence below 70%
                                </div>
                            )}

                            <div className="flex items-start gap-4">
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
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {isApproved ? (
                                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400">
                                            <Check size={14} /> Approved
                                        </span>
                                    ) : (
                                        <>
                                            <button onClick={() => handleApprove(action.id)} className="btn-primary py-2 px-3 text-xs">
                                                <Check size={14} /> Approve
                                            </button>
                                            <button onClick={() => handleReject(action.id)} className="btn-outline py-2 px-3 text-xs" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                                                <X size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Feedback section */}
            {actions.length > 0 && (
                <div className="glass-card">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                        Strategy Feedback
                    </h3>

                    {feedbackSent ? (
                        <div className="text-center py-6 animate-fade-in">
                            <Check size={32} className="mx-auto mb-2 text-emerald-400" />
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Feedback recorded!</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Your input improves future AI recommendations via the Reflection Engine.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Rate this strategy
                                </label>
                                <StarRating value={rating} onChange={setRating} size={28} />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    <MessageSquare size={12} className="inline mr-1" />Comment (optional)
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    placeholder="What worked well? What could be improved?"
                                    value={feedback}
                                    onChange={e => setFeedback(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Actual Outcome (optional — powers the Reflection Engine)
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    placeholder="e.g., 'Rerouting worked but cost 10% more than projected'"
                                    value={actualOutcome}
                                    onChange={e => setActualOutcome(e.target.value)}
                                />
                            </div>
                            <button className="btn-primary" onClick={submitFeedback} disabled={!rating}>
                                Submit Feedback
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
