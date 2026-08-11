jest.mock('@/config/api', () => ({
  apiConfig: { baseUrl: 'https://api.example.test/v1' },
}));

import { ApiClientError, apiClient } from '@/api/api-client';

const fetchMock = jest.fn();

function response(status: number, payload: unknown) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(payload) } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('apiClient', () => {
  test('encodes GET query parameters and omits nullish values', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [] }));

    await apiClient.get('/students', { search: 'Ada & Bob', page: 2, empty: undefined, none: null });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/students?search=Ada%20%26%20Bob&page=2',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('serializes JSON bodies with an application/json content type', async () => {
    fetchMock.mockResolvedValue(response(200, { data: { id: 1 } }));

    await apiClient.post('/students', { name: 'Ada' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/students',
      expect.objectContaining({
        body: JSON.stringify({ name: 'Ada' }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
    );
  });

  test('does not manually set multipart Content-Type for FormData', async () => {
    fetchMock.mockResolvedValue(response(200, { data: { id: 1 } }));
    const formData = new FormData();
    formData.append('name', 'Ada');

    await apiClient.post('/students', formData);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/v1/students',
      expect.objectContaining({ body: formData, headers: { Accept: 'application/json' } }),
    );
  });

  test('turns non-2xx legacy envelopes into ApiClientError with their details', async () => {
    fetchMock.mockResolvedValue(response(422, { code: 'INVALID_INPUT', status: 422, message: 'Invalid input', data: { field: 'email' } }));

    await expect(apiClient.get('/students')).rejects.toMatchObject<ApiClientError>({
      name: 'ApiClientError', status: 422, code: 'INVALID_INPUT', message: 'Invalid input', data: { field: 'email' },
    });
  });

  test('turns non-legacy HTTP failures into a generic ApiClientError', async () => {
    fetchMock.mockResolvedValue(response(500, { error: 'unexpected' }));

    await expect(apiClient.get('/students')).rejects.toMatchObject<ApiClientError>({
      name: 'ApiClientError', status: 500, code: undefined, data: undefined, message: 'Request failed with status 500.',
    });
  });
});
