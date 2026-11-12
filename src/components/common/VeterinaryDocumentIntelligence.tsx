import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { Assessment, DocumentComparisonItem, UploadedDocumentRecord } from '../../types';
import { assessmentService } from '../../services/assessmentService';
import { formatExactLocalDateTime } from '../../utils/dateTime';

interface VeterinaryDocumentIntelligenceProps {
  assessment: Assessment;
  onAssessmentUpdated: (updated: Assessment) => void;
}

const ComparisonStatusBadge: React.FC<{ status: DocumentComparisonItem['status'] }> = ({ status }) => {
  switch (status) {
    case 'MATCH':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-700/40">
          <CheckCircle2 size={11} />
          Match
        </span>
      );
    case 'DISCREPANCY':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/70 text-rose-300 border border-rose-700/40">
          <AlertTriangle size={11} />
          Discrepancy
        </span>
      );
    case 'MISSING_IN_DECLARATION':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/70 text-amber-200 border border-amber-700/40">
          <AlertCircle size={11} />
          Missing in Declaration
        </span>
      );
    case 'MISSING_IN_DOCUMENT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-higher text-petText-muted border border-surface-border">
          Not in Document
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-higher text-petText-dim border border-surface-border">
          Not Present
        </span>
      );
  }
};

const DocumentVerificationBadge: React.FC<{ doc: UploadedDocumentRecord }> = ({ doc }) => {
  if (doc.verificationStatus === 'UNDERWRITER_VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-700/40">
        <CheckCircle2 size={11} />
        Underwriter Verified
      </span>
    );
  }
  if (doc.reviewStatus === 'ACCEPTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/70 text-sky-300 border border-sky-700/40">
        <Check size={11} />
        Corrections Accepted · Unverified
      </span>
    );
  }
  if (doc.reviewStatus === 'DISMISSED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-higher text-petText-muted border border-surface-border">
        Dismissed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-200 border border-amber-700/40">
      <AlertCircle size={11} />
      Extracted · Unverified
    </span>
  );
};

