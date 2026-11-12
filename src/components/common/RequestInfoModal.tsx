import React, { useState } from 'react';
import { X, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RequestInfoModal: React.FC = () => {
  const { requestInfoModal, closeRequestInfoModal, requestAssessmentInformation } = useApp();
  const [recipient, setRecipient] = useState<'clinic' | 'owner' | 'both'>('clinic');
  const [urgency, setUrgency] = useState<'Standard (48h)' | 'Urgent (24h)'>('Standard (48h)');
  const [customQuestions, setCustomQuestions] = useState(
    '1. Please furnish complete radiologic report and orthopedic surgeon notes for right stifle joint.\n2. Detail current range of motion and joint stability score.\n3. Verify if surgical intervention was performed or recommended.'
  );
  const [submitted, setSubmitted] = useState(false);

  if (!requestInfoModal.isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestInfoModal.assessmentId) return;
    const questions = customQuestions
      .split('\n')
      .map(q => q.trim())
      .filter(Boolean);
    try {
      await requestAssessmentInformation(requestInfoModal.assessmentId, {
        gapTitle: requestInfoModal.gapTitle,
        recipient,
        urgency,
        questions
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        closeRequestInfoModal();
      }, 900);
    } catch (err: any) {
      alert(err?.message || 'Failed to dispatch clinical information request.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-surface border border-surface-border shadow-cinematic overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-border flex items-center justify-between bg-surface-elevated">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-950/60 border border-teal-800/40 text-brand-teal">
              <Send size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Clinical Information Request</h3>
              <p className="text-xs text-petText-muted font-mono">
                Target: {requestInfoModal.petName} ({requestInfoModal.assessmentId})
              </p>
            </div>
          </div>
          <button
            onClick={closeRequestInfoModal}
            className="p-1.5 rounded-md hover:bg-surface-higher text-petText-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-base font-bold text-white">Clinical Questionnaire Dispatched</h4>
            <p className="text-xs text-petText-secondary max-w-xs mx-auto">
              Direct digital secure link sent to registered veterinarian. Record audit log updated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-5 space-y-4 text-xs">
            {/* Recipient selection */}
            <div>
              <label className="block font-medium text-petText-secondary mb-1.5">
                Target Recipient
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'clinic', label: 'Primary Vet Clinic' },
                  { id: 'owner', label: 'Pet Parent' },
                  { id: 'both', label: 'Joint Inquiry' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRecipient(item.id as typeof recipient)}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      recipient === item.id
                        ? 'border-brand-teal bg-teal-950/40 text-brand-teal'
                        : 'border-surface-border bg-surface-elevated text-petText-secondary hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Response Urgency */}
            <div>
              <label className="block font-medium text-petText-secondary mb-1.5">
                Response SLA Window
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Standard (48h)', 'Urgent (24h)'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setUrgency(option)}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      urgency === option
                        ? 'border-brand-teal bg-teal-950/40 text-brand-teal'
                        : 'border-surface-border bg-surface-elevated text-petText-secondary hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions to ask */}
            <div>
              <label className="block font-medium text-petText-secondary mb-1.5">
                Itemized Clinical Clarification Questions
              </label>
              <textarea
                rows={4}
                value={customQuestions}
                onChange={e => setCustomQuestions(e.target.value)}
                className="w-full p-3 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs placeholder-petText-dim focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors font-mono leading-relaxed"
              />
            </div>

            {/* Protocol Notice */}
            <div className="p-3 rounded-lg bg-surface-higher/40 border border-surface-border text-[11px] text-petText-muted flex items-start gap-2">
              <ShieldCheck size={14} className="text-brand-teal shrink-0 mt-0.5" />
              <span>
                PETRAILS protocol ensures policy application stays in active pending state without adverse risk re-weighting until clinic response is filed.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={closeRequestInfoModal}
                className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher text-petText-secondary hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background font-semibold"
              >
                Dispatch Questionnaire
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
