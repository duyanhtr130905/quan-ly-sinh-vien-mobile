import { apiClient } from './api-client';
import type { LegacyApiResponse } from './api-types';

const CLASS_COLUMNS = 'id,code,name,description';
const STUDENT_COLUMNS = 'id,code,fullname,email';

export type ClassRecord = { id: string; code: string; name: string; description: string | null; student_count: number | string };
export type ClassFormValues = { code: string; name: string; description: string };
export type ClassStudent = { id: string; code: string; fullname: string; email: string };
export type PageData<T> = { page_info: { total_items: number; total_pages: number; current: number; size: number }; records: T[] };
type PageParams = { page: number; size: number; search?: string };

function query({ page, size, search }: PageParams, columnlist: string) {
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(size) || size <= 0) throw new Error('page and size must be positive integers.');
  return { page, size, columnlist, search: search?.trim() || undefined };
}

export const getClassPage = (params: PageParams) => apiClient.get<LegacyApiResponse<PageData<ClassRecord>>>('/class/page', query(params, CLASS_COLUMNS));
export const getClass = (id: string) => apiClient.get<LegacyApiResponse<ClassRecord>>(`/class/${id}`);
export const createClass = (values: ClassFormValues) => apiClient.post<LegacyApiResponse<{ id: string }>>('/class', { code: values.code.trim(), name: values.name.trim(), description: values.description });
export const updateClass = (id: string, values: ClassFormValues) => apiClient.put<LegacyApiResponse<{ id: string }>>(`/class/${id}`, { name: values.name.trim(), description: values.description });
export const deleteClass = (id: string) => apiClient.delete<LegacyApiResponse<ClassRecord | null>>(`/class/${id}`);
export const copyClass = (id: string) => apiClient.post<LegacyApiResponse<ClassRecord>>(`/class/copy/${id}`);
export const getClassStudents = (id: string, params: PageParams) => apiClient.get<LegacyApiResponse<PageData<ClassStudent>>>(`/class/${id}/students`, query(params, STUDENT_COLUMNS));
export const getAvailableStudents = (id: string, params: PageParams) => apiClient.get<LegacyApiResponse<PageData<ClassStudent>>>(`/class/${id}/available-students`, query(params, STUDENT_COLUMNS));
export const assignClassStudents = (id: string, studentIds: string[]) => apiClient.post<LegacyApiResponse<{ studentIds: number[] }>>(`/class/${id}/students`, { studentIds });
export const removeClassStudent = (id: string, studentId: string) => apiClient.delete<LegacyApiResponse<{ studentId: string }>>(`/class/${id}/students/${studentId}`);
