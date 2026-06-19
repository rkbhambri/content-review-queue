import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IAuthUser } from '@/interfaces';

interface RateWindow {
  count: number;
  resetAt: number;
}

/**
 * Lightweight per-reviewer fixed-window rate limiter for write hot paths
 * (reserve). In-process and dependency-free, mirroring the caching choice.
 * Must run *after* the JWT guard so `request.user` is populated.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, RateWindow>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(config: ConfigService) {
    this.max = config.get<number>('rateLimit.max', 30);
    this.windowMs = config.get<number>('rateLimit.windowMs', 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: IAuthUser }>();
    const key = request.user?.reviewerId ?? request.ip ?? 'anonymous';
    const now = Date.now();

    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (window.count >= this.max) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    window.count += 1;
    return true;
  }
}
