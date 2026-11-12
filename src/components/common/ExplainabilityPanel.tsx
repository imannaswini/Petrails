import React, { useState } from 'react';
import { ShapFactor } from '../../types';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';

interface ExplainabilityPanelProps {
  factors: ShapFactor[];
  baseValue?: number;
  inferenceMode?: 'TRAINED_MODEL' | 'FALLBACK' | 'UNAVAILABLE';
  modelVersion?: string | null;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({
  factors,
  baseValue,
  inferenceMode = 'UNAVAILABLE',
  modelVersion
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const maxImpact = Math.max(...factors.map(f => Math.abs(f.impact)), 1);

  return (
    <div className="p-6 rounded-xl bg-surface border border-surface-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Why this assessment?</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-brand-teal border border-surface-border">SHAP Attribution</span>
          </div>
          <p className="text-xs text-petText-secondary mt-1">Backend-returned feature contributions.{baseValue !== undefined ? ` Baseline: ${baseValue}.` : ''}</p>
        </div>
        <button onClick={() => setShowTechnicalDetails(!showTechnicalDetails)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-petText-secondary bg-surface-elevated border border-surface-border">
          <Layers size={13} className="text-brand-teal" />{showTechnicalDetails ? 'Hide Model Details' : 'View Model Details'}{showTechnicalDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {factors.length === 0 ? <p className="mt-4 p-3 rounded-lg bg-surface-elevated/70 text-xs text-petText-muted">SHAP explanations unavailable for {inferenceMode.replace('_', ' ').toLowerCase()} inference.</p> : (
        <div className="mt-5 space-y-4">
          {factors.map(factor => {
            const positive = factor.impact > 0;
            return <div key={factor.id} className="p-3 rounded-lg bg-surface-elevated/50 border border-surface-border">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-white">{factor.name}</span>
                <span className={positive ? 'font-mono font-bold text-rose-400' : 'font-mono font-bold text-emerald-400'}>{positive ? '+' : ''}{factor.impact} pts</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-higher overflow-hidden mt-2"><div className={positive ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'} style={{ width: `${Math.min(Math.abs(factor.impact) / maxImpact * 100, 100)}%` }} /></div>
              <p className="text-[11px] text-petText-muted mt-1">{factor.explanation}</p>
              <p className="text-[10px] text-petText-dim mt-1 font-mono">{factor.featureName || 'Feature'} = {factor.featureValue === undefined ? 'unavailable' : String(factor.featureValue)} · {factor.category}</p>
            </div>;
          })}
        </div>
      )}

      {showTechnicalDetails && <div className="mt-6 pt-5 border-t border-surface-border text-xs">
        <p className="text-petText-muted">Inference mode: <span className="text-white">{inferenceMode.replace('_', ' ')}</span></p>
        <p className="text-petText-muted mt-1">Model version: <span className="text-white">{modelVersion || 'Unavailable'}</span></p>
        <p className="text-petText-muted mt-1">Architecture: {inferenceMode === 'TRAINED_MODEL' ? 'RandomForestRegressor' : 'Trained model not used'}</p>
      </div>}
    </div>
  );
};
