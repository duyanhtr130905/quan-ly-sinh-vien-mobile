import { apiClient } from './api-client';

export type HealthResponse = {
  status: string;
  message: string;
};

export function getHealth() {
  return apiClient.get<HealthResponse>('/');
}
