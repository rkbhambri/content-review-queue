import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_SUCCESS_WRAPPER_KEY } from '@/decorators';

interface SuccessEnvelope<T> {
  status: true;
  statusCode: number;
  message: string;
  entity: T;
}

/**
 * Wraps every successful JSON response in a consistent envelope:
 * `{ status, statusCode, message, entity }`. Handlers decorated with
 * `@SkipSuccessWrapper()` (e.g. the SSE stream) are passed through untouched.
 */
@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipWrapper = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUCCESS_WRAPPER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipWrapper) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data): SuccessEnvelope<unknown> => {
        const response = context.switchToHttp().getResponse<{
          statusCode?: number;
        }>();
        return {
          status: true,
          statusCode: response?.statusCode ?? 200,
          message: 'Success',
          entity: data,
        };
      }),
    );
  }
}
