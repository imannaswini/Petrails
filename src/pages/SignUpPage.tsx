import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Lock, Mail, User, Building2, Award, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PET_IMAGES } from '../data/mockData';
import { authService } from '../services/authService';
import { useApp } from '../context/AppContext';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshData } = useApp();
  const [formData, setFormData] = useState({
    organization: 'Tata AIG General Insurance',
    fullName: 'Sarah Jenkins',
    workEmail: 'sarah.jenkins@petrails.insure',
    role: 'Senior Underwriting Officer',
    authorityTier: 'Tier 3 (₹5,00,000 Discretionary Cap)',
    password: '',
    agreeTerms: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.register({
        organization: formData.organization,
        fullName: formData.fullName,
        workEmail: formData.workEmail,
        role: formData.role,
        authorityTier: formData.authorityTier.includes('Tier 1') ? 'tier-1'
          : formData.authorityTier.includes('Tier 3') ? 'tier-3'
            : formData.authorityTier.includes('Tier 4') ? 'tier-4' : 'tier-2',
        password: formData.password
      });
      setIsSuccess(true);
      await refreshData();
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080A0B] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-teal/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[1050px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-surface border border-surface-border shadow-cinematic">
        {/* Left: Cinematic Visual Brand Column */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 bg-surface-higher overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src={PET_IMAGES.vetCatExam}
              alt="Veterinarian examining cat patient in clinic"
              className="w-full h-full object-cover object-center filter brightness-[0.72] contrast-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111416] via-[#111416]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111416]/80" />
          </div>

          <div className="relative z-10">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-brand-teal">
                <Shield size={17} className="text-brand-teal" />
              </div>
              <span className="font-bold tracking-widest text-lg font-sans text-white">
                PETRAILS
              </span>
            </Link>
          </div>

          <div className="relative z-10 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-brand-teal font-semibold">
              Enterprise Deployment
            </span>
            <p className="text-sm text-white font-medium leading-snug">
              "Understand every pet. Make every decision clearer."
            </p>
            <div className="space-y-1.5 text-xs text-petText-muted pt-2 border-t border-surface-border/60">
              <p className="flex items-center gap-2 text-white">
                <CheckCircle2 size={13} className="text-brand-teal" />
                <span>Deterministic Rules + Monotonic ML</span>
              </p>
              <p className="flex items-center gap-2 text-white">
                <CheckCircle2 size={13} className="text-brand-teal" />
                <span>Guidewire PolicyCenter API Bridge</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Registration Form Column */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-6 bg-surface">
          <div>
            <div className="space-y-1.5 mb-6">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-teal font-medium">
                Team Onboarding
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Register Insurance Team
              </h2>
              <p className="text-xs sm:text-sm text-petText-secondary">
                Provision underwriting authority and actuarial model licenses for your carrier or brokerage.
              </p>
            </div>

            {isSuccess ? (
              <div className="p-8 text-center space-y-3 bg-surface-elevated rounded-2xl border border-emerald-800/60">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-base font-bold text-white">Credentials Provisioned Successfully</h3>
                <p className="text-xs text-petText-secondary max-w-sm mx-auto">
                  Your underwriting workspace is ready. Redirecting to your executive intelligence overview...
                </p>
              </div>
            ) : (
              <>
                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">
                        Carrier / Organization
                      </label>
                      <div className="relative">
                        <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-petText-muted" />
                        <input
                          type="text"
                          value={formData.organization}
                          onChange={e => setFormData({ ...formData, organization: e.target.value })}
                          required
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                          placeholder="e.g. Digit, Tata AIG"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">
                        Full Legal Name
                      </label>
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-petText-muted" />
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                          required
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                          placeholder="Sarah Jenkins"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">
                      Corporate Work Email
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-petText-muted" />
                      <input
                        type="email"
                        value={formData.workEmail}
                        onChange={e => setFormData({ ...formData, workEmail: e.target.value })}
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                        placeholder="name@company.insure"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">
                        Professional Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                      >
                        <option>Senior Underwriting Officer</option>
                        <option>Claims Adjuster / Investigator</option>
                        <option>Veterinary Medical Officer</option>
                        <option>Risk &amp; Actuarial Analyst</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">
                        Authority Limit Cap
                      </label>
                      <div className="relative">
                        <Award size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-petText-muted" />
                        <select
                          value={formData.authorityTier}
                          onChange={e => setFormData({ ...formData, authorityTier: e.target.value })}
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                        >
                          <option>Tier 1 (₹1,50,000 Limit)</option>
                          <option>Tier 2 (₹3,00,000 Limit)</option>
                          <option>Tier 3 (₹5,00,000 Discretionary Cap)</option>
                          <option>Tier 4 (Unlimited CMO Referral)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">
                      Secure Password
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-petText-muted" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-petText-secondary leading-snug">
                      <input
                        type="checkbox"
                        checked={formData.agreeTerms}
                        onChange={e => setFormData({ ...formData, agreeTerms: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded bg-surface-elevated border-surface-border text-brand-teal focus:ring-brand-teal accent-brand-teal"
                      />
                      <span>
                        I agree to the PETRAILS Underwriting Discretionary Charter and IRDAI Veterinary Health Records compliance protocols.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading || !formData.agreeTerms}
                      className="w-full py-3 px-4 rounded-xl bg-brand-teal hover:bg-[#139C8B] text-[#080A0B] font-bold text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span>Setting up team tenant...</span>
                      ) : (
                        <>
                          <span>Complete Registration</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-surface-border/60 text-xs text-petText-dim flex items-center justify-between">
            <span>
              Already registered?{' '}
              <Link to="/sign-in" className="text-brand-teal hover:underline font-semibold">
                Sign in
              </Link>
            </span>
            <span className="font-mono text-[10px]">SOC 2 &amp; HIPAA Veterinary Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
