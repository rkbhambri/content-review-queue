import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';

const makeContext = (reviewerId: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: { reviewerId } }),
    }),
  }) as unknown as ExecutionContext;

const config = (max: number, windowMs: number): ConfigService =>
  ({
    get: (key: string, def: unknown) =>
      key === 'rateLimit.max'
        ? max
        : key === 'rateLimit.windowMs'
          ? windowMs
          : def,
  }) as unknown as ConfigService;

describe('RateLimitGuard', () => {
  it('allows requests up to the limit then throws 429', () => {
    const guard = new RateLimitGuard(config(2, 60_000));
    const ctx = makeContext('reviewer-1');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('tracks reviewers independently', () => {
    const guard = new RateLimitGuard(config(1, 60_000));
    expect(guard.canActivate(makeContext('a'))).toBe(true);
    expect(guard.canActivate(makeContext('b'))).toBe(true);
    expect(() => guard.canActivate(makeContext('a'))).toThrow(HttpException);
  });

  it('resets after the window elapses', () => {
    jest.useFakeTimers();
    const guard = new RateLimitGuard(config(1, 1000));
    const ctx = makeContext('reviewer-1');
    expect(guard.canActivate(ctx)).toBe(true);
    jest.advanceTimersByTime(1500);
    expect(guard.canActivate(ctx)).toBe(true);
    jest.useRealTimers();
  });
});
