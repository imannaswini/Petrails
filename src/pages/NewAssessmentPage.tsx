import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Pet, CreateAssessmentPayload, Species } from '../types';
import { PET_IMAGES } from '../data/mockData';
import { Check, ArrowRight, ArrowLeft, Shield, Stethoscope, Scale, AlertCircle } from 'lucide-react';

export const NewAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNewAssessment } = useApp();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Animal Information
    name: '',
    species: 'Dog' as Species,
    breed: '',
    ageYears: '',
    sex: 'Male',
    weightKg: '',
    location: '',
    ownerName: '',
    ownerPhone: '',
    registeredVetClinic: '',

    // Step 2: Medical History
    vaccinations: '',
    previousIllnesses: '',
    previousSurgeries: '',
    preExistingConditions: '',
    allergies: '',
    currentMedications: '',

    // Step 3: Insurance Information
    coverageTier: 'Comprehensive' as 'Essential' | 'Comprehensive' | 'Elite Wellness',
    coverageLimitInr: '300000',
    deductibleInr: '4000',
    copayPercent: '10',
    previousInsurance: '',
    previousClaims: ''
  });

  const handleChange = (field: string, value: any) => {
    setValidationError(null);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateAssessmentInput = (): string | null => {
    if (!formData.name.trim()) {
      return 'Pet name is required before running an underwriting assessment.';
    }
    if (!formData.breed.trim()) return 'Pet breed is required.';
    const parsedAge = parseFloat(formData.ageYears);
    if (Number.isNaN(parsedAge) || parsedAge < 0.1 || parsedAge > 25) {
      return 'Pet age must be between 0.1 and 25 years.';
    }
    const parsedWeight = parseFloat(formData.weightKg);
    if (Number.isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 150) {
      return 'Pet weight must be between 0.1 and 150 kg.';
    }
    if (!formData.ownerName.trim()) {
      return 'Policyholder owner name is required.';
    }
    const limit = Number(formData.coverageLimitInr), deductible = Number(formData.deductibleInr), copay = Number(formData.copayPercent);
    if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(deductible) || deductible < 0 || deductible > limit) return 'Enter a valid coverage limit and deductible.';
    if (!Number.isFinite(copay) || copay < 0 || copay > 100) return 'Co-payment must be between 0 and 100 percent.';
    return null;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      const err = validateAssessmentInput();
      if (err) {
        setValidationError(err);
        return;
      }
    }
    setValidationError(null);
    setCurrentStep(prev => prev + 1);
  };

  const handleRunAssessment = async () => {
    const err = validateAssessmentInput();
    if (err) {
      setValidationError(err);
      return;
    }

    setValidationError(null);
    setIsProcessing(true);

    try {
      const petNameClean = formData.name.trim();
      const newPetId = `pet-${Date.now()}`;
      const policyId = `PT-${Math.floor(10000 + Math.random() * 90000)}`;
      const parsedAge = Number(formData.ageYears);

      const newPet: Pet = {
        id: newPetId,
        name: petNameClean,
        species: formData.species,
        breed: formData.breed,
        age: parsedAge,
        ageUnit: 'years',
        sex: formData.sex as 'Male' | 'Female',
        weightKg: Number(formData.weightKg),
        imageUrl: formData.species === 'Dog' ? PET_IMAGES.max : PET_IMAGES.luna,
        policyId: policyId,
        policyStatus: 'Under Review',
        riskLevel: 'MEDIUM',
        riskScore: 50,
        location: formData.location,
        ownerName: formData.ownerName.trim(),
        ownerPhone: formData.ownerPhone,
        registeredVetClinic: formData.registeredVetClinic,
        medicalHistory: [],
        vaccinations: [],
        medications: [],
        surgeries: [],
        policies: [
          {
            id: `pol-${Date.now()}`,
            policyNumber: policyId,
            tier: formData.coverageTier,
            annualCoverageLimit: Number(formData.coverageLimitInr),
            deductible: Number(formData.deductibleInr),
            copayPercent: Number(formData.copayPercent),
            startDate: '',
            renewalDate: '',
            status: 'Under Review'
          }
        ],
        claims: [],
        declaredMedicalInformation: {
          vaccinationDeclaration: formData.vaccinations,
          previousIllnesses: formData.previousIllnesses,
          previousSurgeries: formData.previousSurgeries,
          preExistingConditions: formData.preExistingConditions,
          allergies: formData.allergies,
          currentMedications: formData.currentMedications
        }
      };

      // Send intake data only; the backend owns scoring, classification, metadata, and timestamps.
      const newAssessment: CreateAssessmentPayload = {
        petId: newPetId,
        petName: petNameClean,
        breed: formData.breed,
        species: formData.species,
        ageText: `${parsedAge} years`,
        ageYears: parsedAge,
        weightKg: Number(formData.weightKg),
        sex: formData.sex,
        policyId: policyId,
        informationGapsCount: 0,
        informationGaps: [],
        status: 'Under Review',
        underwriterDecision: {
          recommendation: 'Under Review',
          selectedDecision: null,
          underwriterNotes: 'Awaiting underwriter review.'
        },
        imageUrl: newPet.imageUrl,
        underwritingData: {
          location: formData.location,
          ownerName: formData.ownerName.trim(),
          ownerPhone: formData.ownerPhone,
          registeredVetClinic: formData.registeredVetClinic,
          vaccinationDeclaration: formData.vaccinations,
          previousIllnesses: formData.previousIllnesses,
          previousSurgeries: formData.previousSurgeries,
          preExistingConditions: formData.preExistingConditions,
          allergies: formData.allergies,
          currentMedications: formData.currentMedications,
          coverageTier: formData.coverageTier,
          coverageLimitInr: Number(formData.coverageLimitInr),
          deductibleInr: Number(formData.deductibleInr),
          copayPercent: Number(formData.copayPercent),
          previousInsurance: formData.previousInsurance,
          previousClaims: formData.previousClaims,
          medicalInformationStatus: [formData.vaccinations, formData.previousIllnesses, formData.previousSurgeries, formData.preExistingConditions, formData.allergies, formData.currentMedications].some(value => value.trim()) ? 'DECLARED' : 'NOT_PROVIDED'
        }
      };

      const savedAssessment = await addNewAssessment(newAssessment, newPet);
      setIsProcessing(false);
      navigate(`/assessments/${savedAssessment.id}`);
    } catch (err: any) {
      setIsProcessing(false);
      setValidationError(err?.message || 'Failed to save assessment to server. Your entered data is preserved.');
    }
  };

  const steps = [
    { num: 1, title: 'Animal Information', desc: 'Species, breed & physical metrics' },
    { num: 2, title: 'Medical History', desc: 'Vaccinations & veterinary background' },
    { num: 3, title: 'Insurance Information', desc: 'Coverage tier, limits & deductibles' },
    { num: 4, title: 'Actuarial Review', desc: 'Audit data before running assessment' }
  ];

  return (
    <div className="pt-24 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="pb-4 border-b border-surface-border">
        <span className="font-mono text-xs uppercase tracking-widest text-brand-teal">
          Underwriting Initiation Workflow
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
          New Risk Assessment
        </h1>
        <p className="text-xs sm:text-sm text-petText-secondary mt-1">
          Submit pet, declared medical, and policy information for backend rule scoring and eligible model inference.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map(step => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;

          return (
            <div
              key={step.num}
              onClick={() => step.num < currentStep && setCurrentStep(step.num)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isCurrent
                  ? 'bg-surface-elevated border-brand-teal ring-1 ring-brand-teal/40'
                  : isDone
                  ? 'bg-surface border-surface-borderLight cursor-pointer'
                  : 'bg-surface/50 border-surface-border opacity-60'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                    isDone
                      ? 'bg-brand-teal text-background'
                      : isCurrent
                      ? 'bg-brand-teal/20 text-brand-teal border border-brand-teal'
                      : 'bg-surface-higher text-petText-muted'
                  }`}
                >
                  {isDone ? <Check size={12} /> : step.num}
                </span>
                <span className="text-xs font-semibold text-white">{step.title}</span>
              </div>
              <p className="text-[10px] text-petText-muted line-clamp-1">{step.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Step Form Box */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-surface-border space-y-6 shadow-cinematic">
        {/* Step 1: Animal Information */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Shield size={16} className="text-brand-teal" />
              <span>Step 1: Animal Profile &amp; Demographics</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-petText-secondary font-medium mb-1">Pet Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="e.g. Simba, Oscar, Rosie"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                  required
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Species *</label>
                <select
                  value={formData.species}
                  onChange={e => handleChange('species', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
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
                  value={formData.breed}
                  onChange={e => handleChange('breed', e.target.value)}
                  placeholder="e.g. Golden Retriever, Persian Cat"
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Age (Years) *</label>
                <input
                  type="number"
                  min="0.1"
                  max="25"
                  step="0.1"
                  value={formData.ageYears}
                  onChange={e => handleChange('ageYears', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Sex *</label>
                <select
                  value={formData.sex}
                  onChange={e => handleChange('sex', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Weight (kg) *</label>
                <input
                  type="number"
                  min="0.1"
                  max="150"
                  step="0.1"
                  value={formData.weightKg}
                  onChange={e => handleChange('weightKg', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-petText-secondary font-medium mb-1">Location (City &amp; PIN) (optional)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => handleChange('location', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-petText-secondary font-medium mb-1">Owner Name *</label>
                <input type="text" value={formData.ownerName} onChange={e => handleChange('ownerName', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal" />
              </div>
              <div>
                <label className="block text-petText-secondary font-medium mb-1">Owner Contact (optional)</label>
                <input type="tel" value={formData.ownerPhone} onChange={e => handleChange('ownerPhone', e.target.value)} placeholder="Phone number" className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Medical History */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Stethoscope size={16} className="text-brand-teal" />
              <span>Step 2: Medical &amp; Clinical History</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-petText-secondary font-medium mb-1">Vaccinations &amp; Core Boosters</label>
                <input
                  type="text"
                  value={formData.vaccinations}
                  onChange={e => handleChange('vaccinations', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Previous Illnesses</label>
                <input
                  type="text"
                  value={formData.previousIllnesses}
                  onChange={e => handleChange('previousIllnesses', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Previous Surgeries &amp; Procedures</label>
                <input
                  type="text"
                  value={formData.previousSurgeries}
                  onChange={e => handleChange('previousSurgeries', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Pre-existing Conditions &amp; Chronic Allergies</label>
                <input
                  type="text"
                  value={formData.preExistingConditions}
                  onChange={e => handleChange('preExistingConditions', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Current Active Medications</label>
                <input
                  type="text"
                  value={formData.currentMedications}
                  onChange={e => handleChange('currentMedications', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>
              <div>
                <label className="block text-petText-secondary font-medium mb-1">Allergies</label>
                <input type="text" value={formData.allergies} onChange={e => handleChange('allergies', e.target.value)} placeholder="Declared allergies, or leave blank if unknown" className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal" />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Primary Registered Veterinary Hospital</label>
                <input
                  type="text"
                  value={formData.registeredVetClinic}
                  onChange={e => handleChange('registeredVetClinic', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Insurance Information */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Scale size={16} className="text-brand-teal" />
              <span>Step 3: Policy Structure &amp; Limits</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-petText-secondary font-medium mb-1">Coverage Tier *</label>
                <select
                  value={formData.coverageTier}
                  onChange={e => handleChange('coverageTier', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                >
                  <option value="Essential">Essential (Accident &amp; Urgent Surgery)</option>
                  <option value="Comprehensive">Comprehensive (Illness, Surgery &amp; Diagnostics)</option>
                  <option value="Elite Wellness">Elite Wellness (Holistic + Geriatric Care)</option>
                </select>
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Annual Coverage Limit (₹) *</label>
                <input
                  type="number"
                  value={formData.coverageLimitInr}
                  onChange={e => handleChange('coverageLimitInr', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Annual Deductible (₹) *</label>
                <input
                  type="number"
                  value={formData.deductibleInr}
                  onChange={e => handleChange('deductibleInr', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Standard Copay Percentage (%) *</label>
                <input
                  type="number"
                  value={formData.copayPercent}
                  onChange={e => handleChange('copayPercent', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Previous Insurance History</label>
                <input
                  type="text"
                  value={formData.previousInsurance}
                  onChange={e => handleChange('previousInsurance', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div>
                <label className="block text-petText-secondary font-medium mb-1">Historical Claims Declaration</label>
                <input
                  type="text"
                  value={formData.previousClaims}
                  onChange={e => handleChange('previousClaims', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Actuarial Review */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Step 4: Actuarial Pre-Flight Audit
                </h3>
                <p className="text-xs text-petText-secondary mt-0.5">
                  Verify animal dossier and parameters before computing risk synthesis scores.
                </p>
              </div>
              <span className="text-xs font-mono text-brand-teal bg-teal-950/60 px-2.5 py-1 rounded border border-teal-800/40">
                Ready to submit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Animal Box */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                <span className="text-[11px] font-mono text-petText-muted uppercase">Animal Profile</span>
                <p className="font-bold text-white text-sm">{formData.name.trim() || 'Unnamed Pet'}</p>
                <p className="text-petText-secondary">{formData.breed} · {formData.sex}</p>
                <p className="text-petText-muted">{formData.ageYears} years · {formData.weightKg} kg</p>
                <p className="text-petText-dim">{formData.location}</p>
              </div>

              {/* Medical Box */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                <span className="text-[11px] font-mono text-petText-muted uppercase">Clinical Baseline</span>
                <p className="font-medium text-white">{formData.registeredVetClinic}</p>
                <p className="text-petText-secondary line-clamp-2">Conditions: {formData.preExistingConditions}</p>
                <p className="text-petText-muted">Vaccination declaration: {formData.vaccinations || 'Not provided'}</p>
              </div>

              {/* Policy Box */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                <span className="text-[11px] font-mono text-petText-muted uppercase">Insurance Terms</span>
                <p className="font-bold text-white">{formData.coverageTier} Tier</p>
                <p className="font-mono text-petText-secondary">Limit: ₹{parseInt(formData.coverageLimitInr || '0').toLocaleString('en-IN')}</p>
                <p className="font-mono text-petText-muted">Deductible: ₹{formData.deductibleInr} ({formData.copayPercent}% copay)</p>
              </div>
            </div>
          </div>
        )}

        {validationError && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-rose-400" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="pt-4 border-t border-surface-border flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-higher text-petText-secondary hover:text-white text-xs font-semibold transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Previous Step</span>
            </button>
          ) : <div />}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-white text-xs font-semibold transition-colors"
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunAssessment}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing Actuarial Features...</span>
                </>
              ) : (
                <>
                  <Shield size={15} />
                  {/* Prompt requirement: Primary CTA: "Run Assessment" — Do not label this button "Ask AI" */}
                  <span>Run Assessment</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
