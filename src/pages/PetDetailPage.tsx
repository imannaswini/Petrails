import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { RiskBadge } from '../components/common/RiskBadge';
import { Timeline } from '../components/common/Timeline';
import {
  ArrowLeft,
  Calendar,
  Shield,
  FileText,
  Clock,
  Phone,
  Building2,
  Syringe,
  Pill,
  Scissors
} from 'lucide-react';

export const PetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { pets, assessments, claims } = useApp();
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'medical' | 'vaccines' | 'medications' | 'surgeries' | 'policies' | 'claims'
  >('timeline');

  const pet = pets.find(p => p.id === id) || (pets.length > 0 ? pets[0] : null);
  const assessment = pet ? assessments.find(a => a.petId === pet.id) || null : null;
  const petClaims = pet ? claims.filter(c => c.petId === pet.id) : [];

  if (!pet) {
    return (
      <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Animal Dossier Not Found</h2>
        <p className="text-xs text-petText-muted">The requested pet record is not in the database.</p>
        <Link
          to="/pets"
          className="inline-block px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
        >
          Back to Pets Library
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20">
      {/* Large Pet Hero Section (Immersive & Cinematic) */}
      <div className="relative min-h-[420px] sm:min-h-[460px] flex items-end overflow-hidden border-b border-surface-border">
        {/* Background pet image with dramatic lighting & gradients */}
        <div className="absolute inset-0">
          <img
            src={pet.imageUrl}
            alt={pet.name}
            className="w-full h-full object-cover object-center filter brightness-[0.4] contrast-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/50" />
        </div>

        {/* Back Link Floating */}
        <div className="absolute top-24 left-4 sm:left-8 z-10">
          <Link
            to="/pets"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated/80 backdrop-blur-md border border-surface-border text-xs text-petText-secondary hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Pets Library</span>
          </Link>
        </div>

        {/* Hero Content Information */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <RiskBadge level={pet.riskLevel} size="md" />
                <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-surface-elevated/80 backdrop-blur text-petText-muted border border-surface-border">
                  Policy #{pet.policyId}
                </span>
                <span className="font-mono text-xs text-brand-teal">
                  Index: {pet.riskScore} / 100
                </span>
              </div>

              {/* Pet Title & Metrics */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white uppercase">
                {pet.name}
              </h1>

              <p className="text-base sm:text-lg text-brand-ivory font-light">
                {pet.breed}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-petText-secondary pt-1">
                <span>{pet.age} {pet.ageUnit}</span>
                <span>·</span>
                <span>{pet.sex}</span>
                <span>·</span>
                <span>{pet.weightKg} kg</span>
                <span>·</span>
                <span>Microchip: {pet.microchipId || 'Verified'}</span>
              </div>
            </div>

            {/* Quick Actions Right */}
            {assessment && (
              <div className="flex items-center gap-3">
                <Link
                  to={`/assessments/${assessment.id}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-teal hover:bg-teal-400 text-background font-bold text-xs tracking-wide transition-colors shadow-sm"
                >
                  <Shield size={15} />
                  <span>Underwriting Assessment</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Body Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Contact and Clinic Overview Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
            <span className="text-[11px] font-mono uppercase text-petText-muted block">Owner &amp; Custodian</span>
            <p className="font-bold text-white text-sm">{pet.ownerName}</p>
            <p className="text-petText-secondary flex items-center gap-1.5 pt-1">
              <Phone size={12} className="text-brand-teal" />
              <span>{pet.ownerPhone}</span>
            </p>
            <p className="text-petText-dim">{pet.location}</p>
          </div>

          <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
            <span className="text-[11px] font-mono uppercase text-petText-muted block">Registered Primary Clinic</span>
            <p className="font-bold text-white text-sm">{pet.registeredVetClinic.split(',')[0]}</p>
            <p className="text-petText-secondary flex items-center gap-1.5 pt-1">
              <Building2 size={12} className="text-brand-teal" />
              <span>{pet.registeredVetClinic}</span>
            </p>
            <p className="text-petText-dim">Direct EMR Integration Active</p>
          </div>

          <div className="p-4 rounded-xl bg-surface border border-surface-border space-y-1">
            <span className="text-[11px] font-mono uppercase text-petText-muted block">Active Insurance Underwriting</span>
            <p className="font-bold text-white text-sm">Status: {pet.policyStatus}</p>
            {assessment ? (
              <>
                <p className="text-brand-teal font-mono pt-1">Rule Score: {assessment.ruleScore} | ML Score: {assessment.mlScore}</p>
                <p className="text-petText-dim">Confidence Band: {assessment.calibrationBand}</p>
              </>
            ) : (
              <p className="text-petText-dim pt-1">Assessment pending generation</p>
            )}
          </div>
        </div>

        {/* Navigation Tabs for Dossier Sub-sections */}
        <div className="border-b border-surface-border flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
          {[
            { id: 'timeline', label: 'Medical Timeline', icon: Clock },
            { id: 'vaccines', label: `Vaccinations (${pet.vaccinations.length})`, icon: Syringe },
            { id: 'medications', label: `Medications (${pet.medications.length})`, icon: Pill },
            { id: 'surgeries', label: `Surgeries (${pet.surgeries.length})`, icon: Scissors },
            { id: 'policies', label: `Insurance Policies (${pet.policies.length})`, icon: Shield },
            { id: 'claims', label: `Claims Dossier (${petClaims.length})`, icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  active
                    ? 'border-brand-teal text-white bg-surface-elevated/40'
                    : 'border-transparent text-petText-secondary hover:text-white hover:bg-surface-elevated/20'
                }`}
              >
                <Icon size={14} className={active ? 'text-brand-teal' : 'text-petText-dim'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Display */}
        <div className="min-h-[350px]">
          {/* Tab 1: Clinical Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                <h3 className="text-sm font-bold text-white">Chronological Veterinary Event Timeline</h3>
                <span className="text-xs font-mono text-petText-muted">
                  {pet.medicalHistory.length} Authenticated Clinic Consultations
                </span>
              </div>
              <Timeline records={pet.medicalHistory} />
            </div>
          )}

          {/* Tab 2: Vaccinations */}
          {activeTab === 'vaccines' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pet.vaccinations.map(v => (
                  <div key={v.id} className="p-4 rounded-xl bg-surface border border-surface-border space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{v.vaccineName}</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                        {v.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-petText-secondary pt-1 font-mono text-[11px]">
                      <div>
                        <span className="text-petText-muted block">Administered</span>
                        <span>{v.administeredDate}</span>
                      </div>
                      <div>
                        <span className="text-petText-muted block">Next Due Date</span>
                        <span>{v.nextDueDate}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-petText-dim font-mono pt-1 border-t border-surface-border">
                      Batch: {v.batchNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Medications */}
          {activeTab === 'medications' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {pet.medications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pet.medications.map(m => (
                    <div key={m.id} className="p-4 rounded-xl bg-surface border border-surface-border space-y-2 text-xs">
                      <span className="font-bold text-white text-sm">{m.name}</span>
                      <p className="text-petText-secondary">{m.dosage} · {m.frequency}</p>
                      <div className="p-2 rounded bg-surface-elevated text-petText-muted text-[11px]">
                        Prescribed for: {m.prescribedFor}
                      </div>
                      <span className="text-[10px] text-petText-dim font-mono block">
                        Start Date: {m.startDate} {m.endDate ? `· End Date: ${m.endDate}` : '· Ongoing'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center rounded-xl bg-surface border border-surface-border text-petText-muted text-xs">
                  Zero active long-term prescriptions recorded in veterinary chart.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Surgeries */}
          {activeTab === 'surgeries' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {pet.surgeries.length > 0 ? (
                <div className="space-y-4">
                  {pet.surgeries.map(s => (
                    <div key={s.id} className="p-5 rounded-xl bg-surface border border-surface-border space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm">{s.surgeryName}</h4>
                        <span className="font-mono text-petText-muted">{s.date}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-petText-secondary">
                        <p>Hospital: {s.hospital}</p>
                        <p>Surgeon: {s.surgeon}</p>
                      </div>
                      <p className="text-petText-secondary">Recovery: {s.postOpRecovery}</p>
                      <p className="text-emerald-400">Complications: {s.complications}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center rounded-xl bg-surface border border-surface-border text-petText-muted text-xs">
                  Zero surgical procedures on record.
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Policies */}
          {activeTab === 'policies' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {pet.policies.map(p => (
                <div key={p.id} className="p-5 rounded-xl bg-surface border border-surface-border space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">{p.tier} Tier Policy</h4>
                      <span className="font-mono text-petText-muted">Policy #{p.policyNumber}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded font-mono text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                      {p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono pt-2">
                    <div className="p-2.5 rounded-lg bg-surface-elevated">
                      <span className="text-[10px] text-petText-muted block">Annual Limit</span>
                      <span className="font-bold text-white">₹{p.annualCoverageLimit.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-elevated">
                      <span className="text-[10px] text-petText-muted block">Deductible</span>
                      <span className="font-bold text-white">₹{p.deductible.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-elevated">
                      <span className="text-[10px] text-petText-muted block">Copay</span>
                      <span className="font-bold text-white">{p.copayPercent}%</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-elevated">
                      <span className="text-[10px] text-petText-muted block">Renewal Date</span>
                      <span className="text-petText-secondary">{p.renewalDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 6: Claims */}
          {activeTab === 'claims' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {petClaims.length > 0 ? (
                <div className="space-y-3">
                  {petClaims.map(c => (
                    <div key={c.id} className="p-4 rounded-xl bg-surface border border-surface-border flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-petText-muted">{c.claimNumber}</span>
                          <span className="font-bold text-white">{c.treatment}</span>
                        </div>
                        <span className="text-[11px] text-petText-dim font-mono">{c.date} · Anomaly Score: {c.anomalyScore}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold font-mono text-white text-sm">
                          ₹{c.amountInr.toLocaleString('en-IN')}
                        </span>
                        <Link
                          to={`/claims/${c.id}`}
                          className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-higher text-white font-medium"
                        >
                          Inspect
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center rounded-xl bg-surface border border-surface-border text-petText-muted text-xs">
                  Zero historical claims filed under this policy.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
