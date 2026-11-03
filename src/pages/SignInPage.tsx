import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Lock, Mail, Eye, EyeOff, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import { PET_IMAGES } from '../data/mockData';
import { authService } from '../services/authService';
import { useApp } from '../context/AppContext';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshData } = useApp();
  const [email, setEmail] = useState('sarah.jenkins@petrails.insure');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.login({ email, password });
      await refreshData();
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: 'underwriter' | 'claims') => {
    setIsLoading(true);
    setErrorMessage(null);
    const targetEmail = role === 'underwriter' 
      ? 'sarah.jenkins@petrails.insure' 
      : 'rajesh.gupta@petrails.insure';
    setEmail(targetEmail);
    try {
      await authService.login({ email: targetEmail, password: 'Petrails@2026' });
      await refreshData();
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Demo user authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080A0B] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-teal/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[1000px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-surface border border-surface-border shadow-cinematic">
        {/* Left: Cinematic Visual Brand Column */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 bg-surface-higher overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <img
              src={PET_IMAGES.vetExamDog}
              alt="Veterinarian examining canine patient"
              className="w-full h-full object-cover object-center filter brightness-[0.7] contrast-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111416] via-[#111416]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111416]/80" />
          </div>

          {/* Top Brand Logo */}
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

          {/* Bottom Testimonial / Philosophy */}
          <div className="relative z-10 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-brand-teal font-semibold">
              Statutory Decision Support
            </span>
            <p className="text-sm text-white font-medium leading-snug">
              "PETRAILS supports professional judgment. It does not replace it."
            </p>
            <p className="text-xs text-petText-muted font-light">
              Built specifically for licensed pet insurance underwriters and claims adjudicators.
            </p>
          </div>
        </div>

        {/* Right: Authentication Form Column */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-8 bg-surface">
          <div>
            {/* Header */}
            <div className="space-y-1.5 mb-8">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-teal font-medium">
                Underwriting Terminal
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Sign in to PETRAILS
              </h2>
              <p className="text-xs sm:text-sm text-petText-secondary">
                Enter your authorized credentials to access your risk portfolio.
              </p>
            </div>

            {/* Quick Demo Login Option */}
            <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border mb-6 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-petText-muted block">
                Instant One-Click Demo Access
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('underwriter')}
                  className="flex-1 py-2 px-3 rounded-lg bg-surface hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UserCheck size={13} className="text-brand-teal" />
                  <span>Sarah Jenkins (Underwriter)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('claims')}
                  className="py-2 px-3 rounded-lg bg-surface hover:bg-surface-higher border border-surface-border text-xs font-semibold text-petText-secondary hover:text-white transition-colors"
                >
                  <span>Claims Adjuster</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-petText-secondary font-medium mb-1.5">
                  Enterprise Work Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-petText-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs placeholder-petText-dim focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors"
                    placeholder="name@company.insure"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-petText-secondary font-medium">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] text-brand-teal hover:underline font-mono"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-petText-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-white text-xs placeholder-petText-dim focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-petText-muted hover:text-white"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-petText-secondary">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-surface-elevated border-surface-border text-brand-teal focus:ring-brand-teal accent-brand-teal"
                  />
                  <span>Remember this terminal session</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-brand-teal hover:bg-[#139C8B] text-[#080A0B] font-bold text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Authenticating Credentials...</span>
                  ) : (
                    <>
                      <span>Sign In to Underwriting Terminal</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer Note */}
          <div className="pt-6 border-t border-surface-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-petText-dim">
            <span>
              New organization?{' '}
              <Link to="/sign-up" className="text-brand-teal hover:underline font-semibold">
                Register team access
              </Link>
            </span>
            <span className="font-mono text-[10px]">IRDAI &amp; Guidewire Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
