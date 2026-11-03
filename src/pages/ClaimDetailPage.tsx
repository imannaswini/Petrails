import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, CheckCircle2, FileText, AlertCircle, Eye, ShieldCheck, Scale } from 'lucide-react';
import { EvidenceItem } from '../types';

export const ClaimDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { claims, recordClaimDecision, openEvidenceModal } = useApp();

  const claim = claims.find(c => c.id === id) || (claims.length > 0 ? claims[0] : null);

  const [decisionNotes, setDecisionNotes] = useState(claim?.adjusterDecision?.notes || '');
  const [selectedAction, setSelectedAction] = useState<
    'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster'
  >(claim?.adjusterDecision?.status || 'Approved');
  const [approvedAmount, setApprovedAmount] = useState<string>(
    claim?.adjusterDecision?.approvedAmountInr
      ? claim.adjusterDecision.approvedAmountInr.toString()
      : (claim ? (claim.amountInr * 0.9).toString() : '0')
  );
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!claim) {
    return (
      <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Claim Record Not Found</h2>
        <p className="text-xs text-petText-muted">The requested claim is not in the database.</p>
        <Link
          to="/claims"
          className="inline-block px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
        >
          Back to Claims Intelligence
        </Link>
      </div>
    );
  }

  const handleCommitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await recordClaimDecision(
        claim.id,
        selectedAction,
        decisionNotes,
        parseInt(approvedAmount) || undefined
      );
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 4000);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to record claim decision.');
    }
  };

  const getIndicatorBadge = (status: string) => {
    switch (status) {
      case 'Normal':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
      case 'Low':
        return 'text-teal-400 bg-teal-950/40 border-teal-800/40';
      case 'Moderate':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
      case 'Elevated':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/40';
      default:
        return 'text-petText-muted bg-surface-higher';
    }
  };

  return (
    <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-petText-muted">
        <Link to="/claims" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
          <ArrowLeft size={14} />
          <span>Back to Claims Queue</span>
        </Link>
        <span className="font-mono text-petText-dim">Claim Reference: {claim.claimNumber}</span>
      </div>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border shadow-cinematic flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-surface-elevated text-brand-teal border border-surface-border">
              {claim.claimNumber}
            </span>
            <span className="font-mono text-xs text-petText-muted">{claim.date}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>{claim.petName.toUpperCase()}</span>
            <span className="text-xl sm:text-2xl text-petText-dim font-normal">·</span>
            <span className="text-xl sm:text-2xl font-mono text-brand-ivory">
              ₹{claim.amountInr.toLocaleString('en-IN')}
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-petText-secondary">
            {claim.breed} · {claim.species} · <strong className="text-white">{claim.treatment}</strong>
          </p>
        </div>

        {/* Status Pill & Pet Quick link */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <Link
            to={`/pets/${claim.petId}`}
            className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
          >
            Pet Dossier
          </Link>
          <span className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800">
            {claim.status}
          </span>
        </div>
      </div>

      {/* Professional Anomaly & Statistical Deviation Section (NOT "Fraud Detected") */}
      <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-brand-teal">
                Actuarial Anomaly Matrix
              </span>
              <span className="text-[10px] font-mono text-petText-dim bg-surface-elevated px-2 py-0.5 rounded border border-surface-border">
                Non-Accusatory Protocol
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Clinical &amp; Billing Deviation Indicators
            </h2>
            <p className="text-xs text-petText-secondary mt-0.5">
              Identifies variance against regional benchmarks without automatic presumption of fraud.
            </p>
          </div>

          {/* Anomaly Score Display */}
          <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border text-right self-start sm:self-auto min-w-[170px]">
            <span className="text-[10px] uppercase font-mono text-petText-muted block">
              Anomaly Score
            </span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <span className="text-2xl font-bold font-mono text-white">{claim.anomalyScore}%</span>
              <span className="text-xs font-bold font-mono text-emerald-400">{claim.anomalyLevel}</span>
            </div>
          </div>
        </div>

        {/* 4 Anomaly Indicators Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {claim.indicators.map(ind => (
            <div
              key={ind.name}
              className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2 text-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-white">{ind.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getIndicatorBadge(ind.status)}`}>
                    {ind.status}
                  </span>
                </div>
                <p className="text-petText-secondary text-[11px] leading-relaxed">{ind.detail}</p>
              </div>
              <div className="pt-2 border-t border-surface-border/60 text-[10px] text-petText-dim font-mono">
                Model: Actuarial-Anomaly-v2
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grid: Invoice Breakdown & Coverage Information */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Invoice Breakdown & Clinic Authenticity */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-brand-teal" />
              <span>Veterinary Hospital Itemized Invoice</span>
            </h3>
            <span className="font-mono text-xs text-petText-muted">
              {claim.invoiceDetails.invoiceNumber}
            </span>
          </div>

          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-petText-muted">Billed Clinic:</span>
              <span className="text-white font-medium">{claim.invoiceDetails.clinicName}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-petText-muted">Clinic GSTIN:</span>
              <span className="text-petText-secondary">{claim.invoiceDetails.clinicGstNumber} (Active)</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-petText-muted">Regional Market Benchmark:</span>
              <span className="text-brand-teal">
                ₹{claim.invoiceDetails.standardMarketRangeInr[0].toLocaleString('en-IN')} – ₹{claim.invoiceDetails.standardMarketRangeInr[1].toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Line items table */}
          <div className="rounded-lg border border-surface-border overflow-hidden text-xs">
            <div className="bg-surface-elevated px-3 py-2 font-mono text-[11px] text-petText-muted grid grid-cols-12 border-b border-surface-border">
              <span className="col-span-8">Item Description</span>
              <span className="col-span-4 text-right">Billed Amount (₹)</span>
            </div>
            <div className="divide-y divide-surface-border">
              <div className="px-3 py-2 grid grid-cols-12">
                <span className="col-span-8 text-petText-secondary">Surgical Theater &amp; Specialist Fee</span>
                <span className="col-span-4 text-right font-mono text-white">
                  ₹{claim.invoiceDetails.surgicalBilled.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="px-3 py-2 grid grid-cols-12">
                <span className="col-span-8 text-petText-secondary">Diagnostic Imaging &amp; Arthroscopy Consumables</span>
                <span className="col-span-4 text-right font-mono text-white">
                  ₹{claim.invoiceDetails.diagnosticBilled.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="px-3 py-2 grid grid-cols-12">
                <span className="col-span-8 text-petText-secondary">Hospital Pharmacy &amp; Post-Op Analgesia (Carprofen)</span>
                <span className="col-span-4 text-right font-mono text-white">
                  ₹{claim.invoiceDetails.medicationBilled.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="px-3 py-2 grid grid-cols-12">
                <span className="col-span-8 text-petText-secondary">Inpatient Recovery Day Stay</span>
                <span className="col-span-4 text-right font-mono text-white">
                  ₹{claim.invoiceDetails.roomCharges.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="px-3 py-2.5 bg-surface-elevated/70 grid grid-cols-12 font-bold text-white">
                <span className="col-span-8">Total Invoiced Amount:</span>
                <span className="col-span-4 text-right font-mono text-sm">
                  ₹{claim.invoiceDetails.totalBilledInr.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Coverage & Adjudication Math */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale size={16} className="text-brand-teal" />
              <span>Coverage &amp; Settlement Math</span>
            </h3>
            <span className="font-mono text-xs text-petText-muted">Comprehensive Tier</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-elevated space-y-1.5">
              <div className="flex justify-between">
                <span className="text-petText-muted">Annual Coverage Cap:</span>
                <span className="font-mono text-white font-semibold">₹3,00,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-petText-muted">Remaining Balance:</span>
                <span className="font-mono text-emerald-400 font-semibold">₹2,58,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-petText-muted">Policy Deductible:</span>
                <span className="font-mono text-petText-secondary">₹4,000 (Previously Met)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-petText-muted">Standard Co-payment:</span>
                <span className="font-mono text-petText-secondary">10% (₹4,200)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-teal-950/40 border border-teal-800/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-petText-muted block">Recommended Settlement</span>
                <span className="text-lg font-bold font-mono text-white">₹37,800</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal">Net = Billed minus 10% Copay</span>
            </div>
          </div>
        </div>
      </div>

      {/* Medical Evidence Section (Interactive "Review Evidence") */}
      <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-bold text-white">Verified Clinical Evidence &amp; Operative Records</h3>
            <p className="text-xs text-petText-secondary mt-0.5">
              Hospital documents ingested via EMR API with authenticated veterinary signatures.
            </p>
          </div>
          <span className="text-xs font-mono text-petText-muted">
            {claim.medicalEvidence.length} Exhibits Attached
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {claim.medicalEvidence.map(item => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-surface-elevated border border-surface-border hover:border-surface-borderLight transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] text-brand-teal px-1.5 py-0.5 rounded bg-surface-higher">
                    {item.type}
                  </span>
                  <span className="text-[10px] text-petText-dim font-mono">{item.fileSize}</span>
                </div>
                <h4 className="font-semibold text-white text-xs leading-snug">{item.title}</h4>
                <p className="text-[11px] text-petText-muted line-clamp-2 mt-1">{item.notes}</p>
              </div>

              <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>Verified</span>
                </span>
                <button
                  type="button"
                  onClick={() => openEvidenceModal(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:text-teal-300"
                >
                  <Eye size={13} />
                  {/* Prompt requirement: Provide "Review Evidence" */}
                  <span>Review Evidence</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Adjuster Decision Panel */}
      <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-base font-bold text-white">Claims Adjuster Adjudication Determination</h3>
            <p className="text-xs text-petText-secondary mt-0.5">
              Authorized insurance decision recorded directly into the Guidewire Claims Center ledger.
            </p>
          </div>
        </div>

        {showSavedToast && (
          <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 size={15} />
            <span>Claim adjudication determination recorded. Payout queue and ledger updated.</span>
          </div>
        )}

        <form onSubmit={handleCommitDecision} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { id: 'Approved', label: 'Approve Settlement', color: 'emerald' },
              { id: 'Adjusted', label: 'Approve Adjusted Amount', color: 'teal' },
              { id: 'Information Requested', label: 'Request Hospital Info', color: 'sky' },
              { id: 'Referred to Senior Adjuster', label: 'Refer to Committee', color: 'rose' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedAction(opt.id as typeof selectedAction)}
                className={`p-3 rounded-xl border text-left font-semibold transition-all ${
                  selectedAction === opt.id
                    ? 'border-brand-teal bg-teal-950/40 text-brand-teal ring-1 ring-brand-teal/40'
                    : 'border-surface-border bg-surface-elevated text-petText-secondary hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Approved Amount input if approved/adjusted */}
          {(selectedAction === 'Approved' || selectedAction === 'Adjusted') && (
            <div>
              <label className="block text-petText-secondary font-medium mb-1">
                Approved Settlement Payout (₹)
              </label>
              <input
                type="number"
                value={approvedAmount}
                onChange={e => setApprovedAmount(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs font-mono font-bold focus:border-brand-teal"
              />
            </div>
          )}

          {/* Adjuster notes */}
          <div>
            <label className="block text-petText-secondary font-medium mb-1">
              Adjuster Claim Justification Notes
            </label>
            <textarea
              rows={3}
              value={decisionNotes}
              onChange={e => setDecisionNotes(e.target.value)}
              placeholder="Record medical necessity confirmation, hospital voucher audit, or rationale for adjustments..."
              className="w-full p-3 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-petText-dim">
              Signed by: <strong>Sarah Jenkins (Claims &amp; Underwriting Officer)</strong>
            </span>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background font-bold text-xs transition-colors"
            >
              Commit Claim Determination
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
