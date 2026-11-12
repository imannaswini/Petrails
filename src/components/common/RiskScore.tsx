import React from 'react';
import { RiskLevel } from '../../types';
import { Shield, Cpu, Scale, CheckCircle2 } from 'lucide-react';

interface RiskScoreProps {
  combinedScore: number;
  ruleScore: number;
  mlScore: number;
  riskLevel: RiskLevel;
  inferenceMode?: 'TRAINED_MODEL' | 'FALLBACK' | 'UNAVAILABLE';
  modelVersion?: string | null;
  className?: string;
}

export const RiskScore: React.FC<RiskScoreProps> = ({
  combinedScore,
  ruleScore,
  mlScore,
  riskLevel,
  inferenceMode = 'UNAVAILABLE',
  modelVersion,
  className = ''
}) => {
  // Visual radius and circumference calculation for circular SVG ring
  const radius = 54;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (combinedScore / 100) * circumference;

  const colorConfig = {
    LOW: {
      stroke: '#10B981', // Restrained emerald
      glow: 'rgba(16, 185, 129, 0.25)',
      badge: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60',
      label: 'LOW RISK',
      desc: 'Lowest backend risk classification'
    },
    MEDIUM: {
      stroke: '#F59E0B', // Amber
      glow: 'rgba(245, 158, 11, 0.25)',
      badge: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
      label: 'MEDIUM RISK',
      desc: 'Intermediate backend risk classification'
    },
    HIGH: {
      stroke: '#EF4444', // Red
      glow: 'rgba(239, 68, 68, 0.25)',
      badge: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
      label: 'HIGH RISK',
      desc: 'Highest backend risk classification'
    }
  }[riskLevel];

  return (
    <div className={`p-6 rounded-xl bg-surface border border-surface-border ${className}`}>
      <div className="flex items-center justify-between pb-4 border-b border-surface-border">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-petText-muted">Assessment Matrix</span>
          <h3 className="text-base font-semibold text-petText-primary">Actuarial Risk Synthesis</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-6">
        {/* Left: Circular gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 130 130">
              {/* Background circle track */}
              <circle
                cx="65"
                cy="65"
                r={radius}
                className="stroke-surface-higher"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Active animated stroke */}
              <circle
                cx="65"
                cy="65"
                r={radius}
                stroke={colorConfig.stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{
                  transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: `drop-shadow(0 0 8px ${colorConfig.glow})`
                }}
              />
            </svg>

            {/* Centered Score */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-bold font-mono tracking-tight text-white">
                {combinedScore}
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-petText-muted mt-0.5">
                Index / 100
              </span>
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border tracking-wider uppercase ${colorConfig.badge}`}>
              {colorConfig.label}
            </span>
            <p className="text-xs text-petText-muted mt-1 max-w-[200px]">{colorConfig.desc}</p>
          </div>
        </div>

        {/* Right: Component breakdown bars */}
        <div className="md:col-span-7 space-y-4">
          {/* Rule Engine */}
          <div className="bg-surface-elevated p-3.5 rounded-lg border border-surface-border">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2 text-petText-secondary font-medium">
                <Scale size={14} className="text-petText-muted" />
                <span>Deterministic Rule Engine</span>
              </div>
              <span className="font-mono font-semibold text-petText-primary">{ruleScore} / 100</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-higher overflow-hidden">
              <div
                className="h-full bg-slate-300 rounded-full transition-all duration-700"
                style={{ width: `${ruleScore}%` }}
              />
            </div>
            <span className="text-[11px] text-petText-muted mt-1 block">
              Age bands, configured breed matches, and structured medical history
            </span>
          </div>

          {/* Machine Learning Model */}
          <div className="bg-surface-elevated p-3.5 rounded-lg border border-surface-border">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2 text-petText-secondary font-medium">
                <Cpu size={14} className="text-brand-teal" />
                <span>ML Inference ({inferenceMode.replace('_', ' ')})</span>
              </div>
              <span className="font-mono font-semibold text-petText-primary">{mlScore} / 100</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-higher overflow-hidden">
              <div
                className="h-full bg-brand-teal rounded-full transition-all duration-700"
                style={{ width: `${mlScore}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-petText-muted mt-1">
              <span>{modelVersion ? `Model version ${modelVersion}` : 'Model version unavailable'}</span>
            </div>
          </div>

          {/* Combined Weighting Formula */}
          <div className="px-3 py-2 rounded-md bg-surface-higher/40 border border-surface-border/60 flex items-center justify-between text-xs text-petText-secondary">
            <div className="flex items-center gap-1.5">
              <Shield size={13} className="text-petText-muted" />
              <span>Synthesis Weighting:</span>
            </div>
            <span className="font-mono text-petText-muted">40% Rules + 60% ML (provisional)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
