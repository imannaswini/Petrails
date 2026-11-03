import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, Shield, User, Settings, LogOut, Plus, ChevronDown, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const {
    unreadNotificationCount,
    setIsSearchOpen,
    setIsNotificationsOpen,
    isNotificationsOpen,
    currentUser,
    logoutUser
  } = useApp();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLandingPage = location.pathname === '/';
  const isAuthPage =
    location.pathname === '/sign-in' ||
    location.pathname === '/sign-up' ||
    location.pathname === '/forgot-password';

  // Authenticated Application Links
  const appNavLinks = [
    { name: 'Home', path: '/dashboard' },
    { name: 'Assessments', path: '/assessments' },
    { name: 'Claims', path: '/claims' },
    { name: 'Pets', path: '/pets' },
    { name: 'Analytics', path: '/analytics' }
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard')) {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  // If on Auth Pages (Sign In / Sign Up / Forgot Password), show clean minimal brand bar
  if (isAuthPage) {
    return (
      <header className="fixed top-0 left-0 right-0 z-40 py-4 px-6 sm:px-10 max-w-[1440px] mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-brand-teal">
            <Shield size={17} className="text-brand-teal" />
          </div>
          <span className="font-bold tracking-widest text-lg font-sans text-white">
            PETRAILS
          </span>
        </Link>
        <Link
          to="/dashboard"
          className="text-xs font-mono text-petText-muted hover:text-brand-teal transition-colors flex items-center gap-1"
        >
          <span>Explore Live Demo</span>
          <ArrowRight size={13} />
        </Link>
      </header>
    );
  }

  // 1. PUBLIC LANDING PAGE NAVBAR (Prompt Requirement)
  // PETRAILS | Product, Solutions, How It Works, For Insurers | Sign In, Get Started
  if (isLandingPage) {
    return (
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#080A0B]/95 backdrop-blur-md border-b border-[#1F2428] shadow-elevated py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-12">
          <div className="flex items-center justify-between">
            {/* Left: Brand Wordmark & Public Nav */}
            <div className="flex items-center gap-10 lg:gap-14">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-brand-teal group-hover:border-brand-teal/80 transition-colors shadow-subtle">
                  <Shield size={17} className="text-brand-teal" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold tracking-widest text-lg font-sans text-petText-primary flex items-center gap-1.5">
                    PETRAILS
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-teal inline-block" />
                  </span>
                  <span className="text-[9px] tracking-wider uppercase text-petText-dim -mt-1 font-mono">
                    Risk &amp; Claims Intelligence
                  </span>
                </div>
              </Link>

              {/* Public Navigation Links */}
              <nav className="hidden md:flex items-center gap-7 lg:gap-9 text-xs font-medium text-petText-secondary">
                <a href="#solutions" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 750, behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                  Product
                </a>
                <a href="#capabilities" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 1250, behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                  Solutions
                </a>
                <a href="#how-it-works" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 2150, behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                  How It Works
                </a>
                <a href="#for-insurers" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 3800, behavior: 'smooth' }); }} className="hover:text-white transition-colors">
                  For Insurers
                </a>
              </nav>
            </div>

            {/* Right: Sign In & Get Started CTAs */}
            <div className="flex items-center gap-4 sm:gap-6">
              <Link
                to="/sign-in"
                className="text-xs font-semibold text-white hover:text-brand-teal transition-colors tracking-wide py-1"
              >
                Sign In
              </Link>

              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-teal hover:bg-[#139C8B] text-[#080A0B] text-xs font-bold tracking-wide transition-all shadow-md hover:shadow-teal-500/20"
              >
                <span>Get Started</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // 2. AUTHENTICATED UNDERWRITER APP NAVBAR (In-App Terminal)
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#080A0B]/95 backdrop-blur-md border-b border-[#1F2428] shadow-elevated py-3'
          : 'bg-gradient-to-b from-[#080A0B]/90 via-[#080A0B]/60 to-transparent backdrop-blur-sm py-4'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between">
          {/* Left: Brand Wordmark & Main Nav */}
          <div className="flex items-center gap-10 lg:gap-14">
            <Link to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-brand-teal group-hover:border-brand-teal/80 transition-colors">
                <Shield size={17} className="text-brand-teal" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-widest text-lg font-sans text-petText-primary flex items-center gap-1.5">
                  PETRAILS
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-teal inline-block" />
                </span>
                <span className="text-[9px] tracking-wider uppercase text-petText-dim -mt-1 font-mono">
                  Risk &amp; Claims Intelligence
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links — Breathing Spacing */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {appNavLinks.map(link => {
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-xs tracking-wider transition-colors py-1 ${
                      active
                        ? 'text-white font-semibold border-b-2 border-brand-teal'
                        : 'text-petText-secondary hover:text-white font-medium'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Quick Action, Search, Notifications, Profile */}
          <div className="flex items-center gap-4 lg:gap-6">
            {/* New Assessment Quick Button */}
            <Link
              to="/assessments/new"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-teal hover:bg-[#139C8B] text-[#080A0B] text-xs font-bold tracking-wide transition-all shadow-sm hover:shadow-teal-500/20"
              title="Initiate New Risk Assessment"
            >
              <Plus size={14} />
              <span>New Assessment</span>
            </Link>

            {/* Global Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 text-petText-secondary hover:text-white text-xs transition-colors p-1.5 rounded-md hover:bg-surface-elevated"
              aria-label="Search records (/)"
            >
              <Search size={16} className="text-petText-muted" />
              <kbd className="hidden sm:inline-block font-mono text-[10px] bg-surface px-1.5 py-0.5 rounded text-petText-dim border border-surface-border">
                /
              </kbd>
            </button>

            {/* Notification Drawer Toggle */}
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-1.5 rounded-md text-petText-secondary hover:text-white hover:bg-surface-elevated transition-colors"
              aria-label="View notifications"
            >
              <Bell size={17} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-teal text-[10px] font-mono font-bold text-background flex items-center justify-center animate-pulse">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown — Minimal & Clean */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-surface-elevated transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-surface-border text-brand-teal flex items-center justify-center text-xs font-bold font-mono">
                  {currentUser?.fullName
                    ? currentUser.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'SJ'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-white leading-tight">
                    {currentUser?.fullName || 'Sarah Jenkins'}
                  </span>
                  <span className="text-[10px] text-petText-muted leading-tight font-mono">
                    {currentUser?.role || 'Senior Underwriter'}
                  </span>
                </div>
                <ChevronDown size={12} className="text-petText-dim hidden lg:inline" />
              </button>

              {/* Profile Dropdown Menu */}
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-xl bg-surface border border-surface-border shadow-cinematic py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <div className="px-3.5 py-2 border-b border-surface-border">
                    <p className="text-xs font-semibold text-white">
                      {currentUser?.fullName || 'Sarah Jenkins'}
                    </p>
                    <p className="text-[10px] text-petText-muted font-mono">
                      {currentUser?.role || 'Senior Underwriting Officer'}
                    </p>
                    <div className="mt-1 text-[10px] font-mono text-brand-teal">
                      Authority: ₹{(currentUser?.authorityLimitInr || 500000).toLocaleString('en-IN')} / claim
                    </div>
                  </div>
                  <div className="py-1 text-xs">
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-petText-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                    >
                      <User size={13} />
                      <span>Profile</span>
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-petText-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                    >
                      <Settings size={13} />
                      <span>Preferences</span>
                    </Link>
                    <Link
                      to="/information-requests"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-petText-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                    >
                      <Shield size={13} />
                      <span>Information Requests</span>
                    </Link>
                  </div>
                  <div className="border-t border-surface-border pt-1">
                    <Link
                      to="/sign-in"
                      onClick={() => {
                        logoutUser();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-400 hover:bg-surface-elevated transition-colors"
                    >
                      <LogOut size={13} />
                      <span>Sign out</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Horizontal Navigation Strip */}
        <div className="md:hidden flex items-center gap-4 overflow-x-auto hide-scrollbar pt-2 pb-1 border-t border-surface-border/60 mt-2">
          {appNavLinks.map(link => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`text-xs whitespace-nowrap py-1 ${
                  active
                    ? 'text-white font-semibold border-b-2 border-brand-teal'
                    : 'text-petText-secondary'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
};
