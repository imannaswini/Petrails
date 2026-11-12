import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { Assessment } from '../../types';
import { RiskBadge } from './RiskBadge';
import { useApp } from '../../context/AppContext';

interface DeleteAssessmentModalProps {
  assessment: Assessment | null;
  onClose: () => void;
  onDeleted?: (deletedId: string) => void;
}

export const DeleteAssessmentModal: React.FC<DeleteAssessmentModalProps> = ({
  assessment,
  onClose,
  onDeleted
}) => {
  const { deleteAssessment } = useApp();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setIsDeleting(false);
  }, [assessment?.id]);

  if (!assessment) return null;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAssessment(assessment.id);
      onDeleted?.(assessment.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete assessment.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-surface-border shadow-cinematic overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border bg-surface-elevated flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-950/70 border border-rose-800/50 text-rose-400">
              <AlertTriangle size={16} />
            </div>
            <h3 className="text-base font-bold text-white">Delete Assessment?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg hover:bg-surface-higher text-petText-muted hover:text-white transition-colors"
            aria-label="Close delete dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-petText-secondary leading-relaxed">
            Are you sure you want to delete this assessment? This action may affect its linked records and cannot be undone.
          </p>

          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-petText-muted">Assessment ID</span>
              <span className="font-mono text-white font-semibold">{assessment.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-petText-muted">Pet Name</span>
              <span className="text-white font-semibold">{assessment.petName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-petText-muted">Risk Classification</span>
              <RiskBadge level={assessment.riskLevel} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-petText-muted">Decision Status</span>
              <span className="font-mono text-petText-primary">{assessment.status}</span>
            </div>
          </div>

          <p className="text-[11px] text-petText-muted leading-snug">
            The assessment will be archived from active underwriting queues while preserving the linked pet dossier and statutory audit history.
          </p>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-elevated flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-surface-higher hover:bg-surface border border-surface-border text-xs font-semibold text-petText-secondary hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Delete Assessment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

