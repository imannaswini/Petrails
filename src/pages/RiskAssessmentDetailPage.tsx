import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Assessment, Pet, ShapFactor, RuleAnalysis } from '../types';
import { InformationGap } from '../components/common/InformationGap';
import { DecisionPanel } from '../components/common/DecisionPanel';
import { EditAssessmentModal } from '../components/common/EditAssessmentModal';
import { DeleteAssessmentModal } from '../components/common/DeleteAssessmentModal';
import { VeterinaryDocumentIntelligence } from '../components/common/VeterinaryDocumentIntelligence';
import {
  ArrowLeft,
  User,
  ExternalLink,
  ShieldCheck,
  Clock,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Activity,
  Stethoscope,
  Syringe,
  Pill,
  Scissors,
  Receipt,
  ClipboardList,
  Phone,
  MapPin
} from 'lucide-react';
import {
  formatExactLocalDateTime,
  formatRelativeOrLocalTimestamp,
  useRelativeTimeTick
} from '../utils/dateTime';

type VerificationBadgeKind = 'VERIFIED' | 'UNVERIFIED' | 'MISSING';

const VerificationBadge: React.FC<{ status: VerificationBadgeKind }> = ({ status }) => {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-700/40">
        <CheckCircle2 size={11} />
        Verified
      </span>
    );
  }
  if (status === 'UNVERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-200 border border-amber-700/40">
        <AlertCircle size={11} />
        Provided · Unverified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-higher text-petText-muted border border-surface-border">
      Missing
    </span>
  );
};

interface PlainRiskReason {
  title: string;
  detail: string;
  direction: 'elevated' | 'favorable' | 'neutral';
}

