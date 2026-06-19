import { Locale } from '@/enums';

/** The authenticated principal attached to each request by the JWT strategy. */
export interface IAuthUser {
  reviewerId: string;
  locale: Locale;
}

/** Claims encoded in the signed JWT. */
export interface IJwtPayload {
  sub: string;
  reviewerId: string;
  locale: Locale;
}

/** Result of a successful login. */
export interface ILoginResult {
  accessToken: string;
  reviewer: {
    reviewerId: string;
    locale: Locale;
  };
}
