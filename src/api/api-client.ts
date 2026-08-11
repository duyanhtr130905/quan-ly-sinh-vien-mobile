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

export type BinaryFileResponse = {
  bytes: Uint8Array;
  filename: string;
  contentType: string | null;
};

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

export function buildUrl(path: string, query?: Record<string, QueryValue>) {
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

function filenameFromDisposition(value: string | null) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value ?? '')?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(value ?? '')?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : plain;
  return filename?.replace(/[\\/:*?"<>|]/g, '_') || `students-${Date.now()}`;
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

async function requestFile(
  method: 'GET' | 'POST',
  path: string,
  body?: ApiBody,
  query?: Record<string, QueryValue>,
): Promise<BinaryFileResponse> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = { Accept: '*/*' };
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    if (isLegacyApiResponse(payload)) throw new ApiClientError(payload.message, payload.status, payload.code, payload.data);
    throw new ApiClientError(`Request failed with status ${response.status}.`, response.status);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    filename: filenameFromDisposition(response.headers.get('content-disposition')),
    contentType: response.headers.get('content-type'),
  };
}

export const apiClient = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('POST', path, body, query),
  put: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('PUT', path, body, query),
  patch: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('PATCH', path, body, query),
  delete: <T>(path: string, body?: ApiBody, query?: Record<string, QueryValue>) => request<T>('DELETE', path, body, query),
  getFile: (path: string, query?: Record<string, QueryValue>) => requestFile('GET', path, undefined, query),
  postFile: (path: string, body?: ApiBody, query?: Record<string, QueryValue>) => requestFile('POST', path, body, query),
};
