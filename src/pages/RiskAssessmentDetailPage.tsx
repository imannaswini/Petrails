import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { RiskScore } from '../components/common/RiskScore';
import { ExplainabilityPanel } from '../components/common/ExplainabilityPanel';
import { InformationGap } from '../components/common/InformationGap';
import { DecisionPanel } from '../components/common/DecisionPanel';
import { ArrowLeft, User, ExternalLink, ShieldCheck } from 'lucide-react';

export const RiskAssessmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { assessments, pets, openRequestInfoModal } = useApp();

  // Find assessment by id
  const assessment = assessments.find(a => a.id === id) || (assessments.length > 0 ? assessments[0] : null);
  const pet = assessment ? pets.find(p => p.id === assessment.petId) || (pets.length > 0 ? pets[0] : null) : null;

  if (!assessment) {
    return (
      <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Assessment Dossier Not Found</h2>
        <p className="text-xs text-petText-muted">The requested underwriting dossier is not in the database or has not loaded.</p>
        <Link
          to="/assessments"
          className="inline-block px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
        >
          Back to Assessments Registry
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-petText-muted">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Assessments Registry</span>
        </Link>
        <span className="font-mono text-petText-dim">Dossier ID: {assessment.id}</span>
      </div>

      {/* Hero Header for Assessment */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border shadow-cinematic flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-surface-borderLight bg-surface-higher">
            <img
              src={assessment.imageUrl}
              alt={assessment.petName}
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {assessment.petName.toUpperCase()}
              </h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-surface-elevated text-brand-teal border border-surface-border">
                Policy #{assessment.policyId}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-petText-secondary font-medium">
              {assessment.breed} · {assessment.ageText} · {assessment.sex}
            </p>
            <div className="flex items-center gap-3 text-xs text-petText-muted pt-1">
              <span className="flex items-center gap-1">
                <User size={12} />
                <span>Owner: {pet?.ownerName || 'Verified Policyholder'}</span>
              </span>
              <span>·</span>
              <span className="truncate max-w-[240px]">{pet?.registeredVetClinic || 'Registered Vet Hub'}</span>
            </div>
          </div>
        </div>

        {/* View Full Pet Dossier CTA */}
        {pet && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link
              to={`/pets/${pet.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
            >
              <span>View Complete Pet Dossier</span>
              <ExternalLink size={13} className="text-brand-teal" />
            </Link>
          </div>
        )}
      </div>

      {/* Prominent But Elegant Risk Summary Component */}
      <RiskScore
        combinedScore={assessment.combinedScore}
        ruleScore={assessment.ruleScore}
        mlScore={assessment.mlScore}
        riskLevel={assessment.riskLevel}
        confidence={assessment.modelConfidence}
        calibrationBand={assessment.calibrationBand}
      />

      {/* Explainability Section: "Why this assessment?" (SHAP horizontal bars) */}
      <ExplainabilityPanel
        factors={assessment.contributingFactors}
        baseValue={42}
        modelConfidence={assessment.modelConfidence}
        calibrationBand={assessment.calibrationBand}
      />

      {/* Dedicated Section: "Information Required" */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">Information Required</h3>
              {assessment.informationGapsCount > 0 ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                  {assessment.informationGapsCount} Actionable Clarification{assessment.informationGapsCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                  Zero Outstanding Gaps
                </span>
              )}
            </div>
            <p className="text-xs text-petText-secondary mt-0.5">
              Targeted clinical clarifications requested to eliminate actuarial ambiguity and calibrate coverage limits.
            </p>
          </div>
        </div>

        {assessment.informationGaps.length > 0 ? (
          <div className="space-y-4">
            {assessment.informationGaps.map(gap => (
              <InformationGap
                key={gap.id}
                gap={gap}
                petName={assessment.petName}
                assessmentId={assessment.id}
                onRequestClick={openRequestInfoModal}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-surface border border-surface-border text-center space-y-2">
            <ShieldCheck size={28} className="mx-auto text-emerald-400" />
            <p className="text-sm font-semibold text-white">All clinical documentation verified</p>
            <p className="text-xs text-petText-muted">
              Zero information gaps detected. The actuarial feature vector is fully saturated.
            </p>
          </div>
        )}
      </section>

      {/* Human Decision Panel (Preserving statutory human oversight) */}
      <DecisionPanel assessment={assessment} />
    </div>
  );
};
