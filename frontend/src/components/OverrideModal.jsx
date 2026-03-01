import { useState } from 'react';
import { ShieldAlert, Lock, CheckCircle, X, AlertTriangle } from 'lucide-react';

export default function OverrideModal({ isOpen, onClose, onConfirm, strategy, guardrails }) {
    const [confirmText, setConfirmText] = useState('');
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    const canConfirm = confirmText.toLowerCase() === 'override' && reason.length > 10;
    const revenueAtRisk = strategy?.revenue_at_risk || 0;
    const checks = guardrails?.checks || [];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                <div
                    className="w-full max-w-lg rounded-2xl animate-fade-in"
                    style={{
                        background: 'var(--bg-card)',
                        border: '2px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 0 60px rgba(239, 68, 68, 0.15)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 p-5 rounded-t-2xl"
                        style={{ background: 'rgba(239, 68, 68, 0.08)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15">
                            <Lock size={20} className="text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-red-400">High-Stakes Supervisor Override</h3>
                            <p className="text-xs text-red-300/60 mt-0.5">
                                This action requires manual authorization — HITL Safety Protocol
                            </p>
                        </div>
                        <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-white/5 transition-colors">
                            <X size={18} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                        {/* Risk Summary */}
                        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Revenue at Risk</p>
                                    <p className="text-xl font-bold text-red-400 font-mono">${revenueAtRisk.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">HITL Threshold</p>
                                    <p className="text-xl font-bold text-amber-400 font-mono">$50,000</p>
                                </div>
                            </div>
                            <p className="text-xs text-center mt-2 text-red-300/70">
                                ⚠️ {strategy?.hitl_reason || 'Revenue-at-Risk exceeds safety threshold'}
                            </p>
                        </div>

                        {/* Guardrails Checks */}
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                Guardrails Validation Report
                            </h4>
                            <div className="space-y-1">
                                {checks.map((check, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg"
                                        style={{ background: check.passed ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
                                        {check.passed
                                            ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                                            : <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                                        }
                                        <span className="flex-1" style={{ color: check.passed ? 'var(--text-secondary)' : '#fca5a5' }}>
                                            {check.check}: {check.details}
                                        </span>
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                                            style={{
                                                background: check.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                                color: check.severity === 'critical' ? '#ef4444' : '#f59e0b',
                                            }}>
                                            {check.severity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Override form */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium block mb-1.5 text-slate-400">
                                    Justification (required — min 10 characters)
                                </label>
                                <textarea
                                    className="input-field text-sm"
                                    rows={2}
                                    placeholder="Explain why you are overriding the AI recommendation..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1.5 text-slate-400">
                                    Type <span className="font-mono text-red-400 font-bold">OVERRIDE</span> to confirm
                                </label>
                                <input
                                    className="input-field font-mono text-sm text-center tracking-widest"
                                    placeholder="OVERRIDE"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    style={{ borderColor: confirmText.toLowerCase() === 'override' ? '#10b981' : undefined }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-5"
                        style={{ borderTop: '1px solid var(--border)' }}>
                        <button onClick={onClose} className="btn-outline text-sm">
                            Cancel
                        </button>
                        <button
                            onClick={() => { onConfirm(reason); onClose(); }}
                            disabled={!canConfirm}
                            className="btn-danger text-sm flex items-center gap-2"
                            style={{ opacity: canConfirm ? 1 : 0.4 }}
                        >
                            <ShieldAlert size={16} />
                            Authorize Override
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
