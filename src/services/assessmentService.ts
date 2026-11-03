import { apiClient } from './apiClient';
import { Assessment, DecisionHistoryEntry } from '../types';

export interface DecisionPayload {
  decision: 'Approve' | 'Request Information' | 'Refer for Review';
  notes: string;
  stipulation?: string;
  user?: string;
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

  async createAssessment(assessment: Assessment): Promise<Assessment> {
    return apiClient.post<Assessment>('/assessments', assessment);
  },

  async recordDecision(
    assessmentId: string,
    payload: DecisionPayload
  ): Promise<{ success: boolean; decision: DecisionHistoryEntry }> {
    return apiClient.post<{ success: boolean; decision: DecisionHistoryEntry }>(
      `/assessments/${assessmentId}/decision`,
      payload
    );
  },

  async requestInformation(
    assessmentId: string,
    payload: InformationRequestPayload
  ): Promise<{ success: boolean; message: string; inquiryId?: string }> {
    return apiClient.post<{ success: boolean; message: string; inquiryId?: string }>(
      `/assessments/${assessmentId}/information-request`,
      payload
    );
  }
};