function buildPlainLanguageFactors(
  assessment: Assessment
): PlainRiskReason[] {
  const reasons: PlainRiskReason[] = [];
  const seenKeys = new Set<string>();

  const factors: ShapFactor[] = assessment.contributingFactors || [];
  for (const factor of factors) {
    const idOrName = `${factor.id || ''} ${factor.name || ''}`.toLowerCase();
    const direction: PlainRiskReason['direction'] =
      factor.impact > 0.5 ? 'elevated' : factor.impact < -0.5 ? 'favorable' : 'neutral';

    if (idOrName.includes('breed')) {
      seenKeys.add('breed');
      reasons.push({
        title: `Breed-related risk profile (${assessment.breed})`,
        detail:
          direction === 'elevated'
            ? `Actuarial claims history indicates higher health risk considerations for ${assessment.breed}.`
            : direction === 'favorable'
            ? `${assessment.breed} is associated with a favorable baseline health profile.`
            : `Standard breed risk profile observed for ${assessment.breed}.`,
        direction
      });
    } else if (idOrName.includes('age')) {
      seenKeys.add('age');
      reasons.push({
        title: `Age-related risk factor (${assessment.ageText})`,
        detail:
          direction === 'elevated'
            ? `Life-stage age (${assessment.ageText}) increases expected veterinary care frequency.`
            : direction === 'favorable'
            ? `Younger life-stage (${assessment.ageText}) supports a lower baseline claim likelihood.`
            : `Age profile (${assessment.ageText}) is within standard underwriting expectations.`,
        direction
      });
    } else if (idOrName.includes('med') || factor.category === 'Medical History') {
      seenKeys.add('medical');
      reasons.push({
        title: 'Existing medical history',
        detail:
          direction === 'elevated'
            ? 'Declared or verified clinical events contribute to elevated underwriting risk.'
            : 'No significant prior clinical events were identified in verified records.',
        direction
      });
    } else if (idOrName.includes('vacc') || factor.category === 'Vaccination') {
      seenKeys.add('vaccination');
      reasons.push({
        title: 'Preventive vaccination status',
        detail:
          direction === 'favorable'
            ? 'Up-to-date preventive vaccinations help lower preventable illness risk.'
            : direction === 'elevated'
            ? 'Incomplete or unverified vaccination records increase preventable health risk.'
            : 'Vaccination status is noted as part of preventive care review.',
        direction
      });
    } else if (idOrName.includes('weight')) {
      seenKeys.add('weight');
      reasons.push({
        title: 'Body weight profile',
        detail:
          direction === 'elevated'
            ? 'Recorded body weight indicates higher orthopedic or metabolic care considerations.'
            : 'Recorded body weight is within a favorable range.',
        direction
      });
    } else if (idOrName.includes('species')) {
      seenKeys.add('species');
      reasons.push({
        title: `Species baseline (${assessment.species})`,
        detail: `Reflects standard veterinary utilization patterns for ${assessment.species.toLowerCase()} policies.`,
        direction
      });
    } else if (idOrName.includes('claim') || factor.category === 'Claims History') {
      seenKeys.add('claims');
      reasons.push({
        title: 'Previous claim history',
        detail:
          direction === 'elevated'
            ? 'Prior insurance claims indicate recurring veterinary utilization.'
            : 'No adverse prior claim patterns recorded.',
        direction
      });
    } else if (factor.name) {
      reasons.push({
        title: factor.name.replace(/\([^)]*\)/g, '').trim() || 'Underwriting factor',
        detail:
          direction === 'elevated'
            ? 'Identified as an upward risk consideration during underwriting review.'
            : direction === 'favorable'
            ? 'Identified as a favorable risk consideration during underwriting review.'
            : 'Included in the overall underwriting review.',
        direction
      });
    }
  }

  // Supplement from ruleAnalysis only if not already covered, without exposing internal rule codes or points
  const rules: RuleAnalysis[] = assessment.ruleAnalysis || [];
  for (const rule of rules) {
    const reasonLower = (rule.reason || '').toLowerCase();
    if (reasonLower.includes('age') || reasonLower.includes('senior') || reasonLower.includes('adult')) {
      if (seenKeys.has('age')) continue;
      seenKeys.add('age');
    } else if (reasonLower.includes('breed')) {
      if (seenKeys.has('breed')) continue;
      seenKeys.add('breed');
    } else if (reasonLower.includes('medical') || reasonLower.includes('clinical')) {
      if (seenKeys.has('medical')) continue;
      seenKeys.add('medical');
    }
    if (rule.reason) {
      reasons.push({
        title: rule.reason,
        detail: 'Identified from submitted pet and clinical underwriting information.',
        direction: rule.impact > 0 ? 'elevated' : rule.impact < 0 ? 'favorable' : 'neutral'
      });
    }
  }

  return reasons;
}

function getRiskLabel(level: Assessment['riskLevel']): string {
  if (level === 'HIGH') return 'High Risk';
  if (level === 'MEDIUM') return 'Medium Risk';
  return 'Low Risk';
}

function getRiskColors(level: Assessment['riskLevel']) {
  if (level === 'HIGH') {
    return {
      text: 'text-rose-300',
      badge: 'bg-rose-950/70 text-rose-300 border-rose-700/50',
      ring: 'border-rose-500/40 bg-rose-950/20',
      bar: 'bg-rose-400'
    };
  }
  if (level === 'MEDIUM') {
    return {
      text: 'text-amber-300',
      badge: 'bg-amber-950/70 text-amber-200 border-amber-700/50',
      ring: 'border-amber-500/40 bg-amber-950/20',
      bar: 'bg-amber-400'
    };
  }
  return {
    text: 'text-emerald-300',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50',
    ring: 'border-emerald-500/40 bg-emerald-950/20',
    bar: 'bg-emerald-400'
  };
}

function hasText(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  return s.length > 0 && s.toLowerCase() !== 'not provided' && s.toLowerCase() !== 'unknown';
}

