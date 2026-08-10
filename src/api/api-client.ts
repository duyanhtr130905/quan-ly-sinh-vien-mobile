import { apiConfig } from '@/config/api';

export class ApiClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function buildUrl(path: string) {
  if (!apiConfig.baseUrl) {
    throw new ApiClientError('EXPO_PUBLIC_API_URL is not configured.');
  }

  return `${apiConfig.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ApiClientError(`Request failed with status ${response.status}.`, response.status);
  }

  return (await response.json()) as T;
}

export const apiClient = { get };
