import React, { useState } from 'react';
import { Assessment, RiskLevel } from '../../types';
import { RiskBadge } from './RiskBadge';
import { Check, Send, AlertTriangle, UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface DecisionPanelProps {
  assessment: Assessment;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ assessment }) => {
  const { recordUnderwriterDecision, openRequestInfoModal, currentUser } = useApp();
  const [selectedAction, setSelectedAction] = useState<'Approve' | 'Request Information' | 'Refer for Review' | null>(
    assessment.underwriterDecision?.selectedDecision || null
  );
  const [notes, setNotes] = useState(assessment.underwriterDecision?.underwriterNotes || '');
  const [stipulation, setStipulation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await recordUnderwriterDecision(assessment.id, selectedAction, notes, stipulation);
      setIsSubmitting(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Failed to record decision on server.');
    }
  };

  const handleRequestInfoAction = () => {
    setSelectedAction('Request Information');
    openRequestInfoModal(assessment.id, assessment.petName, 'Underwriter Direct Information Request');
  };

  return (
    <div className="p-6 rounded-xl bg-surface border border-surface-border">
      {/* Human In The Loop Header */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-border flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-950/60 border border-teal-800/40 text-brand-teal flex items-center justify-center">
            <UserCheck size={16} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Underwriting Authority &amp; Decision</h3>
            <p className="text-xs text-petText-secondary">
              Statutory human oversight. Binding underwriter decision overrides algorithm recommendations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface-elevated px-3 py-1.5 rounded-lg border border-surface-border text-xs">
          <span className="text-petText-muted">System Recommendation:</span>
          <RiskBadge level={assessment.riskLevel as RiskLevel} size="sm" />
        </div>
      </div>

      {showSuccessToast && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={15} />
          <span>Underwriter decision recorded successfully. Audit trail and policy ledger updated.</span>
        </div>
      )}

      {/* Decision Form */}
      <form onSubmit={handleSubmitDecision} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-petText-secondary mb-2">
            Authorized Underwriter Determination
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Action 1: Approve */}
            <button
              type="button"
              onClick={() => setSelectedAction('Approve')}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                selectedAction === 'Approve'
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-sm ring-1 ring-emerald-500/50'
                  : 'border-surface-border bg-surface-elevated hover:bg-surface-higher text-petText-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Approve</span>
                <Check size={16} className={selectedAction === 'Approve' ? 'text-emerald-400' : 'text-petText-dim'} />
              </div>
              <span className="text-[11px] text-petText-muted">
                Bind policy coverage according to selected deductible &amp; tier.
              </span>
            </button>

            {/* Action 2: Request Information */}
            <button
              type="button"
              onClick={handleRequestInfoAction}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                selectedAction === 'Request Information'
                  ? 'border-sky-500 bg-sky-950/40 text-sky-200 shadow-sm ring-1 ring-sky-500/50'
                  : 'border-surface-border bg-surface-elevated hover:bg-surface-higher text-petText-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Request Info</span>
                <Send size={15} className={selectedAction === 'Request Information' ? 'text-sky-400' : 'text-petText-dim'} />
              </div>
              <span className="text-[11px] text-petText-muted">
                Solicit clinical questionnaires or veterinary clarification records.
              </span>
            </button>

            {/* Action 3: Refer for Review */}
            <button
              type="button"
              onClick={() => setSelectedAction('Refer for Review')}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                selectedAction === 'Refer for Review'
                  ? 'border-rose-500 bg-rose-950/40 text-rose-200 shadow-sm ring-1 ring-rose-500/50'
                  : 'border-surface-border bg-surface-elevated hover:bg-surface-higher text-petText-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Refer for Review</span>
                <AlertTriangle size={15} className={selectedAction === 'Refer for Review' ? 'text-rose-400' : 'text-petText-dim'} />
              </div>
              <span className="text-[11px] text-petText-muted">
                Escalate to Chief Medical Officer or Veterinary Speciality Committee.
              </span>
            </button>
          </div>
        </div>

        {/* Optional Stipulation / Exclusion input */}
        <div>
          <label className="block text-xs font-medium text-petText-muted mb-1.5">
            Endorsement Stipulations / Waiting Period Waivers (Optional)
          </label>
          <input
            type="text"
            value={stipulation}
            onChange={e => setStipulation(e.target.value)}
            placeholder="e.g. 6-month bilateral stifle waiting period unless certified by specialist"
            className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-xs text-white placeholder-petText-dim focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors"
          />
        </div>

        {/* Notes textarea */}
        <div>
          <label className="block text-xs font-medium text-petText-muted mb-1.5">
            Underwriter Clinical Notes &amp; Actuarial Justification
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="State clinical reasoning, verified records, or conditions attached to this determination..."
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-surface-border text-xs text-white placeholder-petText-dim focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors resize-none leading-relaxed"
          />
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Sign & Record Decision Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-petText-dim flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-brand-teal" />
            <span>
              Authenticated as{' '}
              <strong>
                {currentUser?.fullName || 'Sarah Jenkins'} ({currentUser?.role || 'Senior Underwriting Officer'})
              </strong>
            </span>
          </div>

          <button
            type="submit"
            disabled={!selectedAction || isSubmitting}
            className="px-5 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording Decision...' : 'Commit Underwriting Determination'}
          </button>
        </div>
      </form>

      {/* Decision History Audit Log */}
      <div className="mt-8 pt-6 border-t border-surface-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-petText-muted mb-3">
          Decision Audit Trail &amp; Regulatory History
        </h4>

        <div className="space-y-3">
          {(assessment.decisionHistory || []).map((entry) => (
            <div
              key={entry.id}
              className="p-3.5 rounded-lg bg-surface-elevated/70 border border-surface-border text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{entry.user}</span>
                  <span className="text-[10px] text-petText-dim font-mono">({entry.role})</span>
                  <span className="text-petText-dim">·</span>
                  <span className="font-mono text-petText-muted text-[11px]">{entry.timestamp}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-higher text-petText-primary border border-surface-border">
                  Action: {entry.action}
                </span>
              </div>

              <p className="text-petText-secondary leading-relaxed pl-1 border-l-2 border-brand-teal/60">
                {entry.notes}
              </p>

              <div className="flex items-center gap-3 text-[10px] text-petText-dim font-mono pt-1">
                <span>Rule Score at Event: {entry.ruleScoreAtTime}</span>
                <span>·</span>
                <span>ML Score at Event: {entry.mlScoreAtTime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