export const RiskAssessmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { assessments, pets, openRequestInfoModal } = useApp();
  const [directAssessment, setDirectAssessment] = React.useState<Assessment | null>(null);
  const [directPet, setDirectPet] = React.useState<Pet | null>(null);
  const [isLoadingDirect, setIsLoadingDirect] = React.useState<boolean>(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isArchived, setIsArchived] = React.useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = React.useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState<boolean>(false);
  const nowMs = useRelativeTimeTick(30000);

  const foundAssessment = assessments.find(a => a.id === id);
  const assessment = isArchived ? null : (directAssessment || foundAssessment);
  const pet = assessment ? (pets.find(p => p.id === assessment.petId) || directPet) : null;

  React.useEffect(() => {
    setDirectAssessment(null);
    setDirectPet(null);
    setIsArchived(false);
    if (!foundAssessment && id) {
      setIsLoadingDirect(true);
      setFetchError(null);
      import('../services/assessmentService').then(({ assessmentService }) => {
        assessmentService.getAssessmentById(id)
          .then(asm => {
            setDirectAssessment(asm);
            if (asm && asm.petId) {
              import('../services/petService').then(({ petService }) => {
                petService.getPetById(asm.petId).then(setDirectPet).catch(() => {});
              });
            }
          })
          .catch(err => {
            if (err?.status === 410 || String(err?.message || '').toLowerCase().includes('archived')) {
              setIsArchived(true);
            }
            setFetchError(err?.message || 'Unable to load assessment dossier.');
          })
          .finally(() => setIsLoadingDirect(false));
      });
    }
  }, [id, foundAssessment]);

  if (isLoadingDirect && !assessment) {
    return (
      <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-base font-semibold text-white">Loading Insurance Risk Assessment Report...</h2>
        <p className="text-xs text-petText-muted">Retrieving assessment record from database.</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="pt-28 pb-16 max-w-4xl mx-auto px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">
          {isArchived
            ? 'Assessment Archived'
            : fetchError
            ? 'Assessment Access Unavailable'
            : 'Assessment Dossier Not Found'}
        </h2>
        <p className="text-xs text-petText-muted">
          {isArchived
            ? `Assessment '${id}' has been archived and is no longer active in the underwriting registry. Linked pet, owner, and audit records remain preserved.`
            : fetchError || `The requested underwriting dossier '${id}' is not in the database or could not be loaded.`}
        </p>
        <Link
          to="/assessments"
          className="inline-block px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
        >
          Back to Assessments Registry
        </Link>
      </div>
    );
  }

  const createdLabel = formatExactLocalDateTime(assessment.createdAt);
  const updatedRelative = formatRelativeOrLocalTimestamp(
    assessment.updatedAt || assessment.createdAt || assessment.lastUpdated,
    nowMs
  );
  const updatedExact = formatExactLocalDateTime(
    assessment.updatedAt || assessment.createdAt || assessment.lastUpdated
  );

  // Risk score integrity evaluation
  const isScoreUnavailable =
    assessment.inferenceMode === 'UNAVAILABLE' ||
    typeof assessment.combinedScore !== 'number' ||
    Number.isNaN(assessment.combinedScore);
  const isProvisional =
    !isScoreUnavailable &&
    (assessment.inferenceMode === 'FALLBACK' || assessment.modelAvailable === false);
  const riskColors = getRiskColors(assessment.riskLevel);
  const clampedScore = isScoreUnavailable
    ? 0
    : Math.max(0, Math.min(100, Math.round(assessment.combinedScore)));

  // Plain-language risk factors
  const plainFactors = buildPlainLanguageFactors(assessment);

  // Medical verification summary
  const medicalRecords = pet?.medicalHistory || [];
  const vaccinationRecords = pet?.vaccinations || [];
  const surgeryRecords = pet?.surgeries || [];
  const medicationRecords = pet?.medications || [];
  const claimRecords = pet?.claims || [];
  const supportingDocs = [
    ...medicalRecords.filter(r => hasText(r.evidenceReference)).map(r => ({
      id: r.id,
      label: `${r.event || r.diagnosis || 'Medical Record'}`,
      ref: r.evidenceReference as string,
      verified: r.informationStatus === 'VERIFIED'
    })),
    ...vaccinationRecords.filter(v => hasText(v.evidenceReference)).map(v => ({
      id: v.id,
      label: `${v.vaccineName || 'Vaccination'} Certificate`,
      ref: v.evidenceReference as string,
      verified: v.informationStatus === 'VERIFIED'
    }))
  ];

  const hasVerifiedMedical =
    medicalRecords.some(m => m.informationStatus === 'VERIFIED') ||
    vaccinationRecords.some(v => v.informationStatus === 'VERIFIED');

  const unresolvedGapsCount =
    assessment.informationGapsCount ||
    (assessment.informationGaps || []).filter(g => g.status !== 'Resolved').length;

  // Recommended Action (derived strictly from outstanding info & verification state)
  let recommendedTitle = 'Ready for underwriting decision';
  let recommendedDescription =
    'Submitted clinical and policy records are available for final underwriting review.';
  let recommendedTone: 'amber' | 'emerald' | 'sky' = 'emerald';

  if (unresolvedGapsCount > 0) {
    recommendedTitle = 'Additional medical information required';
    recommendedDescription = `${unresolvedGapsCount} outstanding information ${
      unresolvedGapsCount === 1 ? 'request needs' : 'requests need'
    } clarification before finalizing coverage terms.`;
    recommendedTone = 'amber';
  } else if (isScoreUnavailable || isProvisional || !hasVerifiedMedical) {
    recommendedTitle = 'Veterinary documentation needs review';
    recommendedDescription =
      'Intake declarations are on file, but verified veterinary records are not yet confirmed. Request or review supporting documentation before binding coverage.';
    recommendedTone = 'sky';
  }

  // Activity History timeline
  const activityEvents: Array<{
    id: string;
    title: string;
    actor: string;
    timestamp: string;
    notes?: string;
    kind: 'decision' | 'info' | 'lifecycle';
  }> = [];

  for (const entry of assessment.decisionHistory || []) {
    activityEvents.push({
      id: entry.id,
      title: entry.action,
      actor: entry.role ? `${entry.user} (${entry.role})` : entry.user,
      timestamp: entry.timestamp,
      notes: entry.notes,
      kind: 'decision'
    });
  }

  for (const gap of assessment.informationGaps || []) {
    if (gap.requestedAt) {
      activityEvents.push({
        id: `gap-${gap.id}`,
        title: `Information Requested: ${gap.title}`,
        actor: 'Underwriting Team',
        timestamp: gap.requestedAt,
        notes: gap.responseSummary || gap.description,
        kind: 'info'
      });
    }
  }

  if (assessment.createdAt) {
    activityEvents.push({
      id: `created-${assessment.id}`,
      title: 'Assessment Created',
      actor: 'PETRAILS Underwriting',
      timestamp: assessment.createdAt,
      notes: `Initial underwriting dossier opened for ${assessment.petName}.`,
      kind: 'lifecycle'
    });
  }

  activityEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const ownerDisplay = pet?.ownerName;

  return (
    <div className="pt-24 pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Top Navigation & Timestamps */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-petText-muted">
        <Link
          to="/assessments"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Assessments Registry</span>
        </Link>
        <div className="flex items-center gap-3 font-mono text-petText-dim">
          <span className="inline-flex items-center gap-1" title={updatedExact}>
            <Clock size={11} />
            Updated {updatedRelative}
          </span>
          {assessment.createdAt && (
            <>
              <span>·</span>
              <span>Created {createdLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* A. Pet Profile */}
      <section className="p-6 sm:p-7 rounded-2xl bg-surface border border-surface-border shadow-cinematic flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-surface-borderLight bg-surface-higher">
            <img
              src={assessment.imageUrl || pet?.imageUrl}
              alt={assessment.petName}
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {assessment.petName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-petText-secondary border border-surface-border">
                {assessment.status}
              </span>
            </div>

            <p className="text-sm text-petText-secondary font-medium">
              {assessment.species} · {assessment.breed} · {assessment.ageText} · {assessment.sex}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-petText-muted pt-0.5">
              <span className="font-mono text-brand-teal">
                Policy ID: {assessment.policyId}
              </span>
              <span className="font-mono text-petText-dim">
                Assessment ID: {assessment.id}
              </span>
            </div>

            {(ownerDisplay || pet?.ownerPhone || pet?.location) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-petText-muted pt-1">
                {ownerDisplay && (
                  <span className="inline-flex items-center gap-1.5 text-petText-secondary">
                    <User size={12} className="text-brand-teal" />
                    Owner: {ownerDisplay}
                  </span>
                )}
                {pet?.ownerPhone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={11} />
                    {pet.ownerPhone}
                  </span>
                )}
                {pet?.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} />
                    {pet.location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
          >
            <Pencil size={13} className="text-brand-teal" />
            <span>Edit Assessment</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-400 transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete Assessment</span>
          </button>
          {pet && (
            <Link
              to={`/pets/${pet.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-white transition-colors"
            >
              <span>View Complete Pet Dossier</span>
              <ExternalLink size={13} className="text-brand-teal" />
            </Link>
          )}
        </div>
      </section>

      {/* B. Overall Insurance Risk Score (Primary Visual Focus) */}
      <section className="p-7 sm:p-8 rounded-2xl bg-gradient-to-br from-surface via-surface to-surface-elevated border border-surface-border shadow-cinematic">
        {isScoreUnavailable ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-higher text-petText-secondary border border-surface-border">
                <AlertCircle size={13} className="text-amber-400" />
                Risk Assessment Unavailable
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Unable to Generate Verified Risk Score
              </h2>
              <p className="text-sm text-petText-secondary leading-relaxed">
                A complete insurance risk score could not be determined from the currently available records.
                Please review the medical information below and request any missing veterinary documentation.
              </p>
            </div>
            <div className="px-6 py-5 rounded-2xl bg-surface-elevated border border-surface-border text-center shrink-0">
              <span className="text-3xl font-bold font-mono text-petText-dim">— / 100</span>
              <p className="text-xs text-petText-muted mt-1">Score Pending</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-teal">
                  {isProvisional ? 'Provisional Risk Assessment' : 'Overall Insurance Risk Score'}
                </span>
                <span className={`px-3 py-0.5 rounded-full text-xs font-semibold border ${riskColors.badge}`}>
                  {getRiskLabel(assessment.riskLevel)}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {isProvisional
                  ? 'Provisional Underwriting Risk Rating'
                  : `${getRiskLabel(assessment.riskLevel)} Underwriting Profile`}
              </h2>

              <p className="text-sm text-petText-secondary leading-relaxed">
                {isProvisional
                  ? 'This is a provisional assessment based on initial intake details. Verified veterinary records are required before finalizing a permanent risk rating.'
                  : 'Reflects the pet’s overall underwriting risk based on verified profile, clinical history, and policy factors.'}
              </p>

              {/* Simple Risk Scale Bar */}
              <div className="pt-2 space-y-1.5 max-w-md">
                <div className="h-2.5 w-full rounded-full bg-surface-higher overflow-hidden border border-surface-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${riskColors.bar}`}
                    style={{ width: `${clampedScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-petText-dim font-mono">
                  <span>0 (Lowest Risk)</span>
                  <span>50</span>
                  <span>100 (Highest Risk)</span>
                </div>
              </div>
            </div>

            <div className={`px-8 py-6 rounded-2xl border text-center shrink-0 ${riskColors.ring}`}>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-5xl sm:text-6xl font-extrabold font-mono tracking-tight ${riskColors.text}`}>
                  {clampedScore}
                </span>
                <span className="text-lg font-mono text-petText-muted">/100</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-petText-secondary mt-2">
                {getRiskLabel(assessment.riskLevel)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* C. Why Was This Risk Identified? & E. Recommended Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* C. Why Was This Risk Identified? */}
        <section className="lg:col-span-2 p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Why Was This Risk Identified?</h3>
            <p className="text-xs text-petText-muted mt-0.5">
              Key underwriting factors influencing this pet’s assessment.
            </p>
          </div>

          {plainFactors.length > 0 ? (
            <div className="space-y-3">
              {plainFactors.map((reason, idx) => (
                <div
                  key={`${reason.title}-${idx}`}
                  className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-start gap-3"
                >
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      reason.direction === 'elevated'
                        ? 'bg-amber-400'
                        : reason.direction === 'favorable'
                        ? 'bg-emerald-400'
                        : 'bg-brand-teal'
                    }`}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{reason.title}</p>
                    <p className="text-xs text-petText-secondary leading-relaxed">{reason.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-surface-elevated border border-surface-border text-xs text-petText-muted">
              No specific risk factors were returned for this assessment.
            </div>
          )}
        </section>

        {/* E. Recommended Action */}
        <section className="p-6 rounded-2xl bg-surface border border-surface-border flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={17} className="text-brand-teal" />
              <h3 className="text-base font-bold text-white">Recommended Action</h3>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 ${
                recommendedTone === 'amber'
                  ? 'bg-amber-950/30 border-amber-700/40'
                  : recommendedTone === 'sky'
                  ? 'bg-sky-950/30 border-sky-700/40'
                  : 'bg-emerald-950/30 border-emerald-700/40'
              }`}
            >
              <p className="text-sm font-bold text-white">{recommendedTitle}</p>
              <p className="text-xs text-petText-secondary leading-relaxed">
                {recommendedDescription}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-surface-border flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between text-petText-muted">
              <span>Outstanding Requests</span>
              <span className="font-mono font-semibold text-white">{unresolvedGapsCount}</span>
            </div>
            <div className="flex items-center justify-between text-petText-muted">
              <span>Veterinary Verification</span>
              <span className="font-semibold text-white">
                {hasVerifiedMedical ? 'Confirmed' : 'Pending Verification'}
              </span>
            </div>
            {unresolvedGapsCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  openRequestInfoModal(
                    assessment.id,
                    assessment.petName,
                    'Follow-up Medical Information Request'
                  )
                }
                className="mt-2 w-full py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-semibold text-brand-teal transition-colors"
              >
                Send Information Request
              </button>
            )}
          </div>
        </section>
      </div>

      {/* D. Medical Information */}
      <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-base font-bold text-white">Medical Information</h3>
            <p className="text-xs text-petText-muted mt-0.5">
              Clinical declarations, veterinary records, and verification status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status="VERIFIED" />
            <VerificationBadge status="UNVERIFIED" />
            <VerificationBadge status="MISSING" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Medical History */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Stethoscope size={14} className="text-brand-teal" />
                Medical History
              </span>
              <VerificationBadge
                status={
                  medicalRecords.some(m => m.informationStatus === 'VERIFIED')
                    ? 'VERIFIED'
                    : medicalRecords.length > 0 || hasText(assessment.underwritingData?.previousIllnesses)
                    ? 'UNVERIFIED'
                    : 'MISSING'
                }
              />
            </div>
            {medicalRecords.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {medicalRecords.map(rec => (
                  <li key={rec.id} className="p-2.5 rounded-lg bg-surface border border-surface-border/70 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{rec.event || rec.diagnosis}</span>
                      <span className="font-mono text-[11px] text-petText-dim">{rec.date}</span>
                    </div>
                    <p className="text-petText-secondary">
                      {rec.diagnosis ? `${rec.diagnosis} · ` : ''}{rec.treatment || rec.outcome}
                    </p>
                    {rec.clinicName && (
                      <p className="text-[11px] text-petText-muted">
                        {rec.clinicName}{rec.veterinarian ? ` · ${rec.veterinarian}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-petText-secondary">
                {hasText(assessment.underwritingData?.previousIllnesses)
                  ? String(assessment.underwritingData?.previousIllnesses)
                  : 'No medical history records provided.'}
              </p>
            )}
          </div>

          {/* 2. Pre-existing Conditions */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <AlertCircle size={14} className="text-amber-400" />
                Pre-existing Conditions
              </span>
              <VerificationBadge
                status={
                  hasText(assessment.underwritingData?.preExistingConditions)
                    ? hasVerifiedMedical
                      ? 'VERIFIED'
                      : 'UNVERIFIED'
                    : 'MISSING'
                }
              />
            </div>
            <p className="text-xs text-petText-secondary leading-relaxed">
              {hasText(assessment.underwritingData?.preExistingConditions)
                ? String(assessment.underwritingData?.preExistingConditions)
                : 'No pre-existing conditions declared.'}
            </p>
            {hasText(assessment.underwritingData?.allergies) && (
              <p className="text-xs text-petText-muted">
                Allergies: <span className="text-petText-secondary">{String(assessment.underwritingData?.allergies)}</span>
              </p>
            )}
          </div>

          {/* 3. Previous Surgeries */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Scissors size={14} className="text-brand-teal" />
                Previous Surgeries
              </span>
              <VerificationBadge
                status={
                  surgeryRecords.length > 0 || hasText(assessment.underwritingData?.previousSurgeries)
                    ? hasVerifiedMedical
                      ? 'VERIFIED'
                      : 'UNVERIFIED'
                    : 'MISSING'
                }
              />
            </div>
            {surgeryRecords.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {surgeryRecords.map(s => (
                  <li key={s.id} className="p-2.5 rounded-lg bg-surface border border-surface-border/70">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-white">{s.surgeryName}</span>
                      <span className="font-mono text-[11px] text-petText-dim">{s.date}</span>
                    </div>
                    <p className="text-petText-secondary mt-0.5">{s.hospital} · {s.postOpRecovery}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-petText-secondary">
                {hasText(assessment.underwritingData?.previousSurgeries)
                  ? String(assessment.underwritingData?.previousSurgeries)
                  : 'No previous surgeries declared.'}
              </p>
            )}
          </div>

          {/* 4. Current Medications */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Pill size={14} className="text-brand-teal" />
                Current Medications
              </span>
              <VerificationBadge
                status={
                  medicationRecords.length > 0 || hasText(assessment.underwritingData?.currentMedications)
                    ? hasVerifiedMedical
                      ? 'VERIFIED'
                      : 'UNVERIFIED'
                    : 'MISSING'
                }
              />
            </div>
            {medicationRecords.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {medicationRecords.map(m => (
                  <li key={m.id} className="p-2.5 rounded-lg bg-surface border border-surface-border/70">
                    <span className="font-semibold text-white">{m.name}</span>
                    <p className="text-petText-secondary mt-0.5">
                      {m.dosage} · {m.frequency} ({m.prescribedFor})
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-petText-secondary">
                {hasText(assessment.underwritingData?.currentMedications)
                  ? String(assessment.underwritingData?.currentMedications)
                  : 'No current medications declared.'}
              </p>
            )}
          </div>

          {/* 5. Vaccination Declarations */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Syringe size={14} className="text-brand-teal" />
                Vaccination Declarations
              </span>
              <VerificationBadge
                status={
                  vaccinationRecords.some(v => v.informationStatus === 'VERIFIED')
                    ? 'VERIFIED'
                    : vaccinationRecords.length > 0 || hasText(assessment.underwritingData?.vaccinationDeclaration)
                    ? 'UNVERIFIED'
                    : 'MISSING'
                }
              />
            </div>
            {vaccinationRecords.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {vaccinationRecords.map(v => (
                  <li key={v.id} className="p-2.5 rounded-lg bg-surface border border-surface-border/70 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-white">{v.vaccineName}</span>
                      <p className="text-[11px] text-petText-muted">
                        Administered: {v.administeredDate} · Next due: {v.nextDueDate}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-petText-secondary">{v.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-petText-secondary">
                {hasText(assessment.underwritingData?.vaccinationDeclaration)
                  ? String(assessment.underwritingData?.vaccinationDeclaration)
                  : 'No vaccination declaration provided.'}
              </p>
            )}
          </div>

          {/* 6. Previous Claims */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                <Receipt size={14} className="text-brand-teal" />
                Previous Claims
              </span>
              <VerificationBadge
                status={
                  claimRecords.length > 0
                    ? 'VERIFIED'
                    : hasText(assessment.underwritingData?.previousClaims)
                    ? 'UNVERIFIED'
                    : 'MISSING'
                }
              />
            </div>
            {claimRecords.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {claimRecords.map(c => (
                  <li key={c.id} className="p-2.5 rounded-lg bg-surface border border-surface-border/70 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-white">{c.claimNumber} · {c.treatment}</span>
                      <p className="text-[11px] text-petText-muted">{c.date} · {c.status}</p>
                    </div>
                    <span className="font-mono text-white">₹{c.amountInr.toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-petText-secondary">
                {hasText(assessment.underwritingData?.previousClaims)
                  ? String(assessment.underwritingData?.previousClaims)
                  : 'No previous claims declared.'}
              </p>
            )}
          </div>
        </div>

        {/* 7. Supporting Documents & Veterinary Document Intelligence */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
              <FileText size={14} className="text-brand-teal" />
              Supporting Documents
            </span>
            <VerificationBadge
              status={
                supportingDocs.some(d => d.verified) ||
                (assessment.uploadedDocuments || []).some(d => d.verificationStatus === 'UNDERWRITER_VERIFIED')
                  ? 'VERIFIED'
                  : supportingDocs.length > 0 || (assessment.uploadedDocuments || []).length > 0
                  ? 'UNVERIFIED'
                  : 'MISSING'
              }
            />
          </div>
          {supportingDocs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {supportingDocs.map(doc => (
                <div
                  key={doc.id}
                  className="p-2.5 rounded-lg bg-surface border border-surface-border/70 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{doc.label}</p>
                    <p className="text-[11px] text-petText-muted truncate">{doc.ref}</p>
                  </div>
                  <VerificationBadge status={doc.verified ? 'VERIFIED' : 'UNVERIFIED'} />
                </div>
              ))}
            </div>
          ) : (assessment.uploadedDocuments || []).length === 0 ? (
            <p className="text-xs text-petText-muted">
              No supporting veterinary documents attached on file.
            </p>
          ) : null}

          <VeterinaryDocumentIntelligence
            assessment={assessment}
            onAssessmentUpdated={(updated) => setDirectAssessment(updated)}
          />
        </div>

        {/* Outstanding Information Requests (if any) */}
        {assessment.informationGaps.length > 0 && (
          <div className="pt-2 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-petText-muted">
              Outstanding Information Requests
            </h4>
            <div className="space-y-3">
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
          </div>
        )}
      </section>

      {/* F. Underwriting Decision */}
      <DecisionPanel assessment={assessment} />

      {/* G. Activity History */}
      <section className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
          <Activity size={16} className="text-brand-teal" />
          <h3 className="text-base font-bold text-white">Activity History</h3>
        </div>

        {activityEvents.length > 0 ? (
          <div className="space-y-3">
            {activityEvents.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-surface-elevated border border-surface-border text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.title}</span>
                    <span className="text-petText-dim">·</span>
                    <span className="text-petText-secondary">{item.actor}</span>
                  </div>
                  <span
                    className="font-mono text-petText-muted text-[11px]"
                    title={formatExactLocalDateTime(item.timestamp)}
                  >
                    {formatRelativeOrLocalTimestamp(item.timestamp, nowMs)}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-petText-secondary leading-relaxed pl-2.5 border-l-2 border-brand-teal/50">
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border text-xs text-petText-muted flex items-center gap-2">
            <ShieldCheck size={15} className="text-brand-teal" />
            <span>No activity events recorded yet.</span>
          </div>
        )}
      </section>

      <EditAssessmentModal
        assessmentId={isEditOpen ? assessment.id : null}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(updated) => {
          setDirectAssessment(updated);
          setIsEditOpen(false);
        }}
      />

      <DeleteAssessmentModal
        assessment={isDeleteOpen ? assessment : null}
        onClose={() => setIsDeleteOpen(false)}
        onDeleted={() => {
          setIsDeleteOpen(false);
          setIsArchived(true);
        }}
      />
    </div>
  );
};
