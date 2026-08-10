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

export type QueryValue = string | number | boolean | null | undefined;
type ApiBody = FormData | Record<string, unknown> | undefined;

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

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: ApiBody,
  query?: Record<string, QueryValue>,
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
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

export const apiClient = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('POST', path, body, query),
  put: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('PUT', path, body, query),
  patch: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('PATCH', path, body, query),
  delete: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('DELETE', path, body, query),
};
