import React from 'react';
import { Link } from 'react-router-dom';
import { Assessment } from '../../types';
import { RiskBadge } from './RiskBadge';
import { AlertCircle, ArrowRight, Clock, Scale, Cpu } from 'lucide-react';
import {
  formatExactLocalDateTime,
  formatRelativeOrLocalTimestamp,
  useRelativeTimeTick
} from '../../utils/dateTime';

interface AssessmentCardProps {
  assessment: Assessment;
}

export const AssessmentCard: React.FC<AssessmentCardProps> = ({ assessment }) => {
  const nowMs = useRelativeTimeTick(30000);
  const rawTimestamp = assessment.updatedAt || assessment.createdAt || assessment.lastUpdated;
  const formattedTime = formatRelativeOrLocalTimestamp(rawTimestamp, nowMs);
  const exactTimeTitle = formatExactLocalDateTime(rawTimestamp);

  return (
    <div className="group rounded-xl overflow-hidden bg-surface border border-surface-border hover:border-surface-borderLight transition-all duration-300 hover:-translate-y-1 hover:shadow-cinematic flex flex-col justify-between">
      <div>
        {/* Top visual strip with image */}
        <div className="zoom-image-container relative h-36 w-full bg-surface-higher">
          <img
            src={assessment.imageUrl}
            alt={assessment.petName}
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-black/30" />

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] tracking-wider px-2 py-0.5 rounded bg-background/80 backdrop-blur-md text-petText-secondary border border-surface-border">
                {assessment.policyId}
              </span>
              <span
                className={`font-mono text-[10px] px-2 py-0.5 rounded backdrop-blur-md border ${
                  assessment.status === 'Approved'
                    ? 'bg-emerald-950/75 text-emerald-300 border-emerald-800/50'
                    : assessment.status === 'Under Review'
                    ? 'bg-amber-950/75 text-amber-300 border-amber-800/50'
                    : assessment.status === 'Information Requested'
                    ? 'bg-sky-950/75 text-sky-300 border-sky-800/50'
                    : 'bg-rose-950/75 text-rose-300 border-rose-800/50'
                }`}
              >
                {assessment.status}
              </span>
            </div>
            <RiskBadge level={assessment.riskLevel} size="sm" />
          </div>

          <div className="absolute bottom-2 left-3 right-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-brand-ivory transition-colors">
                {assessment.petName.toUpperCase()}
              </h3>
              <p className="text-xs text-petText-secondary line-clamp-1">
                {assessment.breed} · {assessment.ageText}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-white">
                {assessment.combinedScore}
              </span>
              <span className="text-[10px] text-petText-muted block font-mono">/ 100</span>
            </div>
          </div>
        </div>

        {/* Breakdown metrics */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
              <div className="flex items-center gap-1.5 text-petText-muted mb-0.5">
                <Scale size={12} />
                <span>Rule Score</span>
              </div>
              <span className="font-mono font-semibold text-petText-primary">{assessment.ruleScore}</span>
            </div>

            <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
              <div className="flex items-center gap-1.5 text-petText-muted mb-0.5">
                <Cpu size={12} className="text-brand-teal" />
                <span>ML Model</span>
              </div>
              <span className="font-mono font-semibold text-brand-teal">{assessment.mlScore}</span>
            </div>
          </div>

          {/* Gaps & Status */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1.5">
              {assessment.informationGapsCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-800/40">
                  <AlertCircle size={12} />
                  <span>{assessment.informationGapsCount} Information Gap{assessment.informationGapsCount > 1 ? 's' : ''}</span>
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium">All Records Verified</span>
              )}
            </div>
            <span
              className="text-[11px] font-mono text-petText-muted flex items-center gap-1"
              title={exactTimeTitle}
            >
              <Clock size={11} />
              {formattedTime}
            </span>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="p-4 pt-0">
        <Link
          to={`/assessments/${assessment.id}`}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
        >
          <span>Open Assessment Dossier</span>
          <ArrowRight size={13} className="text-petText-muted group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
};
