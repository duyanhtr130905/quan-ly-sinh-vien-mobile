import { File } from 'expo-file-system';

import type { LegacyApiResponse } from './api-types';
import { apiClient, type BinaryFileResponse } from './api-client';

const STUDENT_LIST_COLUMNS = 'id,code,fullname,email';

export type StudentListItem = {
  id: string;
  code: string;
  fullname: string;
  email: string;
};

export type StudentPageData = {
  page_info: {
    total_items: number;
    total_pages: number;
    current: number;
    size: number;
  };
  records: StudentListItem[];
};

export type Student = {
  id: string;
  code: string;
  fullname: string;
  dob: string | null;
  sex: boolean | null;
  homecity: string | null;
  address: string | null;
  hair_color: string | null;
  email: string;
  facebook: string | null;
  class_id: string | null;
  username: string;
  description: string | null;
  hobbies: number | string | null;
  attachment: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

export type StudentFormValues = {
  code: string;
  fullname: string;
  dob: string;
  sex: boolean | null;
  homecity: string;
  address: string;
  hair_color: string;
  email: string;
  facebook: string;
  class_id: string;
  username: string;
  password: string;
  description: string;
  hobbies: number;
};

export type StudentImageFile = {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
};

type StudentPageParams = {
  page: number;
  size: number;
  search?: string;
};

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

export function getStudentPage({ page, size, search }: StudentPageParams) {
  assertPositiveInteger(page, 'page');
  assertPositiveInteger(size, 'size');

  return apiClient.get<LegacyApiResponse<StudentPageData>>('/student/page', {
    page,
    size,
    columnlist: STUDENT_LIST_COLUMNS,
    search: search?.trim() || undefined,
  });
}

export function getDeletedStudentPage({ page, size, search }: StudentPageParams) {
  assertPositiveInteger(page, 'page');
  assertPositiveInteger(size, 'size');

  return apiClient.get<LegacyApiResponse<StudentPageData>>('/student/deleted/page', {
    page,
    size,
    columnlist: STUDENT_LIST_COLUMNS,
    search: search?.trim() || undefined,
  });
}

export function getStudent(id: string) {
  return apiClient.get<LegacyApiResponse<Student>>(`/student/${id}`);
}

function appendFormValue(formData: FormData, name: string, value: string | number | boolean) {
  formData.append(name, String(value));
}

function studentFormData(values: StudentFormValues, image: StudentImageFile | null, create: boolean) {
  const formData = new FormData();

  if (create) {
    appendFormValue(formData, 'code', values.code);
    appendFormValue(formData, 'username', values.username);
    appendFormValue(formData, 'password', values.password);
  } else if (values.password) {
    appendFormValue(formData, 'password', values.password);
  }

  for (const key of ['fullname', 'homecity', 'address', 'hair_color', 'email', 'facebook', 'description'] as const) {
    appendFormValue(formData, key, values[key]);
  }
  appendFormValue(formData, 'dob', values.dob);
  if (values.sex !== null) {
    appendFormValue(formData, 'sex', values.sex);
  }
  appendFormValue(formData, 'class_id', values.class_id);
  appendFormValue(formData, 'hobbies', values.hobbies);

  if (image) {
    const file = new File(image.uri);
    formData.append('attachment', file, image.name);
  }

  return formData;
}

export function createStudent(values: StudentFormValues, image: StudentImageFile | null) {
  return apiClient.post<LegacyApiResponse<Student>>('/student', studentFormData(values, image, true));
}

export function updateStudent(id: string, values: StudentFormValues, image: StudentImageFile | null) {
  return apiClient.put<LegacyApiResponse<Student>>(`/student/${id}`, studentFormData(values, image, false));
}

export function deleteStudent(id: string) {
  return apiClient.delete<LegacyApiResponse<{ id: number }>>(`/student/${id}`);
}

export type RestoreStudentsResult = {
  restored: number[];
  notFound: number[];
  conflicts: number[];
};

export type PermanentlyDeleteStudentsResult = {
  deleted: number[];
  notFound: number[];
};

export function restoreStudents(ids: number[]) {
  return apiClient.patch<LegacyApiResponse<RestoreStudentsResult>>('/student/deleted/restore', { idlist: ids });
}

export function permanentlyDeleteStudents(ids: number[]) {
  return apiClient.delete<LegacyApiResponse<PermanentlyDeleteStudentsResult>>('/student/deleted/permanent', { idlist: ids });
}

export function copyStudent(id: string) {
  return apiClient.post<LegacyApiResponse<Student>>(`/student/copy/${id}`);
}

export type StudentFileFormat = 'csv' | 'xlsx' | 'json' | 'xml';

export type StudentCopyValues = {
  code: string; fullname: string; dob: string | null; sex: boolean | null; homecity: string | null; address: string | null;
  hair_color: string | null; email: string; facebook: string | null; class_id: string | number | null; username: string;
  description: string | null; hobbies: number; attachment: string | null;
};

export type StudentCopyDraft = { draftKey: string; sourceId: number; values: StudentCopyValues };
export type StudentCopyPreview = { drafts: StudentCopyDraft[]; notFoundIds: (string | number)[] };
export type StudentCopyValidationRow = { draftKey: string; status: 'valid' | 'invalid'; errors: Record<string, string> };
export type StudentCopyCommit = { created: { draftKey: string; record: Student | undefined }[] };

export type StudentImportValues = {
  code: string; fullname: string; dob: string | null; gender: boolean | null; class: string; email: string; username: string; password: string;
  homecity: string; address: string; hobbies: string[]; description: string; hair_color: string; facebook: string;
};
export type StudentImportLookup = { id: number; code?: string; name?: string; bit_value?: number };
export type StudentImportRow = {
  draftKey: string; rowNumber: number; values: StudentImportValues; mode: 'create' | 'update'; status: 'valid' | 'invalid';
  errors: Record<string, string>; fieldErrors: Record<string, string>; missingHobbies: string[];
};
export type StudentImportPreview = { rows: StudentImportRow[]; lookups?: { classes: StudentImportLookup[]; hobbies: StudentImportLookup[] } };
export type StudentImportCommit = { created: { draftKey: string; rowNumber: number; record: Student }[]; updated: { draftKey: string; rowNumber: number; record: Student }[] };

export function previewStudentCopies(ids: string[]) {
  return apiClient.post<LegacyApiResponse<StudentCopyPreview>>('/student/copy/preview', { idlist: ids });
}

export function validateStudentCopies(drafts: StudentCopyDraft[]) {
  return apiClient.post<LegacyApiResponse<{ rows: StudentCopyValidationRow[] }>>('/student/copy/validate', { drafts });
}

export function commitStudentCopies(drafts: StudentCopyDraft[], images: Record<string, StudentImageFile>) {
  const form = new FormData();
  form.append('drafts', JSON.stringify(drafts));
  Object.entries(images).forEach(([draftKey, image]) => form.append(`attachment-${draftKey}`, new File(image.uri), image.name));
  return apiClient.post<LegacyApiResponse<StudentCopyCommit>>('/student/copy/commit', form);
}

export function getStudentImportTemplate(type: StudentFileFormat): Promise<BinaryFileResponse> {
  return apiClient.getFile('/student/import/template', { type });
}

export function previewStudentImport(fileUri: string, name: string) {
  const form = new FormData();
  form.append('file', new File(fileUri), name);
  return apiClient.post<LegacyApiResponse<StudentImportPreview>>('/student/import', form);
}

export function validateStudentImport(drafts: StudentImportRow[]) {
  return apiClient.post<LegacyApiResponse<StudentImportPreview>>('/student/import/validate', { drafts });
}

export function commitStudentImport(drafts: StudentImportRow[]) {
  return apiClient.post<LegacyApiResponse<StudentImportCommit>>('/student/import/commit', { drafts });
}

export function exportStudent(id: string, type: StudentFileFormat): Promise<BinaryFileResponse> {
  return apiClient.getFile(`/student/export/${id}`, { type });
}

export function exportStudents(ids: string[], type: StudentFileFormat): Promise<BinaryFileResponse> {
  return apiClient.postFile('/student/export', { idlist: ids, type });
}
