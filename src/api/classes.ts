import { File } from 'expo-file-system';

import { apiClient, type BinaryFileResponse } from './api-client';
import type { LegacyApiResponse } from './api-types';

const CLASS_COLUMNS = 'id,code,name,description';
const STUDENT_COLUMNS = 'id,code,fullname,email';

export type ClassEntity = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type ClassListItem = ClassEntity & {
  student_count: number | string;
};

export type ClassDetail = ClassEntity & {
  student_count: number | string;
};
export type ClassFormValues = { code: string; name: string; description: string };
export type ClassStudent = { id: string; code: string; fullname: string; email: string };
export type PageData<T> = { page_info: { total_items: number; total_pages: number; current: number; size: number }; records: T[] };
type PageParams = { page: number; size: number; search?: string };

function query({ page, size, search }: PageParams, columnlist: string) {
  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(size) || size <= 0) throw new Error('page and size must be positive integers.');
  return { page, size, columnlist, search: search?.trim() || undefined };
}

export const getClassPage = (params: PageParams) => apiClient.get<LegacyApiResponse<PageData<ClassListItem>>>('/class/page', query(params, CLASS_COLUMNS));
export const getClass = (id: string) => apiClient.get<LegacyApiResponse<ClassDetail>>(`/class/${id}`);
export const createClass = (values: ClassFormValues) => apiClient.post<LegacyApiResponse<{ id: string }>>('/class', { code: values.code.trim(), name: values.name.trim(), description: values.description });
export const updateClass = (id: string, values: ClassFormValues) => apiClient.put<LegacyApiResponse<{ id: string }>>(`/class/${id}`, { name: values.name.trim(), description: values.description });
export const deleteClass = (id: string) => apiClient.delete<LegacyApiResponse<ClassEntity | null>>(`/class/${id}`);
export const copyClass = (id: string) => apiClient.post<LegacyApiResponse<ClassEntity>>(`/class/copy/${id}`);
export const getClassStudents = (id: string, params: PageParams) => apiClient.get<LegacyApiResponse<PageData<ClassStudent>>>(`/class/${id}/students`, query(params, STUDENT_COLUMNS));
export const getAvailableStudents = (id: string, params: PageParams) => apiClient.get<LegacyApiResponse<PageData<ClassStudent>>>(`/class/${id}/available-students`, query(params, STUDENT_COLUMNS));
export const assignClassStudents = (id: string, studentIds: string[]) => apiClient.post<LegacyApiResponse<{ studentIds: number[] }>>(`/class/${id}/students`, { studentIds });
export const removeClassStudent = (id: string, studentId: string) => apiClient.delete<LegacyApiResponse<{ studentId: string }>>(`/class/${id}/students/${studentId}`);

export type ClassFileFormat = 'csv' | 'xlsx' | 'json' | 'xml';
export type ClassCopyValues = { code: string; name: string; description: string };
export type ClassCopyDraft = { draftKey: string; sourceId: number; values: ClassCopyValues };
export type ClassCopyPreview = { drafts: ClassCopyDraft[]; notFoundIds: (string | number)[] };
export type ClassCopyValidationRow = { draftKey: string; status: 'valid' | 'invalid'; errors: Record<string, string> };
export type ClassCopyCommit = { created: { draftKey: string; record: ClassEntity }[] };
export type ClassImportFailure = { row: number; reason: string };
export type ClassImportResult = { created: { id: string }[]; failed: ClassImportFailure[] };
export type BulkClassDeleteResult = { deletedIds: (string | number)[]; blockedIds: (string | number)[] };

export const previewClassCopies = (ids: string[]) => apiClient.post<LegacyApiResponse<ClassCopyPreview>>('/class/copy/preview', { idlist: ids });
export const validateClassCopies = (drafts: ClassCopyDraft[]) => apiClient.post<LegacyApiResponse<{ rows: ClassCopyValidationRow[] }>>('/class/copy/validate', { drafts });
export const commitClassCopies = (drafts: ClassCopyDraft[]) => apiClient.post<LegacyApiResponse<ClassCopyCommit>>('/class/copy/commit', { drafts });

export function importClasses(fileUri: string, name: string) {
  const form = new FormData();
  form.append('file', new File(fileUri), name);
  return apiClient.post<LegacyApiResponse<ClassImportResult>>('/class/import', form);
}

export const exportClass = (id: string, type: ClassFileFormat): Promise<BinaryFileResponse> => apiClient.getFile(`/class/export/${id}`, { type });
export const exportClasses = (ids: string[], type: ClassFileFormat): Promise<BinaryFileResponse> => apiClient.postFile('/class/export', { idlist: ids, type });
export const deleteClasses = (ids: string[]) => apiClient.delete<LegacyApiResponse<BulkClassDeleteResult>>('/class/delete', { ids });
export const removeClassStudents = (id: string, studentIds: string[]) => apiClient.patch<LegacyApiResponse<{ studentIds: number[] }>>(`/class/${id}/students/remove`, { studentIds });
