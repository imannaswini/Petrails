import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Pet, Assessment, RiskLevel, Species } from '../types';
import { PET_IMAGES } from '../data/mockData';
import { Check, ArrowRight, ArrowLeft, Shield, Stethoscope, Scale } from 'lucide-react';

export const NewAssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNewAssessment } = useApp();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Animal Information
    name: '',
    species: 'Dog' as Species,
    breed: 'Golden Retriever',
    ageYears: '3',
    sex: 'Male',
    weightKg: '28',
    location: 'Indiranagar, Bengaluru, KA',
    ownerName: 'Rahul Verma',
    ownerPhone: '+91 98450 99887',
    registeredVetClinic: 'Cessna Lifeline Veterinary Hospital',

    // Step 2: Medical History
    vaccinations: 'DHPPi + L4 up to date, Nobivac Rabies current until Nov 2025',
    previousIllnesses: 'None reported in last 24 months',
    previousSurgeries: 'Elective neutering at 8 months, uneventful recovery',
    preExistingConditions: 'Mild seasonal atopic dermatitis (controlled with topicals)',
    currentMedications: 'None',
    vetHistoryVerified: true,

    // Step 3: Insurance Information
    coverageTier: 'Comprehensive' as 'Essential' | 'Comprehensive' | 'Elite Wellness',
    coverageLimitInr: '300000',
    deductibleInr: '4000',
    copayPercent: '10',
    previousInsurance: 'Yes (Digit General Insurance, 1 continuous year)',
    previousClaims: 'No prior claims declared'
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateScores = () => {
    // Actuarial synthetic scoring logic
    let rule = 35;
    let ml = 38;

    if (formData.species === 'Dog' && ['French Bulldog', 'English Bulldog', 'Pug'].includes(formData.breed)) {
      rule += 35;
      ml += 38;
    } else if (['Golden Retriever', 'German Shepherd'].includes(formData.breed)) {
      rule += 15;
      ml += 18;
    }

    const ageNum = parseInt(formData.ageYears) || 3;
    if (ageNum > 6) {
      rule += 15;
      ml += 14;
    }

    if (formData.preExistingConditions.toLowerCase().includes('atopic') || formData.preExistingConditions.toLowerCase().includes('joint')) {
      rule += 10;
      ml += 12;
    }

    const combined = Math.min(Math.round(rule * 0.4 + ml * 0.6), 95);
    const riskLevel: RiskLevel = combined > 70 ? 'HIGH' : combined > 40 ? 'MEDIUM' : 'LOW';

    return { ruleScore: rule, mlScore: ml, combinedScore: combined, riskLevel };
  };

  const handleRunAssessment = () => {
    setIsProcessing(true);

    setTimeout(async () => {
      const scores = calculateScores();
      const newPetId = `pet-${Date.now()}`;
      const newAsmId = `asm-${Date.now()}`;
      const policyId = `PT-${Math.floor(10000 + Math.random() * 90000)}`;

      const newPet: Pet = {
        id: newPetId,
        name: formData.name || 'Simba',
        species: formData.species,
        breed: formData.breed,
        age: parseInt(formData.ageYears) || 3,
        ageUnit: 'years',
        sex: formData.sex as 'Male' | 'Female',
        weightKg: parseFloat(formData.weightKg) || 28,
        imageUrl: formData.species === 'Dog' ? PET_IMAGES.max : PET_IMAGES.luna,
        policyId: policyId,
        policyStatus: 'Under Review',
        riskLevel: scores.riskLevel,
        riskScore: scores.combinedScore,
        location: formData.location,
        ownerName: formData.ownerName,
        ownerPhone: formData.ownerPhone,
        registeredVetClinic: formData.registeredVetClinic,
        medicalHistory: [
          {
            id: `med-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            event: 'Pre-Policy Actuarial Veterinary Verification',
            diagnosis: formData.preExistingConditions || 'Unremarkable medical profile',
            treatment: 'Baseline wellness assessment',
            outcome: 'Completed and verified',
            clinicName: formData.registeredVetClinic,
            veterinarian: 'Dr. A. K. Sundaram'
          }
        ],
        vaccinations: [
          {
            id: `vac-${Date.now()}`,
            vaccineName: formData.vaccinations,
            administeredDate: '2024-06-01',
            nextDueDate: '2025-06-01',
            batchNumber: 'VET-BATCH-102',
            status: 'Up to Date'
          }
        ],
        medications: [],
        surgeries: [],
        policies: [
          {
            id: `pol-${Date.now()}`,
            policyNumber: policyId,
            tier: formData.coverageTier,
            annualCoverageLimit: parseInt(formData.coverageLimitInr) || 300000,
            deductible: parseInt(formData.deductibleInr) || 4000,
            copayPercent: parseInt(formData.copayPercent) || 10,
            startDate: new Date().toISOString().split('T')[0],
            renewalDate: '2025-10-31',
            status: 'Under Review'
          }
        ],
        claims: []
      };

      const newAssessment: Assessment = {
        id: newAsmId,
        petId: newPetId,
        petName: formData.name || 'Simba',
        breed: formData.breed,
        species: formData.species,
        ageText: `${formData.ageYears} years`,
        sex: formData.sex,
        policyId: policyId,
        riskLevel: scores.riskLevel,
        combinedScore: scores.combinedScore,
        ruleScore: scores.ruleScore,
        mlScore: scores.mlScore,
        modelConfidence: 92,
        calibrationBand: 'Calibrated ±2.5%',
        informationGapsCount: 1,
        informationGaps: [
          {
            id: `gap-${Date.now()}`,
            title: 'Pre-existing Condition Clarification',
            description: 'Clarification required regarding duration and flare frequency of documented atopic dermatitis.',
            questions: [
              'What seasonal triggers induce cutaneous pruritus?',
              'Has systemic immunosuppressive therapy (e.g. Apoquel or Cytopoint) been administered in the past 12 months?'
            ],
            status: 'Pending Request',
            affectsCalibration: true
          }
        ],
        contributingFactors: [
          {
            id: 'nf-1',
            name: `Breed Actuarial Baseline (${formData.breed})`,
            impact: 12,
            category: 'Age & Breed',
            explanation: 'Historical portfolio incidence rate for selected canine breed profile.',
            confidence: 91
          },
          {
            id: 'nf-2',
            name: 'Age bracket evaluation',
            impact: 8,
            category: 'Age & Breed',
            explanation: 'Age risk curve factor under Guidewire actuarial tables.',
            confidence: 94
          },
          {
            id: 'nf-3',
            name: 'Vaccination record compliance',
            impact: -4,
            category: 'Vaccination',
            explanation: 'Documented core vaccine booster compliance reduces infectious claims hazard.',
            confidence: 96
          }
        ],
        status: 'Under Review',
        lastUpdated: 'Just now',
        underwriterDecision: {
          recommendation: scores.riskLevel,
          selectedDecision: null,
          underwriterNotes: 'Initial automated feature extraction completed. Awaiting underwriter review.'
        },
        decisionHistory: [
          {
            id: `dh-${Date.now()}`,
            action: 'Condition Added',
            user: 'Automated Actuarial Pipeline',
            role: 'Guidewire & PETRAILS Engine',
            timestamp: 'Just now',
            notes: 'Intake underwriting workflow ingested application data and extracted actuarial feature matrix.',
            ruleScoreAtTime: scores.ruleScore,
            mlScoreAtTime: scores.mlScore
          }
        ],
        imageUrl: newPet.imageUrl
      };

      try {
        await addNewAssessment(newAssessment, newPet);
        setIsProcessing(false);
        navigate(`/assessments/${newAsmId}`);
      } catch (err: any) {
        setIsProcessing(false);
        alert(err?.message || 'Failed to save assessment to server. Your entered data is preserved.');
      }
    }, 1200);
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
          Complete the multi-step intake to generate deterministic rule calculations and actuarial ML feature attributions.
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
                  min="0"
                  max="22"
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
                  step="0.1"
                  value={formData.weightKg}
                  onChange={e => handleChange('weightKg', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-petText-secondary font-medium mb-1">Location (City &amp; PIN) *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => handleChange('location', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-white text-xs focus:border-brand-teal"
                />
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
                Ready for Assessment
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Animal Box */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                <span className="text-[11px] font-mono text-petText-muted uppercase">Animal Profile</span>
                <p className="font-bold text-white text-sm">{formData.name || 'Simba'}</p>
                <p className="text-petText-secondary">{formData.breed} · {formData.sex}</p>
                <p className="text-petText-muted">{formData.ageYears} years · {formData.weightKg} kg</p>
                <p className="text-petText-dim">{formData.location}</p>
              </div>

              {/* Medical Box */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                <span className="text-[11px] font-mono text-petText-muted uppercase">Clinical Baseline</span>
                <p className="font-medium text-white">{formData.registeredVetClinic}</p>
                <p className="text-petText-secondary line-clamp-2">Conditions: {formData.preExistingConditions}</p>
                <p className="text-emerald-400 font-medium">Vaccines: Verified</p>
              </div>

              {/* Policy Box */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                <span className="text-[11px] font-mono text-petText-muted uppercase">Insurance Terms</span>
                <p className="font-bold text-white">{formData.coverageTier} Tier</p>
                <p className="font-mono text-petText-secondary">Limit: ₹{parseInt(formData.coverageLimitInr || '0').toLocaleString('en-IN')}</p>
                <p className="font-mono text-petText-muted">Deductible: ₹{formData.deductibleInr} ({formData.copayPercent}% copay)</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-higher/40 border border-surface-border text-xs text-petText-secondary space-y-1">
              <p className="font-semibold text-white">Execution Contract:</p>
              <p className="leading-relaxed">
                Clicking <strong>Run Assessment</strong> triggers the PETRAILS dual-engine pipeline. The deterministic rule engine evaluates Guidewire exclusion clauses, while the gradient-boosted ML engine attributes feature weights.
              </p>
            </div>
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
              onClick={() => setCurrentStep(prev => prev + 1)}
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
