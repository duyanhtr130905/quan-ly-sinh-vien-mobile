import type { LegacyApiResponse } from './api-types';
import { apiClient } from './api-client';

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
