import axios, { AxiosError } from 'axios';
import { API_BASE } from '@/constants';
import { clearSession, getToken } from './storage';

/**
 * Shared axios instance. Attaches the bearer token, unwraps the backend's
 * `{ status, statusCode, message, entity }` success envelope, and normalizes
 * errors into a plain Error carrying the server message.
 */
const client = axios.create({ baseURL: API_BASE, timeout: 10_000 });

client.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  response => response,
  (error: AxiosError<{ message?: string; statusCode?: number }>) => {
    const status = error.response?.status;
    if (status === 401) {
      clearSession();
    }
    const message =
      error.response?.data?.message ?? error.message ?? 'Request failed';
    return Promise.reject(new Error(message));
  },
);

/** Unwrap `{ status, entity }` success payloads from the backend. */
export function unwrapApiEntity<T>(data: unknown): T {
  if (
    data &&
    typeof data === 'object' &&
    'status' in data &&
    (data as { status: boolean }).status === true &&
    'entity' in data
  ) {
    return (data as { entity: T }).entity;
  }
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await client.get(url);
  return unwrapApiEntity<T>(response.data);
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await client.post(url, body);
  return unwrapApiEntity<T>(response.data);
}

export default client;
