import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ClaimCard } from '../components/common/ClaimCard';
import { claimService } from '../services/claimService';
import { Claim, Species } from '../types';
import {
  Search,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Table as TableIcon,
  LayoutGrid,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  DollarSign,
  FileText,
  Info,
  Sparkles,
  Building2,
  Stethoscope
} from 'lucide-react';

export const ClaimsPage: React.FC = () => {
  const { claims, pets, refreshData, isLoadingBackend, backendError } = useApp();
  const [activeTab, setActiveTab] = useState<'All' | 'Under Review' | 'Attention' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form State for New Claim Modal
  const [formData, setFormData] = useState({
    petId: '',
    petName: '',
    breed: '',
    species: 'Dog' as Species,
    treatment: '',
    claimType: 'Orthopedic Intervention',
    amountInr: '',
    clinicName: 'Apollo Veterinary Super Specialty Hospital, Bangalore',
    date: new Date().toISOString().split('T')[0],
    benchmarkMin: '25000',
    benchmarkMax: '45000',
    policyId: 'POL-TATA-2026-901'
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter Claims
  const filteredClaims = claims.filter(c => {
    const matchesSearch =
      c.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.treatment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.invoiceDetails?.clinicName && c.invoiceDetails.clinicName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'All') return true;
    if (activeTab === 'Under Review') return c.status === 'Under Review';
    if (activeTab === 'Attention') return c.status === 'Attention Required' || c.status === 'Flagged';
    if (activeTab === 'Completed') return c.status === 'Approved' || c.status === 'Settled';
    return true;
  });

  // Calculate live aggregate KPI totals
  const totalClaims = claims.length;
  const inReviewCount = claims.filter(c => c.status === 'Under Review').length;
  const attentionCount = claims.filter(c => c.status === 'Attention Required' || c.status === 'Flagged').length;
  const completedCount = claims.filter(c => c.status === 'Approved' || c.status === 'Settled').length;

  const inReviewTotal = claims
    .filter(c => c.status === 'Under Review' || c.status === 'Attention Required')
    .reduce((sum, c) => sum + (c.amountInr || 0), 0);

  const settledTotal = claims
    .filter(c => c.status === 'Approved' || c.status === 'Settled')
    .reduce((sum, c) => sum + (c.adjusterDecision?.approvedAmountInr ?? c.amountInr ?? 0), 0);

  const tabCounts = {
    All: totalClaims,
    'Under Review': inReviewCount,
    Attention: attentionCount,
    Completed: completedCount
  };

  // Auto-fill pet details when a known pet is selected in the modal
  const handlePetSelect = (selectedId: string) => {
    if (!selectedId) {
      setFormData(prev => ({ ...prev, petId: '', petName: '', breed: '', species: 'Dog' }));
      return;
    }
    const foundPet = pets.find(p => p.id === selectedId);
    if (foundPet) {
      setFormData(prev => ({
        ...prev,
        petId: foundPet.id,
        petName: foundPet.name,
        breed: foundPet.breed,
        species: foundPet.species,
        policyId: foundPet.policyId || 'POL-TATA-2026-901'
      }));
    } else {
      // Preset defaults for test demonstration
      const defaults: Record<string, { name: string; breed: string; species: Species }> = {
        'pet-demo-1': { name: 'Bruno', breed: 'Golden Retriever', species: 'Dog' },
        'pet-demo-2': { name: 'Luna', breed: 'Persian Cat', species: 'Cat' },
        'pet-demo-3': { name: 'Rocky', breed: 'German Shepherd', species: 'Dog' }
      };
      const def = defaults[selectedId];
      if (def) {
        setFormData(prev => ({
          ...prev,
          petId: selectedId,
          petName: def.name,
          breed: def.breed,
          species: def.species
        }));
      }
    }
  };

  // Submit New Claim Handler
  const handleCreateClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const amount = parseFloat(formData.amountInr);
    if (!formData.petName.trim()) {
      setSubmitError('Please enter or select a patient pet name.');
      return;
    }
    if (!formData.treatment.trim()) {
      setSubmitError('Please enter a clinical treatment description.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setSubmitError('Please enter a valid claimed amount in ₹ INR.');
      return;
    }

    setIsSubmitting(true);
    try {
      const claimId = `cl-${Date.now().toString().slice(-6)}`;
      const claimNum = `CLM-${Math.floor(1000 + Math.random() * 9000)}`;
      const benchmarkMin = parseFloat(formData.benchmarkMin) || 20000;
      const benchmarkMax = parseFloat(formData.benchmarkMax) || 40000;

      const newClaim: Claim = {
        id: claimId,
        claimNumber: claimNum,
        petId: formData.petId || `pet-${Date.now().toString().slice(-4)}`,
        petName: formData.petName.trim(),
        breed: formData.breed || 'Standard Mix',
        species: formData.species,
        claimType: formData.claimType,
        treatment: formData.treatment.trim(),
        amountInr: amount,
        date: formData.date,
        status: 'Under Review',
        anomalyScore: 0, // Backend intelligence engine computes this deterministically
        anomalyLevel: 'LOW CONCERN',
        indicators: [],
        invoiceDetails: {
          invoiceNumber: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
          clinicGstNumber: '29AAAAA0000A1Z5',
          clinicName: formData.clinicName.trim() || 'Apollo Veterinary Super Specialty Hospital',
          procedureCodes: ['VET-PROC-01', 'VET-MED-04'],
          medicationBilled: Math.round(amount * 0.25),
          surgicalBilled: Math.round(amount * 0.55),
          diagnosticBilled: Math.round(amount * 0.15),
          roomCharges: Math.round(amount * 0.05),
          totalBilledInr: amount,
          standardMarketRangeInr: [benchmarkMin, benchmarkMax]
        },
        medicalEvidence: [
          {
            id: `ev-${Date.now()}-1`,
            title: 'Itemized Clinical Veterinary Invoice',
            type: 'Veterinary Invoice',
            date: formData.date,
            source: formData.clinicName.trim() || 'Veterinary Hospital',
            verified: true,
            notes: 'Itemized procedure receipt and medication breakdown.',
            fileSize: '1.4 MB'
          }
        ],
        imageUrl:
          formData.species === 'Cat'
            ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=800'
            : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800'
      };

      await claimService.createClaim(newClaim);
      await refreshData();

      setSuccessToast(`Claim ${claimNum} registered and evaluated successfully in MongoDB Atlas.`);
      setIsNewClaimOpen(false);

      // Reset form
      setFormData({
        petId: '',
        petName: '',
        breed: '',
        species: 'Dog',
        treatment: '',
        claimType: 'Orthopedic Intervention',
        amountInr: '',
        clinicName: 'Apollo Veterinary Super Specialty Hospital, Bangalore',
        date: new Date().toISOString().split('T')[0],
        benchmarkMin: '25000',
        benchmarkMax: '45000',
        policyId: 'POL-TATA-2026-901'
      });

      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit claim to backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Under Review':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
      case 'Attention Required':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
      case 'Approved':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
      case 'Settled':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'Flagged':
        return 'bg-rose-950/80 text-rose-400 border-rose-700';
      default:
        return 'bg-surface-higher text-petText-muted border-surface-border';
    }
  };

  const getAnomalyBadge = (level: string, score: number) => {
    if (score >= 50 || level === 'ELEVATED CONCERN') {
      return 'text-rose-400 bg-rose-950/50 border-rose-800/60';
    }
    if (score >= 30 || level === 'MODERATE CONCERN') {
      return 'text-amber-400 bg-amber-950/50 border-amber-800/60';
    }
    return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60';
  };

  return (
    <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-surface border border-emerald-500/50 shadow-2xl text-xs text-emerald-300 flex items-center gap-3 animate-slide-up">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-petText-muted hover:text-white ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Backend Error Banner */}
      {backendError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>Backend communication issue: {backendError}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Header Workspace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-brand-teal">
              Claims Adjudication Workspace
            </span>
            <span className="text-[10px] font-mono bg-surface-elevated text-emerald-400 px-2 py-0.5 rounded border border-surface-border">
              MongoDB Atlas Live
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mt-1">
            Claims Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-petText-secondary mt-1">
            Evaluate veterinary invoice authenticity, procedural standard fee benchmarks, and non-accusatory anomaly indicators.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingBackend}
            className="p-2.5 rounded-lg bg-surface border border-surface-border text-xs text-petText-secondary hover:text-white hover:border-brand-teal transition-colors flex items-center gap-2"
            title="Refresh claims from backend"
          >
            <RefreshCw size={14} className={isRefreshing || isLoadingBackend ? 'animate-spin text-brand-teal' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => setIsNewClaimOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-bold transition-all shadow-sm"
          >
            <Plus size={15} />
            <span>Submit Claim</span>
          </button>
        </div>
      </div>

      {/* 1. Summary Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Claims */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center justify-between text-petText-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Total Claims</span>
            <FileText size={16} className="text-petText-dim" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              {isLoadingBackend ? '...' : totalClaims}
            </span>
            <span className="text-[11px] font-mono text-petText-muted">All Time</span>
          </div>
          <p className="text-[11px] text-petText-secondary">Persisted records in claims ledger</p>
        </div>

        {/* Under Review */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center justify-between text-petText-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Under Review</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono">
              {isLoadingBackend ? '...' : inReviewCount}
            </span>
            <span className="text-[11px] font-mono text-amber-400/80">Active Queue</span>
          </div>
          <p className="text-[11px] text-petText-secondary">Awaiting initial adjuster determination</p>
        </div>

        {/* Flagged / Attention */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center justify-between text-petText-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Attention Required</span>
            <AlertTriangle size={16} className="text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-300 font-mono">
              {isLoadingBackend ? '...' : attentionCount}
            </span>
            <span className="text-[11px] font-mono text-rose-400/80">Secondary Check</span>
          </div>
          <p className="text-[11px] text-petText-secondary">Exhibits invoice or cadence deviations</p>
        </div>

        {/* Settled Total */}
        <div className="p-5 rounded-2xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center justify-between text-petText-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Settled Payout</span>
            <DollarSign size={16} className="text-brand-teal" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-brand-teal font-mono">
              ₹{isLoadingBackend ? '...' : settledTotal.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] font-mono text-emerald-400">{completedCount} Settled</span>
          </div>
          <p className="text-[11px] text-petText-secondary">Disbursed underwriter settlements</p>
        </div>
      </div>

      {/* 2. Claims Status & Actuarial Intelligence Visualization */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Claims Adjudication Distribution</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-brand-teal border border-surface-border">
                Live Status Breakdown
              </span>
            </h3>
            <p className="text-xs text-petText-secondary mt-0.5">
              Portfolio split across adjudication lifecycles and regional fee benchmarks.
            </p>
          </div>
          <div className="text-xs font-mono text-petText-muted">
            Active Review Value: <strong className="text-white">₹{inReviewTotal.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 rounded-full bg-surface-elevated overflow-hidden flex">
            {totalClaims > 0 ? (
              <>
                <div
                  style={{ width: `${(inReviewCount / totalClaims) * 100}%` }}
                  className="bg-amber-400 h-full transition-all"
                  title={`Under Review: ${inReviewCount}`}
                />
                <div
                  style={{ width: `${(attentionCount / totalClaims) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Attention Required: ${attentionCount}`}
                />
                <div
                  style={{ width: `${(completedCount / totalClaims) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Approved & Settled: ${completedCount}`}
                />
              </>
            ) : (
              <div className="w-full bg-surface-higher h-full" />
            )}
          </div>

          {/* Status Breakdown Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-petText-secondary">Under Review:</span>
              <span className="font-mono text-white font-semibold">
                {inReviewCount} {totalClaims > 0 && `(${Math.round((inReviewCount / totalClaims) * 100)}%)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-petText-secondary">Attention / Flagged:</span>
              <span className="font-mono text-white font-semibold">
                {attentionCount} {totalClaims > 0 && `(${Math.round((attentionCount / totalClaims) * 100)}%)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-petText-secondary">Approved &amp; Settled:</span>
              <span className="font-mono text-white font-semibold">
                {completedCount} {totalClaims > 0 && `(${Math.round((completedCount / totalClaims) * 100)}%)`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-surface-higher shrink-0 border border-surface-border" />
              <span className="text-petText-secondary">Total Ledger:</span>
              <span className="font-mono text-brand-teal font-semibold">{totalClaims} Claims</span>
            </div>
          </div>
        </div>

        {/* AI & Rules Intelligence Note */}
        <div className="p-4 rounded-xl bg-surface-elevated/70 border border-surface-border text-xs space-y-2">
          <div className="flex items-center gap-2 text-brand-teal font-semibold">
            <ShieldCheck size={15} />
            <span>Human-In-The-Loop Claims Governance Protocol</span>
          </div>
          <p className="text-petText-secondary leading-relaxed">
            <strong className="text-white">Non-Accusatory Rule Engine:</strong> Claims anomaly indicators compare billed treatment invoices against regional veterinarian tariff bounds. Statistical variance does <strong className="text-white">not</strong> constitute evidence of fraud. All determinations remain strictly under authorized claims adjuster discretion.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono text-petText-muted pt-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Actuarial Tariff Deviation: Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Episodic Treatment Cadence: Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Deep Multimodal Invoice OCR: In Calibration
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search, Filter Tabs & View Mode Switcher */}
      <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {[
              { id: 'All', label: 'All Claims', count: tabCounts.All, icon: null },
              { id: 'Under Review', label: 'Under Review', count: tabCounts['Under Review'], icon: Clock },
              { id: 'Attention', label: 'Attention Required', count: tabCounts.Attention, icon: AlertTriangle },
              { id: 'Completed', label: 'Completed & Settled', count: tabCounts.Completed, icon: CheckCircle2 }
            ].map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-brand-teal text-background shadow-sm'
                      : 'bg-surface-elevated text-petText-secondary hover:text-white border border-surface-border'
                  }`}
                >
                  {Icon && <Icon size={12} className={active ? 'text-background' : 'text-petText-muted'} />}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      active ? 'bg-background/30 text-background' : 'bg-surface-higher text-petText-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-elevated border border-surface-border self-end md:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
                viewMode === 'table' ? 'bg-brand-teal text-background font-semibold' : 'text-petText-muted hover:text-white'
              }`}
              title="Table View"
            >
              <TableIcon size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
                viewMode === 'cards' ? 'bg-brand-teal text-background font-semibold' : 'text-petText-muted hover:text-white'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-petText-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by claim number, pet name, clinic, or veterinary treatment..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-surface-elevated border border-surface-border text-xs text-white placeholder-petText-dim focus:border-brand-teal outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-petText-muted hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Claims Display (Table or Cards) */}
      {isLoadingBackend ? (
        <div className="p-12 text-center rounded-2xl bg-surface border border-surface-border space-y-3">
          <RefreshCw size={24} className="animate-spin text-brand-teal mx-auto" />
          <p className="text-sm font-semibold text-white">Loading claims ledger from MongoDB Atlas...</p>
          <p className="text-xs text-petText-muted">Synchronizing live records and anomaly vectors.</p>
        </div>
      ) : filteredClaims.length > 0 ? (
        viewMode === 'table' ? (
          /* Table View */
          <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-elevated/70 text-petText-muted uppercase tracking-wider font-mono text-[11px]">
                    <th className="py-3.5 px-4 font-semibold">Claim Ref</th>
                    <th className="py-3.5 px-4 font-semibold">Pet Patient</th>
                    <th className="py-3.5 px-4 font-semibold">Procedure &amp; Treatment</th>
                    <th className="py-3.5 px-4 font-semibold">Clinic Provider</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Claim Amount</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Anomaly Vector</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredClaims.map(claim => (
                    <tr key={claim.id} className="hover:bg-surface-elevated/50 transition-colors group">
                      {/* Claim Ref */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-white group-hover:text-brand-teal transition-colors">
                          {claim.claimNumber}
                        </div>
                        <div className="text-[11px] font-mono text-petText-muted">{claim.date}</div>
                      </td>

                      {/* Pet Patient */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={claim.imageUrl}
                            alt={claim.petName}
                            className="w-8 h-8 rounded-lg object-cover bg-surface-higher shrink-0"
                            onError={e => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div>
                            <div className="font-semibold text-white">{claim.petName}</div>
                            <div className="text-[11px] text-petText-secondary">
                              {claim.breed} · {claim.species}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Procedure */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-petText-primary truncate">{claim.treatment}</div>
                        <div className="text-[11px] text-petText-muted">{claim.claimType}</div>
                      </td>

                      {/* Clinic */}
                      <td className="py-3 px-4 max-w-[180px]">
                        <div className="text-petText-secondary truncate flex items-center gap-1.5">
                          <Building2 size={12} className="text-petText-dim shrink-0" />
                          <span>{claim.invoiceDetails?.clinicName || 'Registered Vet Hospital'}</span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                        ₹{claim.amountInr.toLocaleString('en-IN')}
                      </td>

                      {/* Anomaly Vector */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${getAnomalyBadge(
                            claim.anomalyLevel,
                            claim.anomalyScore
                          )}`}
                        >
                          <span>{claim.anomalyScore}%</span>
                          <span className="text-[9px] uppercase">({claim.anomalyLevel?.replace(' CONCERN', '')})</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium border ${getStatusBadge(
                            claim.status
                          )}`}
                        >
                          {claim.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/claims/${claim.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white hover:text-brand-teal transition-colors"
                        >
                          <span>Investigate</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClaims.map(claim => (
              <ClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        )
      ) : (
        /* Meaningful Empty State */
        <div className="p-12 text-center rounded-2xl bg-surface border border-surface-border space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto text-brand-teal">
            <Stethoscope size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Claims in Adjudication Queue</h3>
            <p className="text-xs text-petText-secondary leading-relaxed">
              {searchQuery
                ? `No claim records match "${searchQuery}". Clear your search or change the active tab.`
                : 'The claims ledger is currently clear. You can submit a test veterinary claim to evaluate regional tariff benchmark deviations and anomaly scoring.'}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={() => setIsNewClaimOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-bold transition-all shadow-sm"
              >
                <Plus size={14} />
                <span>Submit First Test Claim</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Submit New Claim Modal */}
      {isNewClaimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-surface border border-surface-border shadow-cinematic overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-surface-border flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-brand-teal">
                  Claims Intake Portal
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">Submit Veterinary Insurance Claim</h2>
              </div>
              <button
                onClick={() => setIsNewClaimOpen(false)}
                className="p-1 rounded-lg text-petText-muted hover:text-white hover:bg-surface-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateClaimSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
              {submitError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Patient Selection */}
              <div>
                <label className="block text-petText-secondary font-medium mb-1">
                  Select Patient Pet / Underwritten Policy
                </label>
                <select
                  value={formData.petId}
                  onChange={e => handlePetSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                >
                  <option value="">-- Select from Existing Pets or Demo Profiles --</option>
                  {pets.length > 0 ? (
                    pets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.breed} · {p.species}) — Policy: {p.policyId || 'POL-ACTIVE'}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="pet-demo-1">Bruno (Golden Retriever · Canine) — POL-TATA-8812</option>
                      <option value="pet-demo-2">Luna (Persian Cat · Feline) — POL-TATA-9934</option>
                      <option value="pet-demo-3">Rocky (German Shepherd · Canine) — POL-TATA-7741</option>
                    </>
                  )}
                </select>
              </div>

              {/* Manual Pet Name & Breed if customized */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Pet Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.petName}
                    onChange={e => setFormData({ ...formData, petName: e.target.value })}
                    placeholder="e.g. Bruno"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                  />
                </div>
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Breed</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={e => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="e.g. Golden Retriever"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                  />
                </div>
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Species</label>
                  <select
                    value={formData.species}
                    onChange={e => setFormData({ ...formData, species: e.target.value as Species })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                  >
                    <option value="Dog">Dog (Canine)</option>
                    <option value="Cat">Cat (Feline)</option>
                  </select>
                </div>
              </div>

              {/* Claim Type & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Claim Category</label>
                  <select
                    value={formData.claimType}
                    onChange={e => setFormData({ ...formData, claimType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                  >
                    <option value="Orthopedic Intervention">Orthopedic Intervention</option>
                    <option value="Diagnostic Investigation">Diagnostic Investigation</option>
                    <option value="Emergency Soft Tissue">Emergency Soft Tissue</option>
                    <option value="Gastroenterology">Gastroenterology</option>
                    <option value="Oncology Protocol">Oncology Protocol</option>
                    <option value="Routine Preventive">Routine Preventive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Treatment Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                  />
                </div>
              </div>

              {/* Treatment Description */}
              <div>
                <label className="block text-petText-secondary font-medium mb-1">
                  Procedure &amp; Treatment Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.treatment}
                  onChange={e => setFormData({ ...formData, treatment: e.target.value })}
                  placeholder="e.g. Tibial Plateau Leveling Osteotomy (TPLO) & post-surgical hospitalization"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                />
              </div>

              {/* Clinic Name & Claim Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Veterinary Clinic Provider</label>
                  <input
                    type="text"
                    value={formData.clinicName}
                    onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
                    placeholder="e.g. Apollo Veterinary Super Specialty"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none"
                  />
                </div>
                <div>
                  <label className="block text-petText-secondary font-medium mb-1">Claimed Amount (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="100"
                    value={formData.amountInr}
                    onChange={e => setFormData({ ...formData, amountInr: e.target.value })}
                    placeholder="e.g. 42000"
                    className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal outline-none font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Benchmark Reference Inputs */}
              <div className="p-3 rounded-lg bg-surface-elevated/50 border border-surface-border space-y-2">
                <span className="text-[11px] font-semibold text-petText-secondary block">
                  Regional Veterinary Benchmark Reference (₹ INR)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-petText-muted mb-0.5">Market Minimum</label>
                    <input
                      type="number"
                      value={formData.benchmarkMin}
                      onChange={e => setFormData({ ...formData, benchmarkMin: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white font-mono text-xs focus:border-brand-teal outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-petText-muted mb-0.5">Market Maximum Bound</label>
                    <input
                      type="number"
                      value={formData.benchmarkMax}
                      onChange={e => setFormData({ ...formData, benchmarkMax: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white font-mono text-xs focus:border-brand-teal outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-petText-muted">
                  Billed amounts exceeding the upper market bound trigger automatic statistical deviation flags for adjuster review.
                </p>
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewClaimOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs text-petText-secondary hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-bold transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Evaluating &amp; Persisting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Submit Claim to Ledger</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
