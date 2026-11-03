import React from 'react';
import { User, Shield, Award, Clock, FileCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ProfilePage: React.FC = () => {
  const { assessments, currentUser } = useApp();

  const auditDecisions = assessments.flatMap(a =>
    (a.decisionHistory || []).map(dh => ({
      ...dh,
      petName: a.petName,
      policyId: a.policyId,
      assessmentId: a.id
    }))
  );

  const fullName = currentUser?.fullName || 'Sarah Jenkins';
  const roleName = currentUser?.role || 'Senior Underwriter (Level 4)';
  const orgName = currentUser?.organization || 'Tata AIG General Insurance';
  const authorityLimit = currentUser?.authorityLimitInr || 500000;
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="pt-24 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Profile Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-surface-border shadow-cinematic flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-brand-spruce text-brand-ivory flex items-center justify-center text-3xl font-bold font-mono border-2 border-brand-teal shadow-elevated">
          {initials}
        </div>

        <div className="text-center sm:text-left space-y-1.5 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {fullName}
            </h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-teal-950/60 text-brand-teal border border-teal-800/40 self-center sm:self-auto">
              {roleName}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-petText-secondary">
            {orgName} · Pet &amp; Veterinary Specialty Risk Division
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-petText-muted pt-2">
            <span>ID: {currentUser?.id || 'UW-IN-88912'}</span>
            <span>·</span>
            <span>Guidewire PolicyCenter Certified</span>
            <span>·</span>
            <span>{currentUser?.email || 'bengaluru-hub@petrails.insure'}</span>
          </div>
        </div>
      </div>

      {/* Authority & License Credentials Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-5 rounded-xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center gap-2 text-brand-teal">
            <Shield size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">
              Binding Authority Limit
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-white">₹{authorityLimit.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-petText-muted block">
            Per incident animal claim &amp; policy underwriting discretion limit
          </span>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <Award size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">
              Statutory License
            </span>
          </div>
          <p className="text-lg font-bold font-mono text-white">IRDAI / UW / 2021-994</p>
          <span className="text-[11px] text-petText-muted block">
            Specialized Companion Animal Risk Certification (Active)
          </span>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-surface-border space-y-2">
          <div className="flex items-center gap-2 text-sky-400">
            <FileCheck size={16} />
            <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">
              Portfolio Retention
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-white">96.4%</p>
          <span className="text-[11px] text-petText-muted block">
            Optimal actuarial loss ratio across 1,200+ adjudicated accounts
          </span>
        </div>
      </div>

      {/* Decision Audit Trail Log */}
      <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4 shadow-cinematic">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-brand-teal" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Sarah Jenkins — Statutory Decision Audit Trail
            </h3>
          </div>
          <span className="text-xs font-mono text-petText-muted">
            {auditDecisions.length} Historical Records
          </span>
        </div>

        <div className="space-y-3">
          {auditDecisions.map(entry => (
            <div
              key={entry.id}
              className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{entry.petName}</span>
                  <span className="font-mono text-[11px] text-petText-muted">({entry.policyId})</span>
                  <span className="text-petText-dim">·</span>
                  <span className="font-mono text-brand-teal">{entry.timestamp}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface-higher text-white border border-surface-border">
                  Action: {entry.action}
                </span>
              </div>
              <p className="text-petText-secondary leading-relaxed pl-1 border-l-2 border-brand-teal/60">
                {entry.notes}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
