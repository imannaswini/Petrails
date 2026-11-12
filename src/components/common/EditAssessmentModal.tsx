import React, { useEffect, useState } from 'react';
import {
  X,
  Save,
  AlertTriangle,
  Shield,
  Stethoscope,
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import {
  Assessment,
  Pet,
  Species,
  UpdateAssessmentPayload,
  MedicalRecord,
  VaccinationRecord,
  MedicationRecord,
  SurgeryRecord,
  ClaimSummary
} from '../../types';
import { assessmentService } from '../../services/assessmentService';
import { petService } from '../../services/petService';
import { useApp } from '../../context/AppContext';

interface EditAssessmentModalProps {
  assessmentId: string | null;
  onClose: () => void;
  onSuccess?: (updated: Assessment) => void;
}

type EditTab = 'pet' | 'medical' | 'insurance';

interface EditFormState {
  // Pet information
  petName: string;
  species: Species;
  breed: string;
  ageYears: string;
  sex: string;
  weightKg: string;
  // Medical information
  preExistingConditions: string;
  previousIllnesses: string;
  previousSurgeries: string;
  currentMedications: string;
  vaccinationDeclaration: string;
  previousClaims: string;
  medicalHistory: MedicalRecord[];
  vaccinations: VaccinationRecord[];
  medications: MedicationRecord[];
  surgeries: SurgeryRecord[];
  claims: ClaimSummary[];
  // Insurance information
  coverageTier: string;
  coverageLimitInr: string;
  deductibleInr: string;
  copayPercent: string;
  previousInsurance: string;
  // Governance
  editReason: string;
  reopenForReassessment: boolean;
}

function buildInitialState(asm: Assessment, pet: Pet | null): EditFormState {
  const ud = (asm.underwritingData || {}) as Record<string, any>;
  const linkedPolicy =
    pet?.policies?.find(p => p.policyNumber === asm.policyId) || pet?.policies?.[0];

  const numericAge =
    asm.ageYears ??
    pet?.age ??
    (parseFloat((asm.ageText || '').replace(/[^0-9.]/g, '')) || 2);

  return {
    petName: asm.petName || pet?.name || '',
    species: (asm.species || pet?.species || 'Dog') as Species,
    breed: asm.breed || pet?.breed || '',
    ageYears: String(numericAge),
    sex: asm.sex || pet?.sex || 'Male',
    weightKg: String(asm.weightKg ?? pet?.weightKg ?? 15),

    preExistingConditions: String(ud.preExistingConditions || ''),
    previousIllnesses: String(ud.previousIllnesses || ''),
    previousSurgeries: String(ud.previousSurgeries || ''),
    currentMedications: String(ud.currentMedications || ''),
    vaccinationDeclaration: String(ud.vaccinationDeclaration || ''),
    previousClaims: String(ud.previousClaims || ''),
    medicalHistory: pet?.medicalHistory ? [...pet.medicalHistory] : [],
    vaccinations: pet?.vaccinations ? [...pet.vaccinations] : [],
    medications: pet?.medications ? [...pet.medications] : [],
    surgeries: pet?.surgeries ? [...pet.surgeries] : [],
    claims: pet?.claims ? [...pet.claims] : [],

    coverageTier: String(ud.coverageTier || linkedPolicy?.tier || 'Comprehensive'),
    coverageLimitInr: String(ud.coverageLimitInr ?? linkedPolicy?.annualCoverageLimit ?? 300000),
    deductibleInr: String(ud.deductibleInr ?? linkedPolicy?.deductible ?? 4000),
    copayPercent: String(ud.copayPercent ?? linkedPolicy?.copayPercent ?? 10),
    previousInsurance: String(ud.previousInsurance || ''),

    editReason: '',
    reopenForReassessment: false
  };
}

export const EditAssessmentModal: React.FC<EditAssessmentModalProps> = ({
  assessmentId,
  onClose,
  onSuccess
}) => {
  const { updateAssessment } = useApp();
  const [activeTab, setActiveTab] = useState<EditTab>('pet');
  const [loadedAssessment, setLoadedAssessment] = useState<Assessment | null>(null);
  const [formState, setFormState] = useState<EditFormState | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (!assessmentId) {
      setLoadedAssessment(null);
      setFormState(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowDiscardConfirm(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowDiscardConfirm(false);
    setActiveTab('pet');

    assessmentService
      .getAssessmentById(assessmentId)
      .then(async asm => {
        if (cancelled) return;
        let linkedPet: Pet | null = null;
        if (asm.petId) {
          linkedPet = await petService.getPetById(asm.petId).catch(() => null);
        }
        if (cancelled) return;
        setLoadedAssessment(asm);
        const init = buildInitialState(asm, linkedPet);
        setFormState(init);
        setInitialSnapshot(JSON.stringify(init));
      })
      .catch((err: any) => {
        if (!cancelled) {
          setErrorMessage(err?.message || 'Failed to load assessment dossier for editing.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  if (!assessmentId) return null;

  const isDirty = formState ? JSON.stringify(formState) !== initialSnapshot : false;
  const isFinalized =
    loadedAssessment?.status === 'Approved' || loadedAssessment?.status === 'Rejected';

  const handleField = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
    setErrorMessage(null);
    setFormState(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleRequestClose = () => {
    if (isSaving) return;
    if (isDirty && !successMessage) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const validate = (): string | null => {
    if (!formState) return 'Form not initialized.';
    if (!formState.petName.trim()) return 'Pet name is required.';
    if (!formState.breed.trim()) return 'Breed is required.';
    const age = parseFloat(formState.ageYears);
    if (Number.isNaN(age) || age < 0.1 || age > 25) {
      return 'Age must be between 0.1 and 25 years.';
    }
    const weight = parseFloat(formState.weightKg);
    if (Number.isNaN(weight) || weight <= 0 || weight > 150) {
      return 'Weight must be greater than 0 kg and at most 150 kg.';
    }
    const limit = parseFloat(formState.coverageLimitInr);
    const deductible = parseFloat(formState.deductibleInr);
    const copay = parseFloat(formState.copayPercent);
    if (Number.isNaN(limit) || limit <= 0) return 'Coverage limit must be greater than 0.';
    if (Number.isNaN(deductible) || deductible < 0) return 'Deductible cannot be negative.';
    if (deductible > limit) return 'Deductible cannot exceed coverage limit.';
    if (Number.isNaN(copay) || copay < 0 || copay > 100) {
      return 'Co-payment percentage must be between 0 and 100.';
    }
    if (isFinalized && !formState.reopenForReassessment) {
      return 'Finalized decisions require confirming reassessment reopening before saving changes.';
    }
    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState || !loadedAssessment) return;

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: UpdateAssessmentPayload = {
        petName: formState.petName.trim(),
        species: formState.species,
        breed: formState.breed.trim(),
        ageYears: parseFloat(formState.ageYears),
        sex: formState.sex,
        weightKg: parseFloat(formState.weightKg),
        preExistingConditions: formState.preExistingConditions,
        previousIllnesses: formState.previousIllnesses,
        previousSurgeries: formState.previousSurgeries,
        currentMedications: formState.currentMedications,
        vaccinationDeclaration: formState.vaccinationDeclaration,
        previousClaims: formState.previousClaims,
        medicalHistory: formState.medicalHistory,
        vaccinations: formState.vaccinations,
        medications: formState.medications,
        surgeries: formState.surgeries,
        claims: formState.claims,
        coverageTier: formState.coverageTier,
        coverageLimitInr: parseFloat(formState.coverageLimitInr),
        deductibleInr: parseFloat(formState.deductibleInr),
        copayPercent: parseFloat(formState.copayPercent),
        previousInsurance: formState.previousInsurance,
        editReason: formState.editReason.trim() || undefined,
        reopenForReassessment: formState.reopenForReassessment
      };

      const updated = await updateAssessment(loadedAssessment.id, payload);
      setLoadedAssessment(updated);
      setInitialSnapshot(JSON.stringify(formState));
      setSuccessMessage(
        `Saved & reassessed: Combined Score ${updated.combinedScore} (${updated.riskLevel}).`
      );
      onSuccess?.(updated);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-surface-border shadow-cinematic overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-surface-border bg-surface-elevated flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-brand-teal">
              Underwriting Reassessment Editor
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Edit Assessment</span>
              <span className="font-mono text-xs text-petText-muted">({assessmentId})</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg hover:bg-surface-higher text-petText-muted hover:text-white transition-colors"
            aria-label="Close edit modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Unsaved Changes Prompt */}
        {showDiscardConfirm && (
          <div className="px-6 py-3 bg-amber-950/70 border-b border-amber-800/60 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span>You have unsaved changes. Discard changes without saving?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1 rounded bg-surface-elevated hover:bg-surface-higher text-white font-medium"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                Discard Changes
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 size={24} className="animate-spin text-brand-teal mx-auto" />
            <p className="text-xs text-petText-secondary">Loading assessment &amp; linked pet dossier...</p>
          </div>
        ) : !formState ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-rose-300">{errorMessage || 'Assessment could not be loaded.'}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-elevated text-xs text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
            {/* Finalized Decision Notice */}
            {isFinalized && (
              <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-950/50 border border-amber-800/60 text-xs space-y-2">
                <div className="flex items-start gap-2 text-amber-200">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Finalized Decision ({loadedAssessment?.status})
                    </p>
                    <p className="text-amber-300/80 text-[11px]">
                      Editing clinical or policy inputs will recalculate Rule, ML, and SHAP scores and move this dossier back to Under Review.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-amber-100 font-medium cursor-pointer pl-6">
                  <input
                    type="checkbox"
                    checked={formState.reopenForReassessment}
                    onChange={e => handleField('reopenForReassessment', e.target.checked)}
                    className="rounded border-amber-700 bg-surface-elevated text-brand-teal focus:ring-brand-teal"
                  />
                  <span>Confirm reopening this finalized assessment for backend reassessment</span>
                </label>
              </div>
            )}

            {/* Tabs */}
            <div className="px-6 pt-4 border-b border-surface-border flex items-center gap-2">
              {[
                { id: 'pet' as const, label: 'Pet Information', icon: Shield },
                { id: 'medical' as const, label: 'Medical Information', icon: Stethoscope },
                { id: 'insurance' as const, label: 'Insurance Information', icon: Scale }
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
                      active
                        ? 'border-brand-teal text-brand-teal'
                        : 'border-transparent text-petText-muted hover:text-white'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Tab Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {activeTab === 'pet' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Pet Name *</label>
                    <input
                      type="text"
                      value={formState.petName}
                      onChange={e => handleField('petName', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Species *</label>
                    <select
                      value={formState.species}
                      onChange={e => handleField('species', e.target.value as Species)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                    >
                      <option value="Dog">Canine (Dog)</option>
                      <option value="Cat">Feline (Cat)</option>
                      <option value="Other">Other Companion Animal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Breed *</label>
                    <input
                      type="text"
                      value={formState.breed}
                      onChange={e => handleField('breed', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Age (Years) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="25"
                      value={formState.ageYears}
                      onChange={e => handleField('ageYears', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Sex *</label>
                    <select
                      value={formState.sex}
                      onChange={e => handleField('sex', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Weight (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="150"
                      value={formState.weightKg}
                      onChange={e => handleField('weightKg', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>
                </div>
              )}

              {activeTab === 'medical' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">Pre-existing Conditions</label>
                      <input
                        type="text"
                        value={formState.preExistingConditions}
                        onChange={e => handleField('preExistingConditions', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">Vaccination Declaration</label>
                      <input
                        type="text"
                        value={formState.vaccinationDeclaration}
                        onChange={e => handleField('vaccinationDeclaration', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">Previous Illnesses</label>
                      <input
                        type="text"
                        value={formState.previousIllnesses}
                        onChange={e => handleField('previousIllnesses', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">Previous Surgeries Summary</label>
                      <input
                        type="text"
                        value={formState.previousSurgeries}
                        onChange={e => handleField('previousSurgeries', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">Current Medications Summary</label>
                      <input
                        type="text"
                        value={formState.currentMedications}
                        onChange={e => handleField('currentMedications', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      />
                    </div>
                    <div>
                      <label className="block text-petText-secondary font-medium mb-1">Previous Claims Declaration</label>
                      <input
                        type="text"
                        value={formState.previousClaims}
                        onChange={e => handleField('previousClaims', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      />
                    </div>
                  </div>

                  {/* Medical History Events */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-surface-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        Medical History Events ({formState.medicalHistory.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleField('medicalHistory', [
                            ...formState.medicalHistory,
                            {
                              id: `med-${Date.now()}`,
                              date: todayIso,
                              event: 'Clinical Episode',
                              diagnosis: '',
                              treatment: '',
                              outcome: 'Managed',
                              clinicName: 'Registered Clinic',
                              veterinarian: 'Attending Vet'
                            }
                          ])
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-higher hover:bg-surface border border-surface-border text-brand-teal font-medium"
                      >
                        <Plus size={12} />
                        <span>Add Event</span>
                      </button>
                    </div>
                    {formState.medicalHistory.map((item, idx) => (
                      <div key={item.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Event"
                          value={item.event}
                          onChange={e => {
                            const next = [...formState.medicalHistory];
                            next[idx] = { ...item, event: e.target.value };
                            handleField('medicalHistory', next);
                          }}
                          className="sm:col-span-4 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                        />
                        <input
                          type="text"
                          placeholder="Diagnosis"
                          value={item.diagnosis}
                          onChange={e => {
                            const next = [...formState.medicalHistory];
                            next[idx] = { ...item, diagnosis: e.target.value };
                            handleField('medicalHistory', next);
                          }}
                          className="sm:col-span-4 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                        />
                        <input
                          type="text"
                          placeholder="Outcome"
                          value={item.outcome}
                          onChange={e => {
                            const next = [...formState.medicalHistory];
                            next[idx] = { ...item, outcome: e.target.value };
                            handleField('medicalHistory', next);
                          }}
                          className="sm:col-span-3 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleField(
                              'medicalHistory',
                              formState.medicalHistory.filter((_, i) => i !== idx)
                            )
                          }
                          className="sm:col-span-1 p-1.5 text-rose-400 hover:text-rose-300 justify-self-end"
                          aria-label="Remove medical event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Surgeries & Medications & Vaccinations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-surface-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          Surgeries ({formState.surgeries.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleField('surgeries', [
                              ...formState.surgeries,
                              {
                                id: `surg-${Date.now()}`,
                                surgeryName: '',
                                date: todayIso,
                                hospital: 'Veterinary Hospital',
                                surgeon: 'Attending Surgeon',
                                complications: 'None',
                                postOpRecovery: 'Complete recovery'
                              }
                            ])
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-higher text-brand-teal"
                        >
                          <Plus size={11} />
                          <span>Add</span>
                        </button>
                      </div>
                      {formState.surgeries.map((s, idx) => (
                        <div key={s.id || idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Surgery name"
                            value={s.surgeryName}
                            onChange={e => {
                              const next = [...formState.surgeries];
                              next[idx] = { ...s, surgeryName: e.target.value };
                              handleField('surgeries', next);
                            }}
                            className="flex-1 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleField('surgeries', formState.surgeries.filter((_, i) => i !== idx))
                            }
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-surface-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          Medications ({formState.medications.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleField('medications', [
                              ...formState.medications,
                              {
                                id: `rx-${Date.now()}`,
                                name: '',
                                dosage: 'Standard',
                                frequency: 'Daily',
                                startDate: todayIso,
                                prescribedFor: 'Maintenance'
                              }
                            ])
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-higher text-brand-teal"
                        >
                          <Plus size={11} />
                          <span>Add</span>
                        </button>
                      </div>
                      {formState.medications.map((m, idx) => (
                        <div key={m.id || idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Medication name"
                            value={m.name}
                            onChange={e => {
                              const next = [...formState.medications];
                              next[idx] = { ...m, name: e.target.value };
                              handleField('medications', next);
                            }}
                            className="flex-1 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleField('medications', formState.medications.filter((_, i) => i !== idx))
                            }
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vaccination Records */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-surface-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        Vaccination Records ({formState.vaccinations.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleField('vaccinations', [
                            ...formState.vaccinations,
                            {
                              id: `vac-${Date.now()}`,
                              vaccineName: 'Core Vaccine',
                              administeredDate: todayIso,
                              nextDueDate: todayIso,
                              batchNumber: 'VET-BATCH',
                              status: 'Up to Date'
                            }
                          ])
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-higher text-brand-teal"
                      >
                        <Plus size={12} />
                        <span>Add Vaccine</span>
                      </button>
                    </div>
                    {formState.vaccinations.map((v, idx) => (
                      <div key={v.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={v.vaccineName}
                          onChange={e => {
                            const next = [...formState.vaccinations];
                            next[idx] = { ...v, vaccineName: e.target.value };
                            handleField('vaccinations', next);
                          }}
                          className="sm:col-span-7 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                        />
                        <select
                          value={v.status}
                          onChange={e => {
                            const next = [...formState.vaccinations];
                            next[idx] = {
                              ...v,
                              status: e.target.value as VaccinationRecord['status']
                            };
                            handleField('vaccinations', next);
                          }}
                          className="sm:col-span-4 px-2.5 py-1.5 rounded bg-surface border border-surface-border text-white"
                        >
                          <option value="Up to Date">Up to Date</option>
                          <option value="Due Soon">Due Soon</option>
                          <option value="Overdue">Overdue</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            handleField('vaccinations', formState.vaccinations.filter((_, i) => i !== idx))
                          }
                          className="sm:col-span-1 p-1.5 text-rose-400 hover:text-rose-300 justify-self-end"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'insurance' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Coverage Tier *</label>
                    <select
                      value={formState.coverageTier}
                      onChange={e => handleField('coverageTier', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                    >
                      <option value="Essential">Essential</option>
                      <option value="Comprehensive">Comprehensive</option>
                      <option value="Elite Wellness">Elite Wellness</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Annual Coverage Limit (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      value={formState.coverageLimitInr}
                      onChange={e => handleField('coverageLimitInr', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Annual Deductible (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      value={formState.deductibleInr}
                      onChange={e => handleField('deductibleInr', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-petText-secondary font-medium mb-1">Co-payment Percentage (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formState.copayPercent}
                      onChange={e => handleField('copayPercent', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-petText-secondary font-medium mb-1">Previous Insurance History</label>
                    <input
                      type="text"
                      value={formState.previousInsurance}
                      onChange={e => handleField('previousInsurance', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                    />
                  </div>
                </div>
              )}

              {/* Audit Reason */}
              <div className="pt-2 border-t border-surface-border/60">
                <label className="block text-petText-secondary font-medium mb-1">
                  Audit Reason / Underwriting Note (Optional)
                </label>
                <input
                  type="text"
                  value={formState.editReason}
                  onChange={e => handleField('editReason', e.target.value)}
                  placeholder="e.g. Updated veterinary age verification and allergy history"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white focus:border-brand-teal"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-surface-border bg-surface-elevated flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-petText-muted">
                Backend Rule, ML &amp; SHAP scores recalculate automatically on save.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-surface-higher hover:bg-surface border border-surface-border text-xs font-semibold text-petText-secondary hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (isFinalized && !formState.reopenForReassessment)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Reassessing &amp; Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save &amp; Reassess</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

