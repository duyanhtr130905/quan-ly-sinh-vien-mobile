import type { LegacyApiResponse } from './api-types';
import { apiClient } from './api-client';

export type StudentClass = {
  id: string;
  code: string;
  name: string;
};

export type Hobby = {
  id: string;
  code: string;
  name: string;
  bit_value: number;
  is_active: boolean;
};

export function getStudentClasses() {
  return apiClient.get<LegacyApiResponse<StudentClass[]>>('/class', {
    columnlist: 'id,code,name',
  });
}

export function getActiveHobbies() {
  return apiClient.get<LegacyApiResponse<Hobby[]>>('/hobby');
}

export function createHobby(name: string) {
  return apiClient.post<LegacyApiResponse<Hobby>>('/hobby', { name });
}
