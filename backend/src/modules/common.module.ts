import { Global, Module } from '@nestjs/common';
import { ClockService, EventsService, InMemoryCacheService } from '@/services';

/**
 * Cross-cutting singletons (clock, cache, event bus) shared by every feature
 * module. Global so they don't have to be re-imported everywhere.
 */
@Global()
@Module({
  providers: [ClockService, InMemoryCacheService, EventsService],
  exports: [ClockService, InMemoryCacheService, EventsService],
})
export class CommonModule {}
