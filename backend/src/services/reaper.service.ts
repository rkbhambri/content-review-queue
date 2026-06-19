import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReservationsService } from './reservations.service';

/**
 * Scheduled background sweep that releases stale reservations even when no one
 * is actively reading the queue. Uses a plain self-rescheduling timer (instead
 * of a fixed decorator interval) so the cadence is env-configurable and so a
 * slow sweep can never overlap itself.
 *
 * Single-instance assumption: with multiple replicas every instance would run
 * this. The transitions are idempotent so that is *correct*, just redundant; probably 
 * we might introduce shared lock/queue would be the next step.
 */
@Injectable()
export class ReaperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReaperService.name);
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly reservations: ReservationsService,
    config: ConfigService,
  ) {
    this.intervalMs = config.get<number>(
      'reservation.reaperIntervalMs',
      15_000,
    );
  }

  onModuleInit(): void {
    this.schedule();
    this.logger.log(`Reservation reaper started (every ${this.intervalMs}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(): void {
    this.timer = setTimeout(() => void this.tick(), this.intervalMs);
    // Don't keep the event loop alive solely for the reaper.
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.schedule();
      return;
    }
    this.running = true;
    try {
      await this.reservations.releaseExpired();
    } catch (error) {
      this.logger.error('Reaper sweep failed', error as Error);
    } finally {
      this.running = false;
      this.schedule();
    }
  }
}
