import { apiClient } from '@/api/api-client';
import { assignClassStudents, createClass, getClassPage, updateClass } from '@/api/classes';

jest.mock('@/api/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const client = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => jest.clearAllMocks());

describe('class API', () => {
  test('rejects invalid page or size before making a request', () => {
    expect(() => getClassPage({ page: 0, size: 10 })).toThrow('page and size must be positive integers.');
    expect(() => getClassPage({ page: 1, size: 0 })).toThrow('page and size must be positive integers.');
    expect(client.get).not.toHaveBeenCalled();
  });

  test('requests class pages from /class/page', () => {
    getClassPage({ page: 1, size: 10 });

    expect(client.get).toHaveBeenCalledWith('/class/page', {
      page: 1, size: 10, columnlist: 'id,code,name,description', search: undefined,
    });
  });

  test('trims class code and name on creation', () => {
    createClass({ code: '  SE-1  ', name: '  Software Engineering  ', description: 'Core class' });

    expect(client.post).toHaveBeenCalledWith('/class', {
      code: 'SE-1', name: 'Software Engineering', description: 'Core class',
    });
  });

  test('does not send mutable code when updating a class', () => {
    updateClass('class-1', { code: 'NEW-CODE', name: '  Updated  ', description: 'Changed' });

    expect(client.put).toHaveBeenCalledWith('/class/class-1', { name: 'Updated', description: 'Changed' });
  });

  test('assigns members to the class students route using studentIds', () => {
    assignClassStudents('class-1', ['student-1', 'student-2']);

    expect(client.post).toHaveBeenCalledWith('/class/class-1/students', { studentIds: ['student-1', 'student-2'] });
  });
});
