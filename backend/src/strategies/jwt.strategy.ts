import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IAuthUser, IJwtPayload } from '@/interfaces';

/** Reads the JWT from the `access_token` query param (used by SSE EventSource). */
const fromAccessTokenQuery = (req: Request): string | null => {
  const token = req?.query?.access_token;
  return typeof token === 'string' ? token : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromAccessTokenQuery,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'super-secret-change-me',
    });
  }

  /** The returned value becomes `request.user`. The token is already trusted. */
  validate(payload: IJwtPayload): IAuthUser {
    return { reviewerId: payload.reviewerId, locale: payload.locale };
  }
}
