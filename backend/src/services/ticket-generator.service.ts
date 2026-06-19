import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '@/entities';
import { LOCALES, Locale, TicketStatus } from '@/enums';
import { EventsService } from './events.service';
import { InMemoryCacheService } from './cache.service';

/**
 * Optional simulator of continuous upstream ingestion. When GENERATE_TICKETS is
 * enabled it periodically inserts a fresh ticket into a random locale so the
 * queue keeps replenishing during a live demo. Disabled by default.
 */
@Injectable()
export class TicketGeneratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketGeneratorService.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private counter = 0;

  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    private readonly cache: InMemoryCacheService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('ingestion.generateTickets', false);
    this.intervalMs = config.get<number>(
      'ingestion.generateIntervalMs',
      30_000,
    );
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.generate(), this.intervalMs);
    this.timer.unref?.();
    this.logger.log(`Ticket generator enabled (every ${this.intervalMs}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async generate(): Promise<void> {
    try {
      const locale = LOCALES[
        Math.floor(Math.random() * LOCALES.length)
      ] as Locale;
      const externalRef = `${locale}/generated_${Date.now()}_${this.counter++}`;
      const ticket = this.tickets.create({
        externalRef,
        locale,
        status: TicketStatus.AVAILABLE,
        payload: {
          title: 'Auto-generated review item',
          category: 'generated',
          priority: 'medium',
          submittedBy: 'generator',
          content: 'Synthetic ticket created to simulate continuous ingestion.',
        },
      });
      const saved = await this.tickets.save(ticket);
      this.cache.invalidate(`available:${locale}`);
      this.cache.invalidate('metrics');
      this.events.emit({
        type: 'ticket.available',
        locale,
        ticketId: saved.id,
      });
    } catch (error) {
      this.logger.error('Ticket generation failed', error as Error);
    }
  }
}
