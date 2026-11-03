import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { FileQuestion, Send, CheckCircle2, Clock, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';

export const InformationRequestsPage: React.FC = () => {
  const { assessments, openRequestInfoModal } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Gather all gaps across all assessments
  const allGaps = assessments.flatMap(asm =>
    (asm.informationGaps || []).map(gap => ({
      ...gap,
      assessmentId: asm.id,
      petName: asm.petName,
      policyId: asm.policyId,
      petBreed: asm.breed,
      petImageUrl: asm.imageUrl
    }))
  );

  const filtered = filterStatus === 'ALL'
    ? allGaps
    : allGaps.filter(g => g.status === filterStatus);

  return (
    <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-brand-teal">
            Clinical Documentation Hub
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mt-1">
            Information Requests Queue
          </h1>
          <p className="text-xs sm:text-sm text-petText-secondary mt-1">
            Track, dispatch, and review outstanding veterinary clinical inquiries across policy applications.
          </p>
        </div>

        {/* Protocol Reminder Pill */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-surface-border text-xs text-petText-muted self-start sm:self-auto">
          <ShieldCheck size={16} className="text-brand-teal shrink-0" />
          <span>Missing info is not a risk penalty; uncertainty bands apply until verified.</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        {[
          { id: 'ALL', label: `All Inquiries (${allGaps.length})` },
          { id: 'Requested', label: `Awaiting Clinic (${allGaps.filter(g => g.status === 'Requested').length})` },
          { id: 'Pending Request', label: `Pending Underwriter Dispatch (${allGaps.filter(g => g.status === 'Pending Request').length})` },
          { id: 'Resolved', label: `Resolved (${allGaps.filter(g => g.status === 'Resolved').length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterStatus === tab.id
                ? 'bg-brand-teal text-background'
                : 'bg-surface-elevated text-petText-secondary hover:text-white border border-surface-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inquiries List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-surface border border-surface-border space-y-2">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 opacity-60 mb-2" />
          <p className="text-sm font-semibold text-white">No outstanding clinical information inquiries</p>
          <p className="text-xs text-petText-muted">All veterinary documents and questions have been resolved or none are pending.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(gap => (
          <div
            key={gap.id}
            className="p-5 rounded-xl bg-surface border border-surface-border hover:border-surface-borderLight transition-all space-y-4 shadow-subtle"
          >
            {/* Top row: Pet Info & Gap Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <img
                  src={gap.petImageUrl}
                  alt={gap.petName}
                  className="w-10 h-10 rounded-lg object-cover bg-surface-higher"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{gap.petName}</span>
                    <span className="font-mono text-xs text-petText-muted">({gap.policyId})</span>
                  </div>
                  <span className="text-xs text-petText-secondary">{gap.petBreed}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-medium border ${
                    gap.status === 'Resolved'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      : gap.status === 'Requested'
                      ? 'bg-sky-950/60 text-sky-300 border-sky-800'
                      : 'bg-amber-950/60 text-amber-300 border-amber-800'
                  }`}
                >
                  {gap.status}
                </span>
                <Link
                  to={`/assessments/${gap.assessmentId}`}
                  className="p-1.5 rounded-lg bg-surface-elevated hover:bg-surface-higher text-petText-muted hover:text-white transition-colors"
                  title="View Assessment"
                >
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>

            {/* Gap Title & Description */}
            <div>
              <h3 className="text-sm font-bold text-white mb-1">{gap.title}</h3>
              <p className="text-xs text-petText-secondary leading-relaxed">{gap.description}</p>
            </div>

            {/* Questions to be answered */}
            <div className="p-3.5 rounded-lg bg-surface-elevated/70 border border-surface-border space-y-1.5 text-xs">
              <span className="font-semibold text-petText-muted uppercase tracking-wider text-[10px] font-mono block">
                Itemized Clinical Inquiries
              </span>
              <ul className="list-disc pl-4 space-y-1 text-petText-secondary marker:text-brand-teal">
                {gap.questions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
              <div className="text-petText-dim font-mono text-[11px]">
                {gap.requestedAt ? (
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>Dispatched on {new Date(gap.requestedAt).toLocaleDateString()}</span>
                  </span>
                ) : (
                  <span>Awaiting underwriter review dispatch</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openRequestInfoModal(gap.assessmentId, gap.petName, gap.title)}
                  className="px-3.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send size={12} className="text-brand-teal" />
                  <span>{gap.status === 'Requested' ? 'Follow Up / Resend' : 'Dispatch Questionnaire'}</span>
                </button>
                <Link
                  to={`/assessments/${gap.assessmentId}`}
                  className="px-3.5 py-1.5 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <span>Resolve in Dossier</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};
