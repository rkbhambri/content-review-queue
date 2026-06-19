import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '@/entities';
import { TicketStatus } from '@/enums';
import { IAuthUser } from '@/interfaces';
import { ReservationDto, ReservationResultDto, TicketDto } from '@/dtos';
import { InMemoryCacheService } from './cache.service';
import { ReservationsService } from './reservations.service';

@Injectable()
export class TicketsService {
  private readonly cacheTtlMs: number;

  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    private readonly reservations: ReservationsService,
    private readonly cache: InMemoryCacheService,
    config: ConfigService,
  ) {
    this.cacheTtlMs = config.get<number>('cache.ttlMs', 3000);
  }

  /**
   * Available tickets for the reviewer's locale only. A lazy expiry sweep runs
   * first so a freshly-lapsed reservation re-appears immediately even between
   * reaper cycles; the result is then served from a short-lived per-locale
   * cache to keep this hot path cheap.
   */
  async listAvailable(user: IAuthUser): Promise<TicketDto[]> {
    await this.reservations.releaseExpired();

    return this.cache.wrap(
      `available:${user.locale}`,
      this.cacheTtlMs,
      async () => {
        const rows = await this.tickets.find({
          where: { locale: user.locale, status: TicketStatus.AVAILABLE },
          order: { createdAt: 'ASC' },
        });
        return rows.map(TicketDto.from);
      },
    );
  }

  /**
   * The reviewer's active holds (active or confirmed), assembled into response
   * DTOs so the UI can restore them after a refresh.
   */
  async listActiveHeld(user: IAuthUser): Promise<ReservationResultDto[]> {
    const held = await this.reservations.listHeld(user);
    return held.map(({ ticket, reservation }) => ({
      ticket: TicketDto.from(ticket),
      reservation: ReservationDto.from(reservation),
    }));
  }
}
