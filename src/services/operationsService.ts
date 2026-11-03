import { apiClient } from './apiClient';
import { NotificationItem } from '../types';

export interface ClinicalInquiry {
  id: string;
  assessmentId: string;
  petName: string;
  recipient: 'clinic' | 'owner' | 'both';
  urgency: string;
  questions: string[];
  status: 'DISPATCHED' | 'RECEIVED' | 'RESOLVED' | 'Requested' | 'Pending Request';
  responseSummary?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  epochMs: number;
  notes?: string;
  details?: Record<string, any>;
}

export const operationsService = {
  async getInformationRequests(assessmentId?: string): Promise<ClinicalInquiry[]> {
    const query = assessmentId ? `?assessment_id=${encodeURIComponent(assessmentId)}` : '';
    return apiClient.get<ClinicalInquiry[]>(`/information-requests${query}`);
  },

  async updateInformationRequestStatus(
    requestId: string,
    status: string,
    responseSummary?: string
  ): Promise<{ success: boolean; status: string }> {
    return apiClient.patch<{ success: boolean; status: string }>(
      `/information-requests/${requestId}/status`,
      { status, responseSummary }
    );
  },

  async getAuditLogs(entityType?: string, entityId?: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (entityType) params.append('entity_type', entityType);
    if (entityId) params.append('entity_id', entityId);
    if (limit) params.append('limit', limit.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<AuditLogEntry[]>(`/audit-logs${queryString}`);
  },

  async getNotifications(): Promise<NotificationItem[]> {
    return apiClient.get<NotificationItem[]>('/notifications');
  },

  async createNotification(notification: NotificationItem): Promise<NotificationItem> {
    return apiClient.post<NotificationItem>('/notifications', notification);
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return apiClient.patch<{ success: boolean }>(`/notifications/${id}/read`);
  }
};

