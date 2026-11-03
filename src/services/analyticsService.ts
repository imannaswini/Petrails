import { apiClient } from './apiClient';
import { PortfolioMetrics } from '../types';

export const analyticsService = {
  async getPortfolioMetrics(): Promise<PortfolioMetrics> {
    return apiClient.get<PortfolioMetrics>('/analytics/portfolio');
  }
};
