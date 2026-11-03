import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { PET_IMAGES } from '../data/mockData';
import { analyticsService } from '../services/analyticsService';
import { PortfolioMetrics } from '../types';
import { PetCard } from '../components/common/PetCard';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  FileText,
  AlertCircle,
  Clock,
  FileQuestion,
  ChevronRight,
  Filter,
  Send,
  ArrowUpRight,
  ShieldCheck,
  Activity
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { pets, assessments, claims, openRequestInfoModal } = useApp();
  const navigate = useNavigate();
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');

  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);

  useEffect(() => {
    analyticsService.getPortfolioMetrics()
      .then(setPortfolioMetrics)
      .catch(() => {});
  }, [assessments.length, claims.length]);

  // Dynamic Continue Working list derived from real pets
  const continueWorkingPets = pets.slice(0, 5).map(pet => {
    const matchingAsm = assessments.find(a => a.petId === pet.id);
    const statusLabel = pet.policyStatus === 'Active'
      ? (matchingAsm ? `${matchingAsm.riskLevel} RISK` : 'ACTIVE POLICY')
      : 'REVIEW REQUIRED';
    return { pet, statusLabel };
  });

  // Dynamic Priority Assessments derived from real assessments
  const priorityAssessmentsData = assessments
    .filter(a => a.status === 'Under Review' || a.status === 'Information Requested' || a.status === 'Attention Required' || a.riskLevel === 'HIGH' || a.riskLevel === 'MEDIUM')
    .slice(0, 4)
    .map(asm => ({
      id: asm.id,
      petName: asm.petName.toUpperCase(),
      breed: asm.breed,
      ageText: asm.ageText || 'Unknown age',
      riskLevel: asm.riskLevel,
      riskLabel: asm.status === 'Information Requested' ? 'INFORMATION REQUIRED' : `${asm.riskLevel} RISK`,
      reason: asm.contributingFactors?.[0]?.name || asm.underwriterDecision?.underwriterNotes || 'Actuarial profile review',
      imageUrl: asm.imageUrl || PET_IMAGES.max,
      actionType: asm.status === 'Information Requested' ? 'request_info' as const : 'review' as const,
      actionLabel: asm.status === 'Information Requested' ? 'Request information' : 'Review'
    }));

  // Dynamic Claims Requiring Attention derived from real claims
  const claimsRequiringAttention = claims
    .filter(c => c.status === 'Under Review' || c.status === 'Attention Required' || c.status === 'Flagged' || (c.anomalyScore && c.anomalyScore > 20))
    .slice(0, 4)
    .map(c => {
      const bType: 'anomaly' | 'alert' | 'warning' | 'info' =
        c.anomalyScore && c.anomalyScore > 30 ? 'anomaly' : c.status === 'Flagged' ? 'alert' : c.status === 'Under Review' ? 'warning' : 'info';

      return {
        id: c.id,
        petName: c.petName.toUpperCase(),
        treatment: c.treatment || 'Clinical Treatment',
        amountInr: c.amountInr,
        badgeText: c.indicators?.[0]?.name || (c.status === 'Under Review' ? 'Awaiting documents' : 'Coverage review'),
        badgeType: bType,
        imageUrl: c.imageUrl || PET_IMAGES.max
      };
    });

  // Calculate live portfolio risk distribution
  const totalAsm = assessments.length;
  const lowCount = assessments.filter(a => a.riskLevel === 'LOW').length;
  const medCount = assessments.filter(a => a.riskLevel === 'MEDIUM').length;
  const highCount = assessments.filter(a => a.riskLevel === 'HIGH').length;

  const riskDistribution = portfolioMetrics?.riskDistribution || {
    low: totalAsm > 0 ? Math.round((lowCount / totalAsm) * 100) : 0,
    medium: totalAsm > 0 ? Math.round((medCount / totalAsm) * 100) : 0,
    high: totalAsm > 0 ? Math.round((highCount / totalAsm) * 100) : 0,
  };

  const handleRiskBarClick = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    setSelectedRiskFilter(selectedRiskFilter === level ? 'ALL' : level);
  };

  const filteredAssessmentsByChart = selectedRiskFilter === 'ALL'
    ? assessments
    : assessments.filter(a => a.riskLevel === selectedRiskFilter);

  return (
    <div className="pb-24 pt-16 bg-[#080A0B] text-petText-primary">
      {/* 
        1. REFINED HERO HEIGHT (55–65vh max on desktop)
        Ensures the user can see the beginning of the "Continue Working" content without scrolling on 1440x900!
      */}
      <section className="relative h-[55vh] min-h-[400px] max-h-[500px] flex items-center overflow-hidden border-b border-[#1F2428]/60">
        {/* Authentic veterinary photograph with high visibility (not blacked out) */}
        <div className="absolute inset-0">
          <img
            src={PET_IMAGES.vetExamDog}
            alt="Veterinarian examining canine patient inside modern clinic"
            className="w-full h-full object-cover object-center filter brightness-[0.80] contrast-105"
          />

          {/* 
            Layered gradient treatment:
            Left: dark enough for typography
            Center: image clearly visible
            Right: image gradually fades into application background
          */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, rgba(8,10,11,1) 0%, rgba(8,10,11,0.85) 30%, rgba(8,10,11,0.35) 60%, rgba(8,10,11,0.92) 100%)'
            }}
          />

          {/* Bottom fade into the page background */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#080A0B] via-[#080A0B]/70 to-transparent pointer-events-none" />
        </div>

        {/* Hero Content (Editorial typography, 650-700px max width) */}
        <div className="relative max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-12 w-full z-10">
          <div className="max-w-[680px] space-y-3.5">
            {/* Small uppercase eyebrow */}
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-teal font-medium">
              GOOD MORNING, SARAH
            </span>

            {/* Editorial 2-line headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-white leading-[1.12]">
              Underwriting, with clarity.
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-petText-secondary leading-relaxed font-light">
              Understand risk, investigate claims, and make informed decisions across your pet insurance portfolio.
            </p>

            {/* Small status line */}
            <p className="text-xs font-mono text-petText-muted flex items-center gap-2 pt-0.5">
              <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
              <span>24 applications require your attention.</span>
            </p>

            {/* CTAs */}
            <div className="pt-2 flex items-center gap-3.5">
              <Link
                to="/assessments"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-teal hover:bg-[#139C8B] text-[#080A0B] font-bold text-xs tracking-wide transition-all shadow-md hover:shadow-teal-500/20"
              >
                <FileText size={14} />
                <span>Review assessments</span>
              </Link>

              <Link
                to="/claims"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface hover:bg-surface-elevated border border-surface-border text-white font-medium text-xs tracking-wide transition-colors"
              >
                <Clock size={14} />
                <span>Review claims</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Dashboard Body Container (1400-1500px max width, consistent breathing spacing) */}
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-12 pt-8 sm:pt-10 space-y-14">
        {/* 
          2. CONTINUE WORKING
          Netflix-inspired horizontal content-browsing experience immediately below the hero.
          Pet cards are 240-270px wide with 70% image height.
        */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Continue working
              </h2>
              <p className="text-xs text-petText-muted mt-0.5">
                Active animal dossiers with pending clinical evaluation
              </p>
            </div>
            <Link
              to="/assessments"
              className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
            >
              <span>View all ({pets.length})</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* Horizontal scroll container with Netflix pet cards */}
          {continueWorkingPets.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface border border-surface-border text-center text-xs text-petText-muted">
              No active animal dossiers in queue. Start by running a new risk assessment.
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 hide-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
              {continueWorkingPets.map(({ pet, statusLabel }) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  variant="netflix-horizontal"
                  customStatusLabel={statusLabel}
                />
              ))}
            </div>
          )}
        </section>

        {/* 
          3. PRIORITY ASSESSMENTS
          Cases that may require your attention.
          Large horizontal cards with pet photo, name, breed, risk level, actuarial reason, and action.
        */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Priority Assessments
              </h2>
              <p className="text-xs text-petText-muted mt-0.5">
                Cases that may require your attention.
              </p>
            </div>
            <Link
              to="/assessments"
              className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
            >
              <span>Registry</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {priorityAssessmentsData.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface border border-surface-border text-center text-xs text-petText-muted">
              No pending underwriting assessments requiring attention.
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 hide-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
              {priorityAssessmentsData.map(item => (
                <div
                  key={item.id}
                  className="group shrink-0 w-[300px] sm:w-[330px] rounded-xl overflow-hidden bg-surface border border-surface-border/70 hover:border-surface-borderLight transition-all duration-300 hover:scale-[1.02] hover:shadow-cinematic flex flex-col justify-between"
                >
                  <div>
                    {/* Top Image Preview */}
                    <div className="relative h-44 w-full bg-surface-higher overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.petName}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-black/20" />

                      <div className="absolute top-3 right-3">
                        <RiskBadge level={item.riskLevel} size="sm" />
                      </div>

                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {item.petName}
                        </h3>
                        <p className="text-xs text-petText-secondary font-medium">
                          {item.breed} · {item.ageText}
                        </p>
                      </div>
                    </div>

                    {/* Actuarial Reason Section */}
                    <div className="p-4 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-petText-muted block">
                        Underwriting Trigger
                      </span>
                      <div className="p-2.5 rounded-lg bg-surface-elevated border border-surface-border/60 text-xs text-brand-ivory font-medium">
                        "{item.reason}"
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="p-4 pt-0">
                    {item.actionType === 'request_info' ? (
                      <button
                        type="button"
                        onClick={() => openRequestInfoModal(item.id, item.petName, item.reason)}
                        className="w-full py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Send size={13} className="text-brand-teal" />
                        <span>Request information</span>
                      </button>
                    ) : (
                      <Link
                        to={`/assessments/${item.id}`}
                        className="w-full py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors group-hover:border-brand-teal/60"
                      >
                        <span>Review</span>
                        <ChevronRight size={13} className="text-brand-teal" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 
          4. CLAIMS REQUIRING ATTENTION
          Horizontal content cards with pet image, procedure, amount in ₹, and anomaly score / status.
        */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Claims Requiring Attention
              </h2>
              <p className="text-xs text-petText-muted mt-0.5">
                Claims with statistical invoice variance or outstanding clinic documentation
              </p>
            </div>
            <Link
              to="/claims"
              className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
            >
              <span>View all claims</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {claimsRequiringAttention.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface border border-surface-border text-center text-xs text-petText-muted">
              No active claims currently requiring attention.
            </div>
          ) : (
            <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 hide-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
              {claimsRequiringAttention.map(claimItem => (
                <div
                  key={claimItem.id}
                  className="group shrink-0 w-[290px] sm:w-[320px] rounded-xl overflow-hidden bg-surface border border-surface-border/70 hover:border-surface-borderLight transition-all duration-300 hover:scale-[1.02] hover:shadow-cinematic flex flex-col justify-between"
                >
                  <div>
                    {/* Top Image Preview with Procedure Badge */}
                    <div className="relative h-36 w-full bg-surface-higher overflow-hidden">
                      <img
                        src={claimItem.imageUrl}
                        alt={claimItem.petName}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-black/30" />

                      <div className="absolute top-3 left-3">
                        <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-petText-secondary border border-white/10">
                          {claimItem.id.toUpperCase()}
                        </span>
                      </div>

                      <div className="absolute bottom-2.5 left-3 right-3 flex items-baseline justify-between">
                        <span className="text-base font-bold text-white tracking-tight">
                          {claimItem.petName}
                        </span>
                        <span className="text-lg font-bold font-mono text-white">
                          ₹{claimItem.amountInr.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Body Details */}
                    <div className="p-4 space-y-2.5">
                      <div className="text-xs">
                        <span className="text-petText-muted block text-[11px]">Procedure / Treatment</span>
                        <span className="font-medium text-white line-clamp-1">{claimItem.treatment}</span>
                      </div>

                      {/* Status Pill */}
                      <div className="pt-1">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border ${
                            claimItem.badgeType === 'anomaly'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                              : claimItem.badgeType === 'alert'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                          }`}
                        >
                          {claimItem.badgeText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="p-4 pt-0">
                    <Link
                      to={`/claims/${claimItem.id}`}
                      className="w-full py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors group-hover:border-brand-teal/60"
                    >
                      <span>Investigate</span>
                      <ArrowUpRight size={13} className="text-brand-teal" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 
          5. PORTFOLIO INTELLIGENCE
          Restrained analytical charts: Risk Distribution & Claims Activity.
        */}
        <section className="space-y-5 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Portfolio Intelligence
              </h2>
              <p className="text-xs text-petText-muted mt-0.5">
                Multi-dimensional risk distribution and claim velocity across active portfolio
              </p>
            </div>
            {selectedRiskFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedRiskFilter('ALL')}
                className="text-xs text-brand-teal hover:underline flex items-center gap-1 self-start sm:self-auto font-mono"
              >
                <Filter size={12} />
                <span>Reset Chart Filter ({selectedRiskFilter})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Interactive Risk Distribution */}
            <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Risk Distribution</h3>
                  <span className="text-[11px] text-petText-muted">Click segment to filter portfolio</span>
                </div>
                <span className="text-xs font-mono text-petText-dim">{assessments.length} Underwritten Lives</span>
              </div>

              {/* Segmented Risk Bar */}
              <div className="h-6 w-full rounded-lg overflow-hidden flex bg-surface-higher p-1 gap-1">
                <button
                  type="button"
                  onClick={() => handleRiskBarClick('LOW')}
                  title="Filter Low Risk"
                  className={`h-full rounded transition-all duration-200 ${
                    selectedRiskFilter === 'LOW' ? 'ring-2 ring-white scale-105' : 'opacity-90 hover:opacity-100'
                  } bg-emerald-500`}
                  style={{ width: `${riskDistribution.low}%` }}
                />
                <button
                  type="button"
                  onClick={() => handleRiskBarClick('MEDIUM')}
                  title="Filter Medium Risk"
                  className={`h-full rounded transition-all duration-200 ${
                    selectedRiskFilter === 'MEDIUM' ? 'ring-2 ring-white scale-105' : 'opacity-90 hover:opacity-100'
                  } bg-amber-500`}
                  style={{ width: `${riskDistribution.medium}%` }}
                />
                <button
                  type="button"
                  onClick={() => handleRiskBarClick('HIGH')}
                  title="Filter High Risk"
                  className={`h-full rounded transition-all duration-200 ${
                    selectedRiskFilter === 'HIGH' ? 'ring-2 ring-white scale-105' : 'opacity-90 hover:opacity-100'
                  } bg-rose-500`}
                  style={{ width: `${riskDistribution.high}%` }}
                />
              </div>

              {/* Legend & Stats */}
              <div className="space-y-2 pt-1 text-xs">
                <div
                  onClick={() => handleRiskBarClick('LOW')}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedRiskFilter === 'LOW' ? 'bg-surface-elevated border border-emerald-800/60' : 'hover:bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                    <span className="text-petText-secondary">Low Risk (&lt; 40)</span>
                  </div>
                  <span className="font-mono font-semibold text-white">{riskDistribution.low}%</span>
                </div>

                <div
                  onClick={() => handleRiskBarClick('MEDIUM')}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedRiskFilter === 'MEDIUM' ? 'bg-surface-elevated border border-amber-800/60' : 'hover:bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                    <span className="text-petText-secondary">Medium Risk (40–70)</span>
                  </div>
                  <span className="font-mono font-semibold text-white">{riskDistribution.medium}%</span>
                </div>

                <div
                  onClick={() => handleRiskBarClick('HIGH')}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedRiskFilter === 'HIGH' ? 'bg-surface-elevated border border-rose-800/60' : 'hover:bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                    <span className="text-petText-secondary">High Risk (&gt; 70)</span>
                  </div>
                  <span className="font-mono font-semibold text-white">{riskDistribution.high}%</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Claims Activity Trends */}
            <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Claims Activity Trends</h3>
                  <span className="text-[11px] text-petText-muted">Monthly submitted vs approved claims</span>
                </div>
                <span className="text-xs font-mono text-brand-teal">Oct: ₹36.2k avg</span>
              </div>

              {/* Clean Restrained SVG Bar Chart */}
              {(portfolioMetrics?.claimsActivity || []).length === 0 ? (
                <div className="h-36 flex items-center justify-center text-xs text-petText-muted">
                  No monthly claims recorded yet.
                </div>
              ) : (
                <div className="h-36 flex items-end justify-between gap-3 pt-3">
                  {(portfolioMetrics?.claimsActivity || []).map(item => {
                    const maxSub = Math.max(...(portfolioMetrics?.claimsActivity || []).map(c => c.submitted), 10);
                    const heightSub = (item.submitted / maxSub) * 100;
                    const heightAppr = (item.approved / maxSub) * 100;

                    return (
                      <div key={item.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <div className="w-full flex items-end justify-center gap-1.5 h-28">
                          {/* Submitted */}
                          <div
                            className="w-2.5 bg-slate-600 rounded-t transition-all group-hover:bg-slate-400"
                            style={{ height: `${heightSub}%` }}
                            title={`${item.month} Submitted: ${item.submitted}`}
                          />
                          {/* Approved */}
                          <div
                            className="w-2.5 bg-brand-teal rounded-t transition-all group-hover:bg-[#139C8B]"
                            style={{ height: `${heightAppr}%` }}
                            title={`${item.month} Approved: ${item.approved}`}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-petText-muted">{item.month.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-center gap-6 text-[11px] text-petText-muted pt-2 border-t border-surface-border">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2 rounded bg-slate-600" />
                  <span>Submitted</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2 rounded bg-brand-teal" />
                  <span>Approved</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 
          6. METRICS / ANALYTICS
          Moved lower down on the dashboard so they don't dominate the top view.
        */}
        <section className="space-y-4 pt-4 border-t border-surface-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Operational Portfolio Metrics
              </h2>
              <p className="text-xs text-petText-muted">
                Intake velocity, review bottlenecks, and outstanding clinical records
              </p>
            </div>
            <Link
              to="/analytics"
              className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
            >
              <span>Full Actuarial Analytics</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Applications"
              value={portfolioMetrics ? portfolioMetrics.totalApplications.toString() : assessments.length.toString()}
              subtext="Portfolio intake in database"
              trend={{ value: "Live Count", isNeutral: true }}
              icon={FileText}
              onClick={() => navigate('/assessments')}
            />
            <MetricCard
              label="Require Attention"
              value={
                portfolioMetrics
                  ? portfolioMetrics.requireAttention.toString()
                  : assessments.filter(a => a.status === 'Under Review' || a.status === 'Information Requested' || a.riskLevel === 'HIGH').length.toString()
              }
              subtext="Prioritized underwriting queues"
              trend={{ value: "Action required", isPositive: false }}
              icon={AlertCircle}
              variant="warning"
              onClick={() => navigate('/assessments')}
            />
            <MetricCard
              label="Claims Under Review"
              value={
                portfolioMetrics
                  ? portfolioMetrics.claimsUnderReview.toString()
                  : claims.filter(c => c.status === 'Under Review' || c.status === 'Attention Required').length.toString()
              }
              subtext="Active claims pending review"
              trend={{ value: "Live Queue", isNeutral: true }}
              icon={Clock}
              onClick={() => navigate('/claims')}
            />
            <MetricCard
              label="Information Gaps"
              value={
                portfolioMetrics
                  ? portfolioMetrics.informationGaps.toString()
                  : assessments.reduce((sum, a) => sum + (a.informationGaps?.filter(g => g.status !== 'Resolved').length || 0), 0).toString()
              }
              subtext="Pending veterinary clarifications"
              trend={{ value: "Awaiting clinic", isNeutral: true }}
              icon={FileQuestion}
              variant="teal"
              onClick={() => navigate('/information-requests')}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
