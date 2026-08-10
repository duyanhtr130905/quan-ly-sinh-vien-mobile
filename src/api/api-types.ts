export type LegacyApiResponse<T> = {
  code: string;
  status: number;
  message: string;
  data: T;
};
