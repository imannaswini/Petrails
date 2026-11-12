import React, { useState, useEffect } from 'react';
import { Assessment, RiskLevel } from '../../types';
import { RiskBadge } from './RiskBadge';
import { Check, Send, AlertTriangle, UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatExactLocalDateTime } from '../../utils/dateTime';

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
  useEffect(() => {
    setSelectedAction(assessment.underwriterDecision?.selectedDecision || null);
    setNotes(assessment.underwriterDecision?.underwriterNotes || '');
  }, [assessment.id, assessment.underwriterDecision?.selectedDecision, assessment.underwriterDecision?.underwriterNotes]);

  const userTier = currentUser?.authorityTier || 'tier-3';
  const userLimit = currentUser?.authorityLimitInr || 500000;
  const isHighRisk = assessment.riskLevel === 'HIGH';
  const isRestrictedFromApproval = userTier === 'tier-1' && isHighRisk;

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;

    if (selectedAction === 'Approve' && isRestrictedFromApproval) {
      setErrorMessage("Tier 1 authority is restricted from approving HIGH risk policies. Please select 'Refer for Review' to escalate.");
      return;
    }

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
            <h3 className="text-base font-semibold text-white">Underwriting Decision</h3>
            <p className="text-xs text-petText-secondary">
              Authorized underwriter determination. All decisions require justification and are recorded in the activity history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface-elevated px-3 py-1.5 rounded-lg border border-surface-border text-xs">
          <span className="text-petText-muted">Risk Classification:</span>
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
      {assessment.underwriterDecision?.selectedDecision && <div className="mt-4 p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs">
        <p className="font-semibold text-white">Current decision: {assessment.underwriterDecision.selectedDecision}</p>
        <p className="text-petText-secondary mt-1">{assessment.underwriterDecision.underwriterNotes || 'No justification recorded.'}</p>
        <p className="text-petText-muted mt-1">By {assessment.underwriterDecision.lastModifiedBy || 'Unavailable'} · {formatExactLocalDateTime(assessment.underwriterDecision.lastModifiedAt)}</p>
      </div>}
      <form onSubmit={handleSubmitDecision} className="mt-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-petText-secondary">
              Authorized Determination (Permission Level: {userTier.toUpperCase()})
            </label>
            <span className="text-[11px] font-mono text-brand-teal">
              Authority Cap: ₹{userLimit.toLocaleString('en-IN')}
            </span>
          </div>

          {isRestrictedFromApproval && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0 text-amber-400" />
              <span>
                Tier 1 authority limit restricts independent approval on HIGH risk policies. Referral for review is required.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Action 1: Approve */}
            <button
              type="button"
              disabled={isRestrictedFromApproval}
              onClick={() => setSelectedAction('Approve')}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                isRestrictedFromApproval
                  ? 'border-surface-border bg-surface-elevated/40 text-petText-dim opacity-50 cursor-not-allowed'
                  : selectedAction === 'Approve'
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-sm ring-1 ring-emerald-500/50'
                  : 'border-surface-border bg-surface-elevated hover:bg-surface-higher text-petText-secondary'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Approve {isRestrictedFromApproval && '(Locked)'}
                </span>
                <Check size={16} className={selectedAction === 'Approve' ? 'text-emerald-400' : 'text-petText-dim'} />
              </div>
              <span className="text-[11px] text-petText-muted">
                {isRestrictedFromApproval
                  ? 'Exceeds Tier 1 permission for High Risk profile.'
                  : 'Bind policy coverage within your authority limit.'}
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
                {currentUser?.fullName || currentUser?.email || 'Not Signed In'} · {currentUser?.role || 'Insurance Professional'} ({userTier.toUpperCase()})
              </strong>
            </span>
          </div>

          <button
            type="submit"
            disabled={!selectedAction || isSubmitting || (selectedAction === 'Approve' && isRestrictedFromApproval)}
            className="px-5 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording Decision...' : 'Commit Underwriting Determination'}
          </button>
        </div>
      </form>
    </div>
  );
};
