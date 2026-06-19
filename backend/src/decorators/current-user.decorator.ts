import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { IAuthUser } from '@/interfaces';

/** Injects the authenticated reviewer resolved by the JWT strategy/guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IAuthUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: IAuthUser }>();
    return request.user;
  },
);
