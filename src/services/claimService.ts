import { apiClient } from './apiClient';
import { Claim, ClaimDecision } from '../types';

export interface ClaimDecisionPayload {
  status: 'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster';
  notes: string;
  approvedAmountInr?: number;
  decidedBy?: string;
}

export const claimService = {
  async getClaims(): Promise<Claim[]> {
    return apiClient.get<Claim[]>('/claims');
  },

  async getClaimById(id: string): Promise<Claim> {
    return apiClient.get<Claim>(`/claims/${id}`);
  },

  async createClaim(claim: Claim): Promise<Claim> {
    return apiClient.post<Claim>('/claims', claim);
  },

  async recordDecision(
    claimId: string,
    payload: ClaimDecisionPayload
  ): Promise<{ success: boolean; decision: ClaimDecision }> {
    return apiClient.post<{ success: boolean; decision: ClaimDecision }>(
      `/claims/${claimId}/decision`,
      payload
    );
  }
};
