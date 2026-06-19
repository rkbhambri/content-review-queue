import { InMemoryCacheService } from './cache.service';

describe('InMemoryCacheService', () => {
  let cache: InMemoryCacheService;

  beforeEach(() => {
    cache = new InMemoryCacheService();
  });

  it('stores and returns values within the TTL', () => {
    cache.set('k', 42, 1000);
    expect(cache.get<number>('k')).toBe(42);
  });

  it('expires values after the TTL', () => {
    jest.useFakeTimers();
    cache.set('k', 'v', 1000);
    jest.advanceTimersByTime(1500);
    expect(cache.get('k')).toBeUndefined();
    jest.useRealTimers();
  });

  it('wrap() computes once then serves from cache', async () => {
    const factory = jest.fn().mockResolvedValue('computed');
    const a = await cache.wrap('k', 1000, factory);
    const b = await cache.wrap('k', 1000, factory);
    expect(a).toBe('computed');
    expect(b).toBe('computed');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('invalidate() clears a key and its prefixed children', () => {
    cache.set('available:west-coast', [1], 1000);
    cache.set('available:east-coast', [2], 1000);
    cache.invalidate('available:west-coast');
    expect(cache.get('available:west-coast')).toBeUndefined();
    expect(cache.get('available:east-coast')).toEqual([2]);
  });
});
