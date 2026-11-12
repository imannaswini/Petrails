import { apiClient } from './apiClient';
import {
  Assessment,
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
  DecisionHistoryEntry,
  UploadedDocumentRecord
} from '../types';

export interface DecisionPayload {
  decision: 'Approve' | 'Request Information' | 'Refer for Review';
  notes: string;
  stipulation?: string;
}

export interface InformationRequestPayload {
  gapTitle?: string;
  recipient: 'clinic' | 'owner' | 'both';
  urgency: string;
  questions: string[];
}

export const assessmentService = {
  async getAssessments(): Promise<Assessment[]> {
    return apiClient.get<Assessment[]>('/assessments');
  },

  async getAssessmentById(id: string): Promise<Assessment> {
    return apiClient.get<Assessment>(`/assessments/${id}`);
  },

  async createAssessment(assessment: CreateAssessmentPayload): Promise<Assessment> {
    return apiClient.post<Assessment>('/assessments', assessment);
  },

  async updateAssessment(id: string, payload: UpdateAssessmentPayload): Promise<Assessment> {
    return apiClient.put<Assessment>(`/assessments/${id}`, payload);
  },

  async deleteAssessment(
    id: string
  ): Promise<{ success: boolean; id: string; status: string; archivedAt: string }> {
    return apiClient.delete<{ success: boolean; id: string; status: string; archivedAt: string }>(
      `/assessments/${id}`
    );
  },

  async recordDecision(
    assessmentId: string,
    payload: DecisionPayload
  ): Promise<{ success: boolean; decision: DecisionHistoryEntry; assessment?: Assessment }> {
    return apiClient.post<{ success: boolean; decision: DecisionHistoryEntry; assessment?: Assessment }>(
      `/assessments/${assessmentId}/decision`,
      payload
    );
  },

  async requestInformation(
    assessmentId: string,
    payload: InformationRequestPayload
  ): Promise<{ success: boolean; message: string; dispatchedAt?: string; assessment?: Assessment }> {
    return apiClient.post<{ success: boolean; message: string; dispatchedAt?: string; assessment?: Assessment }>(
      `/assessments/${assessmentId}/information-request`,
      payload
    );
  },

  async uploadAssessmentDocument(
    assessmentId: string,
    file: File
  ): Promise<{ document: UploadedDocumentRecord; assessment: Assessment }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postForm<{ document: UploadedDocumentRecord; assessment: Assessment }>(
      `/assessments/${assessmentId}/documents/upload`,
      formData
    );
  },

  async reviewAssessmentDocument(
    assessmentId: string,
    docId: string,
    payload: {
      action: 'ACCEPT_CORRECTIONS' | 'DISMISS';
      acceptedFields?: string[];
      reviewNotes?: string;
      verifyAccepted?: boolean;
    }
  ): Promise<{ document: UploadedDocumentRecord; assessment: Assessment }> {
    return apiClient.post<{ document: UploadedDocumentRecord; assessment: Assessment }>(
      `/assessments/${assessmentId}/documents/${docId}/review`,
      payload
    );
  }
};
