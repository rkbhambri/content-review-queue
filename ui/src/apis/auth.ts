import { apiPost } from '@/utilities';
import { ILoginResponse } from '@/interfaces';
import { Locale } from '@/types';
import { AUTH_API_URLS } from './urls';

export const login = (reviewerId: string, locale: Locale): Promise<ILoginResponse> =>
  apiPost<ILoginResponse>(AUTH_API_URLS.login, { reviewerId, locale });
