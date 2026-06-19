import { SESSION_STORAGE_KEY } from '@/constants';
import { ISession } from '@/interfaces';

export function getSession(): ISession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ISession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: ISession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}
