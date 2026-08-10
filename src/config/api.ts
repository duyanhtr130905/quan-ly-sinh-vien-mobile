function normalizeApiBaseUrl(value: string | undefined) {
  const url = value?.trim();

  return url ? url.replace(/\/+$/, '') : null;
}

export const apiConfig = {
  baseUrl: normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL),
};
