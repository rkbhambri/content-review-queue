import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { Reservation, Ticket } from '@/entities';
import { Locale, ReservationStatus, TicketStatus } from '@/enums';
import { IAuthUser, IReservationOutcome } from '@/interfaces';
import { ClockService } from './clock.service';
import { EventsService } from './events.service';
import { InMemoryCacheService } from './cache.service';

/**
 * Owns every state transition for a ticket hold. All transitions are expressed
 * as *conditional* UPDATEs (e.g. "set RESERVED only where still AVAILABLE") run
 * inside a transaction. Postgres row locks make these compare-and-swap writes
 * safe under concurrency: of two racing reservers, exactly one sees
 * `affected === 1`; the loser re-reads a non-AVAILABLE row and gets a 409.
 */
@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  private readonly ttlMinutes: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
    private readonly clock: ClockService,
    private readonly cache: InMemoryCacheService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
    this.ttlMinutes = config.get<number>('reservation.ttlMinutes', 20);
  }

  /** Reserve an available ticket for the reviewer, holding it for the TTL. */
  async reserve(
    ticketId: string,
    user: IAuthUser,
  ): Promise<IReservationOutcome> {
    const outcome = await this.dataSource.transaction(async manager => {
      const claim = await manager
        .createQueryBuilder()
        .update(Ticket)
        .set({ status: TicketStatus.RESERVED })
        .where('id = :id AND status = :available AND locale = :locale', {
          id: ticketId,
          available: TicketStatus.AVAILABLE,
          locale: user.locale,
        })
        .execute();

        if (!claim.affected) {
        await this.explainFailedClaim(manager, ticketId, user.locale);
      }

      const reservation = manager.create(Reservation, {
        ticketId,
        reviewerId: user.reviewerId,
        status: ReservationStatus.ACTIVE,
        expiresAt: this.clock.inMinutes(this.ttlMinutes),
        confirmedAt: null,
      });
      await manager.save(reservation);

      const ticket = await manager.findOneOrFail(Ticket, {
        where: { id: ticketId },
      });
      return { ticket, reservation };
    });

    this.invalidate(user.locale);
    this.events.emit({
      type: 'ticket.reserved',
      locale: user.locale,
      ticketId,
      reviewerId: user.reviewerId,
    });
    return outcome;
  }

  /** Confirm a held ticket, provided the hold is still active and unexpired. */
  async confirm(
    ticketId: string,
    user: IAuthUser,
  ): Promise<IReservationOutcome> {
    const now = this.clock.now();

    const outcome = await this.dataSource.transaction(async manager => {
      const confirm = await manager
        .createQueryBuilder()
        .update(Reservation)
        .set({ status: ReservationStatus.CONFIRMED, confirmedAt: now })
        .where(
          'ticket_id = :id AND reviewer_id = :rid AND status = :active AND expires_at > :now',
          {
            id: ticketId,
            rid: user.reviewerId,
            active: ReservationStatus.ACTIVE,
            now,
          },
        )
        .execute();

      if (!confirm.affected) {
        await this.explainFailedConfirm(
          manager,
          ticketId,
          user.reviewerId,
          now,
        );
      }

      await manager.update(
        Ticket,
        { id: ticketId },
        { status: TicketStatus.CONFIRMED },
      );

      const reservation = await manager.findOneOrFail(Reservation, {
        where: {
          ticketId,
          reviewerId: user.reviewerId,
          status: ReservationStatus.CONFIRMED,
        },
        order: { reservedAt: 'DESC' },
      });
      const ticket = await manager.findOneOrFail(Ticket, {
        where: { id: ticketId },
      });
      return { ticket, reservation };
    });

    this.invalidate(user.locale);
    this.events.emit({
      type: 'ticket.confirmed',
      locale: user.locale,
      ticketId,
      reviewerId: user.reviewerId,
    });
    return outcome;
  }

  /**
   * The reviewer's current holds (active) so the UI can restore
   * them after a page refresh. Runs the lazy expiry sweep first so a lapsed
   * hold is never returned as still-held.
   */
  async listHeld(user: IAuthUser): Promise<IReservationOutcome[]> {
    await this.releaseExpired();

    const rows = await this.reservations.find({
      where: {
        reviewerId: user.reviewerId,
        status: In([ReservationStatus.ACTIVE]),
      },
      relations: { ticket: true },
      order: { reservedAt: 'DESC' },
    });

    return rows
      .filter(reservation => reservation.ticket)
      .map(reservation => ({
        ticket: reservation.ticket as Ticket,
        reservation,
      }));
  }

  /**
   * Release every reservation whose window has elapsed without confirmation,
   * re-queuing its ticket. Idempotent and safe to call from both the scheduled
   * reaper and lazily on hot read paths. Returns the count released.
   */
  async releaseExpired(
    now: Date = this.clock.now(),
    batchSize = 200,
  ): Promise<number> {
    const stale = await this.reservations.find({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: LessThanOrEqual(now),
      },
      relations: { ticket: true },
      take: batchSize,
    });
    let released = 0;
    for (const reservation of stale) {
      const didRelease = await this.dataSource.transaction(async manager => {
        const expire = await manager.update(
          Reservation,
          { id: reservation.id, status: ReservationStatus.ACTIVE },
          { status: ReservationStatus.EXPIRED },
        );
        if (!expire.affected) return false;

        // Only re-queue if the ticket is still RESERVED (never confirmed).
        await manager.update(
          Ticket,
          { id: reservation.ticketId, status: TicketStatus.RESERVED },
          { status: TicketStatus.AVAILABLE },
        );
        return true;
      });

      if (didRelease) {
        released += 1;
        const locale = reservation.ticket?.locale as Locale;
        if (locale) {
          this.invalidate(locale);
          this.events.emit({
            type: 'ticket.released',
            locale,
            ticketId: reservation.ticketId,
          });
        }
      }
    }

    if (released > 0) {
      this.logger.log(`Auto-released ${released} expired reservation(s)`);
    }
    return released;
  }

  private invalidate(locale: Locale): void {
    this.cache.invalidate(`available:${locale}`);
    this.cache.invalidate('metrics');
  }

  private async explainFailedClaim(
    manager: EntityManager,
    ticketId: string,
    locale: Locale,
  ): Promise<never> {
    const ticket = await manager.findOne(Ticket, { where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.locale !== locale) {
      throw new ForbiddenException('Ticket belongs to a different locale');
    }
    throw new ConflictException('Ticket is no longer available');
  }

  private async explainFailedConfirm(
    manager: EntityManager,
    ticketId: string,
    reviewerId: string,
    now: Date,
  ): Promise<never> {
    const reservation = await manager.findOne(Reservation, {
      where: { ticketId, reviewerId },
      order: { reservedAt: 'DESC' },
    });
    if (!reservation) {
      throw new NotFoundException('You have no reservation for this ticket');
    }
    if (reservation.status === ReservationStatus.CONFIRMED) {
      throw new ConflictException('Reservation already confirmed');
    }
    if (
      reservation.status === ReservationStatus.EXPIRED ||
      reservation.expiresAt <= now
    ) {
      throw new GoneException(
        'Reservation window expired; ticket was re-queued',
      );
    }
    throw new ConflictException('Reservation cannot be confirmed');
  }
}
