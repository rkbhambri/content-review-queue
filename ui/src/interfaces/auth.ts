import { Locale } from '@/types';

export interface IReviewer {
  reviewerId: string;
  locale: Locale;
}

export interface ILoginResponse {
  accessToken: string;
  reviewer: IReviewer;
}

export interface ISession {
  token: string;
  reviewer: IReviewer;
}
