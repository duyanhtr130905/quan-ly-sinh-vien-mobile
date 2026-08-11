import { apiClient } from '@/api/api-client';
import { getStudentPage, permanentlyDeleteStudents, restoreStudents } from '@/api/students';

jest.mock('@/api/api-client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const client = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => jest.clearAllMocks());

describe('student API', () => {
  test('rejects invalid page or size before making a request', () => {
    expect(() => getStudentPage({ page: 0, size: 10 })).toThrow('page must be a positive integer.');
    expect(() => getStudentPage({ page: 1, size: 1.5 })).toThrow('size must be a positive integer.');
    expect(client.get).not.toHaveBeenCalled();
  });

  test('trims search and requests the student list with its expected columns', () => {
    getStudentPage({ page: 2, size: 25, search: '  Ada  ' });

    expect(client.get).toHaveBeenCalledWith('/student/page', {
      page: 2, size: 25, columnlist: 'id,code,fullname,email', search: 'Ada',
    });
  });

  test('restores students with an idlist body', () => {
    restoreStudents([1, 2]);

    expect(client.patch).toHaveBeenCalledWith('/student/deleted/restore', { idlist: [1, 2] });
  });

  test('permanently deletes students with an idlist body', () => {
    permanentlyDeleteStudents([3, 4]);

    expect(client.delete).toHaveBeenCalledWith('/student/deleted/permanent', { idlist: [3, 4] });
  });
});
