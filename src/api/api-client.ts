import { apiConfig } from '@/config/api';

import type { LegacyApiResponse } from './api-types';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type QueryValue = string | number | boolean | null | undefined;

function isLegacyApiResponse(value: unknown): value is LegacyApiResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'status' in value &&
    'message' in value &&
    'data' in value &&
    typeof value.code === 'string' &&
    typeof value.status === 'number' &&
    typeof value.message === 'string'
  );
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  if (!apiConfig.baseUrl) {
    throw new ApiClientError('EXPO_PUBLIC_API_URL is not configured.');
  }

  const url = `${apiConfig.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const entries = Object.entries(query ?? {}).filter(([, value]) => value !== undefined && value !== null);

  if (!entries.length) {
    return url;
  }

  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${url}?${search}`;
}

async function get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    headers: { Accept: 'application/json' },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isLegacyApiResponse(payload)) {
      throw new ApiClientError(payload.message, payload.status, payload.code, payload.data);
    }

    throw new ApiClientError(`Request failed with status ${response.status}.`, response.status);
  }

  return payload as T;
}

export const apiClient = { get };