export const VeterinaryDocumentIntelligence: React.FC<VeterinaryDocumentIntelligenceProps> = ({
  assessment,
  onAssessmentUpdated
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [selectedFieldsByDoc, setSelectedFieldsByDoc] = useState<Record<string, string[]>>({});
  const [verifyByDoc, setVerifyByDoc] = useState<Record<string, boolean>>({});
  const [notesByDoc, setNotesByDoc] = useState<Record<string, string>>({});
  const [reviewError, setReviewError] = useState<string | null>(null);

  const uploadedDocs = assessment.uploadedDocuments || [];

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await assessmentService.uploadAssessmentDocument(assessment.id, file);
      if (res.assessment) {
        onAssessmentUpdated(res.assessment);
      }
      // Pre-select discrepancy & missing-in-declaration fields for underwriter review
      const defaultSelected = (res.document.comparisons || [])
        .filter(
          c =>
            c.extractedValue &&
            (c.status === 'DISCREPANCY' || c.status === 'MISSING_IN_DECLARATION')
        )
        .map(c => c.field);
      setSelectedFieldsByDoc(prev => ({ ...prev, [res.document.id]: defaultSelected }));
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload and analyze veterinary document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleFieldSelection = (doc: UploadedDocumentRecord, field: string) => {
    setSelectedFieldsByDoc(prev => {
      const current =
        prev[doc.id] ??
        (doc.comparisons || [])
          .filter(
            c =>
              c.extractedValue &&
              (c.status === 'DISCREPANCY' || c.status === 'MISSING_IN_DECLARATION')
          )
          .map(c => c.field);
      const exists = current.includes(field);
      return {
        ...prev,
        [doc.id]: exists ? current.filter(f => f !== field) : [...current, field]
      };
    });
  };

  const handleReview = async (
    doc: UploadedDocumentRecord,
    action: 'ACCEPT_CORRECTIONS' | 'DISMISS'
  ) => {
    setReviewingDocId(doc.id);
    setReviewError(null);
    try {
      const chosenFields =
        selectedFieldsByDoc[doc.id] ??
        (doc.comparisons || [])
          .filter(
            c =>
              c.extractedValue &&
              (c.status === 'DISCREPANCY' || c.status === 'MISSING_IN_DECLARATION')
          )
          .map(c => c.field);

      const res = await assessmentService.reviewAssessmentDocument(assessment.id, doc.id, {
        action,
        acceptedFields: action === 'ACCEPT_CORRECTIONS' ? chosenFields : [],
        reviewNotes: notesByDoc[doc.id] || undefined,
        verifyAccepted: Boolean(verifyByDoc[doc.id])
      });
      if (res.assessment) {
        onAssessmentUpdated(res.assessment);
      }
    } catch (err: any) {
      setReviewError(err?.message || 'Unable to save document review decision.');
    } finally {
      setReviewingDocId(null);
    }
  };

  return (
    <div className="pt-3 border-t border-surface-border space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white">
            Upload Veterinary Document (PDF or Image)
          </p>
          <p className="text-[11px] text-petText-muted mt-0.5">
            Automatically extracts medical findings, compares them against declared information, and flags discrepancies for underwriter review. Uploading does not alter the current risk score.
          </p>
        </div>

        <div className="shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.tif"
            className="hidden"
            onChange={e => handleFileSelected(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-teal/15 hover:bg-brand-teal/25 border border-brand-teal/40 text-xs font-semibold text-brand-teal transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Analyzing Document...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Upload PDF / Image</span>
              </>
            )}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {reviewError && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{reviewError}</span>
        </div>
      )}

      {uploadedDocs.length > 0 && (
        <div className="space-y-4">
          {uploadedDocs.map(doc => {
            const activeComparisons = (doc.comparisons || []).filter(
              c => c.status !== 'NOT_PRESENT'
            );
            const selectedFields =
              selectedFieldsByDoc[doc.id] ??
              activeComparisons
                .filter(
                  c =>
                    c.extractedValue &&
                    (c.status === 'DISCREPANCY' || c.status === 'MISSING_IN_DECLARATION')
                )
                .map(c => c.field);
            const isPending = doc.reviewStatus === 'PENDING_REVIEW';

            return (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-surface border border-surface-border space-y-4"
              >
                {/* Document Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-border">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={16} className="text-brand-teal shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{doc.fileName}</p>
                      <p className="text-[11px] text-petText-muted">
                        Uploaded by {doc.uploadedBy} · {formatExactLocalDateTime(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <DocumentVerificationBadge doc={doc} />
                </div>

                {/* Extraction Status / Empty Warning */}
                {doc.extractionMethod === 'NO_TEXT_EXTRACTED' ? (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-xs text-amber-200">
                    No readable text could be extracted from this file. Please upload a clearer veterinary report or image.
                  </div>
                ) : (
                  <>
                    {/* Summary Counts */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-950/50 text-emerald-300 border border-emerald-800/40">
                        Matches: {doc.summary?.matchesCount ?? 0}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-rose-950/50 text-rose-300 border border-rose-800/40">
                        Discrepancies: {doc.summary?.discrepanciesCount ?? 0}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-amber-950/50 text-amber-200 border border-amber-800/40">
                        Missing in Declaration: {doc.summary?.missingInDeclarationCount ?? 0}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-surface-elevated text-petText-muted border border-surface-border">
                        Not in Document: {doc.summary?.missingInDocumentCount ?? 0}
                      </span>
                    </div>

                    {/* Extracted Document Metadata (if present) */}
                    {(doc.extractedFields?.clinicName ||
                      doc.extractedFields?.veterinarian ||
                      doc.extractedFields?.documentDate) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-petText-secondary bg-surface-elevated px-3 py-2 rounded-lg border border-surface-border">
                        {doc.extractedFields.clinicName && (
                          <span>Clinic: <strong className="text-white">{doc.extractedFields.clinicName}</strong></span>
                        )}
                        {doc.extractedFields.veterinarian && (
                          <span>Veterinarian: <strong className="text-white">{doc.extractedFields.veterinarian}</strong></span>
                        )}
                        {doc.extractedFields.documentDate && (
                          <span>Record Date: <strong className="text-white">{doc.extractedFields.documentDate}</strong></span>
                        )}
                      </div>
                    )}

                    {/* Comparison Rows */}
                    {activeComparisons.length > 0 ? (
                      <div className="space-y-2">
                        {activeComparisons.map(item => {
                          const canSelect = isPending && Boolean(item.extractedValue);
                          const checked = selectedFields.includes(item.field);

                          return (
                            <div
                              key={item.field}
                              className="p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  {canSelect && (
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleFieldSelection(doc, item.field)}
                                      className="rounded border-surface-border bg-surface text-brand-teal focus:ring-brand-teal"
                                      title="Select extracted value to apply to declaration"
                                    />
                                  )}
                                  <span className="font-semibold text-white">{item.label}</span>
                                </div>
                                <ComparisonStatusBadge status={item.status} />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                <div className="p-2 rounded bg-surface border border-surface-border/70">
                                  <span className="text-[10px] uppercase tracking-wider text-petText-dim">
                                    Declared
                                  </span>
                                  <p className="text-petText-secondary mt-0.5">
                                    {item.declaredValue || 'Not declared'}
                                  </p>
                                </div>
                                <div className="p-2 rounded bg-surface border border-surface-border/70">
                                  <span className="text-[10px] uppercase tracking-wider text-brand-teal">
                                    Extracted from Document
                                  </span>
                                  <p className="text-white mt-0.5">
                                    {item.extractedValue || 'Not mentioned in document'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-petText-muted">
                        Text was extracted from the document, but no structured clinical fields matched the comparison schema.
                      </p>
                    )}

                    {/* Underwriter Review Controls */}
                    {isPending ? (
                      <div className="pt-3 border-t border-surface-border space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs text-petText-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(verifyByDoc[doc.id])}
                              onChange={e =>
                                setVerifyByDoc(prev => ({ ...prev, [doc.id]: e.target.checked }))
                              }
                              className="rounded border-surface-border bg-surface text-brand-teal focus:ring-brand-teal"
                            />
                            <span>Mark accepted findings as Underwriter Verified</span>
                          </label>
                        </div>

                        <input
                          type="text"
                          value={notesByDoc[doc.id] || ''}
                          onChange={e =>
                            setNotesByDoc(prev => ({ ...prev, [doc.id]: e.target.value }))
                          }
                          placeholder="Optional underwriter review note..."
                          className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-xs text-white placeholder-petText-dim focus:border-brand-teal focus:outline-none"
                        />

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={reviewingDocId === doc.id}
                            onClick={() => handleReview(doc, 'DISMISS')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-higher border border-surface-border text-xs font-medium text-petText-secondary transition-colors disabled:opacity-50"
                          >
                            <X size={13} />
                            <span>Dismiss</span>
                          </button>
                          <button
                            type="button"
                            disabled={reviewingDocId === doc.id || selectedFields.length === 0}
                            onClick={() => handleReview(doc, 'ACCEPT_CORRECTIONS')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-teal hover:bg-teal-400 text-background text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <Check size={13} />
                            <span>
                              {reviewingDocId === doc.id
                                ? 'Applying...'
                                : `Accept Selected Corrections (${selectedFields.length})`}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-surface-border text-[11px] text-petText-muted flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Reviewed by <strong className="text-white">{doc.reviewedBy || 'Underwriter'}</strong>
                          {doc.reviewedAt ? ` · ${formatExactLocalDateTime(doc.reviewedAt)}` : ''}
                        </span>
                        {doc.acceptedFields && doc.acceptedFields.length > 0 && (
                          <span className="text-brand-teal">
                            Applied fields: {doc.acceptedFields.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

