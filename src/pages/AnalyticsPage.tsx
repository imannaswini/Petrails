import React, { useState, useEffect } from 'react';
import { analyticsService } from '../services/analyticsService';
import { PortfolioMetrics } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { BarChart3, TrendingUp, ShieldCheck, Activity, RefreshCw } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('Last 6 Months');
  const [speciesFilter, setSpeciesFilter] = useState('ALL');
  const [policyTierFilter, setPolicyTierFilter] = useState('ALL');

  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsService.getPortfolioMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch live portfolio metrics from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const riskDistribution = metrics?.riskDistribution || { low: 0, medium: 0, high: 0 };
  const claimsActivity = metrics?.claimsActivity || [];
  const speciesBreakdown = metrics?.speciesBreakdown || [];
  const breedRiskTrends = metrics?.breedRiskTrends || [];
  const totalPolicies = metrics?.totalApplications || 0;

  return (
    <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-brand-teal">
            Actuarial Intelligence &amp; Model Governance
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mt-1">
            Portfolio Analytics
          </h1>
          <p className="text-xs sm:text-sm text-petText-secondary mt-1">
            Macro-level risk synthesis, loss ratio distributions, and actuarial model calibration monitoring.
          </p>
        </div>

        {/* Filters and Refresh */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-2 rounded-lg bg-surface-elevated border border-surface-border text-xs text-petText-secondary hover:text-white hover:border-brand-teal transition-colors"
            title="Refresh analytics from MongoDB Atlas"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-brand-teal' : ''} />
          </button>

          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs text-petText-secondary focus:border-brand-teal"
          >
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
            <option>Last 6 Months</option>
            <option>Year to Date (2026)</option>
          </select>

          <select
            value={speciesFilter}
            onChange={e => setSpeciesFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs text-petText-secondary focus:border-brand-teal"
          >
            <option value="ALL">All Species</option>
            <option value="Dog">Canine (Dog)</option>
            <option value="Cat">Feline (Cat)</option>
          </select>

          <select
            value={policyTierFilter}
            onChange={e => setPolicyTierFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs text-petText-secondary focus:border-brand-teal"
          >
            <option value="ALL">All Policy Tiers</option>
            <option value="Essential">Essential</option>
            <option value="Comprehensive">Comprehensive</option>
            <option value="Elite Wellness">Elite Wellness</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchMetrics} className="underline hover:text-white">Retry</button>
        </div>
      )}

      {/* Top Analytical KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Underwritten Lives"
          value={loading ? '...' : totalPolicies.toLocaleString()}
          subtext="Underwritten applications in database"
          trend={{ value: "+100% Verified", isPositive: true }}
          icon={TrendingUp}
        />
        <MetricCard
          label="Active Claims Under Review"
          value={loading ? '...' : (metrics?.claimsUnderReview || 0).toString()}
          subtext="Requiring officer review"
          trend={{ value: "Live Queue", isNeutral: true }}
          icon={BarChart3}
        />
        <MetricCard
          label="Pending Clinical Gaps"
          value={loading ? '...' : (metrics?.informationGaps || 0).toString()}
          subtext="Awaiting clinic / vet clarification"
          trend={{ value: "Active inquiries", isNeutral: true }}
          icon={Activity}
          variant="teal"
        />
        <MetricCard
          label="Items Requiring Attention"
          value={loading ? '...' : (metrics?.requireAttention || 0).toString()}
          subtext="High-risk or pending decision"
          trend={{ value: "Priority Focus", isNeutral: true }}
          icon={ShieldCheck}
        />
      </div>

      {/* Grid: Risk Distribution + Claims Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Risk Distribution */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-sm font-bold text-white">Portfolio Risk Distribution</h3>
            <span className="text-xs font-mono text-petText-muted">{totalPolicies} Total Policies</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-petText-secondary font-medium">Low Risk (&lt; 40 score)</span>
                <span className="font-mono text-white font-semibold">
                  {riskDistribution.low} {totalPolicies > 0 ? `(${Math.round((riskDistribution.low / totalPolicies) * 100)}%)` : ''}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-surface-higher overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${totalPolicies > 0 ? (riskDistribution.low / totalPolicies) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-petText-secondary font-medium">Medium Risk (40–70 score)</span>
                <span className="font-mono text-white font-semibold">
                  {riskDistribution.medium} {totalPolicies > 0 ? `(${Math.round((riskDistribution.medium / totalPolicies) * 100)}%)` : ''}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-surface-higher overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${totalPolicies > 0 ? (riskDistribution.medium / totalPolicies) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-petText-secondary font-medium">High Risk (&gt; 70 score)</span>
                <span className="font-mono text-white font-semibold">
                  {riskDistribution.high} {totalPolicies > 0 ? `(${Math.round((riskDistribution.high / totalPolicies) * 100)}%)` : ''}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-surface-higher overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${totalPolicies > 0 ? (riskDistribution.high / totalPolicies) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-elevated text-[11px] text-petText-muted border border-surface-border">
            High risk cohort is monitored with secondary sub-limits on brachycephalic airway and geriatric cruciate conditions.
          </div>
        </div>

        {/* Right: Claims Trends & Monthly Settlement */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-sm font-bold text-white">Claims Adjudication Velocity</h3>
            <span className="text-xs font-mono text-brand-teal">Live Adjudication</span>
          </div>

          {claimsActivity.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-xs text-petText-muted">
              <span>No claims recorded in the selected period.</span>
            </div>
          ) : (
            <div className="h-44 flex items-end justify-between gap-3 pt-4">
              {claimsActivity.map(item => {
                const maxVal = Math.max(...claimsActivity.map(c => c.submitted), 10);
                const hSub = (item.submitted / maxVal) * 100;
                const hApp = (item.approved / maxVal) * 100;

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1.5 h-32">
                      <div
                        className="w-3 bg-slate-600 rounded-t transition-all group-hover:bg-slate-400"
                        style={{ height: `${hSub}%` }}
                        title={`${item.month} Submitted: ${item.submitted}`}
                      />
                      <div
                        className="w-3 bg-brand-teal rounded-t transition-all group-hover:bg-teal-300"
                        style={{ height: `${hApp}%` }}
                        title={`${item.month} Approved: ${item.approved}`}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-petText-muted">{item.month.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-xs text-petText-muted pt-2 border-t border-surface-border">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-slate-600" />
              <span>Claims Filed</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-brand-teal" />
              <span>Adjudicated / Paid</span>
            </span>
          </div>
        </div>
      </div>

      {/* Breed Risk Patterns Matrix & Species Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Breed Risk Patterns Table */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div>
              <h3 className="text-sm font-bold text-white">Breed Risk Patterns &amp; Claim Multipliers</h3>
              <p className="text-xs text-petText-secondary mt-0.5">
                Relative claim incidence indexed against cross-breed canine portfolio median (1.0x).
              </p>
            </div>
            <span className="text-xs font-mono text-petText-muted">Statistical Confidence</span>
          </div>

          <div className="overflow-x-auto">
            {breedRiskTrends.length === 0 ? (
              <div className="py-8 text-center text-xs text-petText-muted">
                No breed risk trends recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-petText-muted font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Breed Profile</th>
                    <th className="py-2.5 px-3 text-right">Avg Risk Score</th>
                    <th className="py-2.5 px-3 text-right">Claim Frequency Multiplier</th>
                    <th className="py-2.5 px-3 text-right">Sample Size</th>
                    <th className="py-2.5 px-3">Underwriting Stance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {breedRiskTrends.map(b => (
                    <tr key={b.breed} className="hover:bg-surface-elevated transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-white">{b.breed}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right text-white">
                        {b.avgRiskScore} / 100
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right">
                        <span className={b.claimRatio > 2.5 ? 'text-rose-400 font-bold' : b.claimRatio > 1.5 ? 'text-amber-400' : 'text-emerald-400'}>
                          {b.claimRatio}x
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-petText-secondary">
                        {b.sampleSize}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          b.claimRatio > 3 ? 'bg-rose-950/60 text-rose-300' : b.claimRatio > 1.8 ? 'bg-amber-950/60 text-amber-300' : 'bg-emerald-950/60 text-emerald-300'
                        }`}>
                          {b.claimRatio > 3 ? 'Mandatory Senior Referral' : b.claimRatio > 1.8 ? 'Condition Endorsement' : 'Standard Auto-Bind'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Species Breakdown */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-sm font-bold text-white">Species Breakdown</h3>
            <span className="text-xs font-mono text-petText-muted">Portfolio Mix</span>
          </div>

          <div className="space-y-4 text-xs">
            {speciesBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-petText-muted">
                No species data recorded yet.
              </div>
            ) : (
              speciesBreakdown.map(s => (
                <div key={s.species} className="p-3.5 rounded-xl bg-surface-elevated space-y-1.5 border border-surface-border">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{s.species}</span>
                    <span className="font-mono text-brand-teal font-semibold">{s.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-higher overflow-hidden">
                    <div className="h-full bg-brand-teal rounded-full" style={{ width: `${s.percentage}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-petText-muted pt-1">
                    <span>Enrolled policies:</span>
                    <span className="font-mono text-white">{s.count.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 rounded-lg bg-surface-higher/40 border border-surface-border text-[11px] text-petText-muted">
            Species and breed cohorts are continuously normalized against incoming veterinary data.
          </div>
        </div>
      </div>
    </div>
  );
};
