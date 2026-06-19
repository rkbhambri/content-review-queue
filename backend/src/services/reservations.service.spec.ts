import {
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { Reservation, Reviewer, Ticket } from '@/entities';
import { Locale, ReservationStatus, TicketStatus } from '@/enums';
import { IAuthUser } from '@/interfaces';
import { ClockService } from './clock.service';
import { EventsService } from './events.service';
import { InMemoryCacheService } from './cache.service';
import { ReservationsService } from './reservations.service';

/**
 * Integration tests for the core reservation/expiry logic against a real
 * Postgres (the conditional-update concurrency guarantees are Postgres
 * behavior, so they cannot be faithfully mocked).
 *
 * Enable with RUN_DB_TESTS=true and a reachable database, e.g.:
 *   docker compose up -d db
 *   RUN_DB_TESTS=true DATABASE_HOST=localhost npm test
 */
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === 'true';
const describeDb = RUN_DB_TESTS ? describe : describe.skip;

/** Controllable clock so the 20-minute window is testable without waiting. */
class FakeClock extends ClockService {
  private current = new Date('2030-01-01T00:00:00.000Z');
  now(): Date {
    return new Date(this.current);
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

const TTL_MINUTES = 20;

const fakeConfig = {
  get: (key: string, def?: unknown) =>
    key === 'reservation.ttlMinutes' ? TTL_MINUTES : def,
} as unknown as ConfigService;

describeDb('ReservationsService (integration)', () => {
  let dataSource: DataSource;
  let service: ReservationsService;
  let clock: FakeClock;
  let tickets: Repository<Ticket>;
  let reservations: Repository<Reservation>;

  const west: IAuthUser = { reviewerId: 'rev-west', locale: Locale.WEST_COAST };
  const westTwo: IAuthUser = {
    reviewerId: 'rev-west-2',
    locale: Locale.WEST_COAST,
  };
  const east: IAuthUser = { reviewerId: 'rev-east', locale: Locale.EAST_COAST };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5434),
      username: process.env.DATABASE_USER ?? 'review',
      password: process.env.DATABASE_PASSWORD ?? 'review',
      database: process.env.DATABASE_NAME ?? 'review_queue',
      entities: [Reviewer, Ticket, Reservation],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    tickets = dataSource.getRepository(Ticket);
    reservations = dataSource.getRepository(Reservation);

    clock = new FakeClock();
    service = new ReservationsService(
      dataSource,
      reservations,
      clock,
      new InMemoryCacheService(),
      new EventsService(),
      fakeConfig,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await reservations.createQueryBuilder().delete().execute();
    await tickets.createQueryBuilder().delete().execute();
  });

  const seedTicket = (locale: Locale, ref: string): Promise<Ticket> =>
    tickets.save(
      tickets.create({
        externalRef: ref,
        locale,
        status: TicketStatus.AVAILABLE,
        payload: {},
      }),
    );

  it('reserves an available ticket and sets it RESERVED', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/t1');
    const { reservation } = await service.reserve(ticket.id, west);

    expect(reservation.status).toBe(ReservationStatus.ACTIVE);
    const reloaded = await tickets.findOneByOrFail({ id: ticket.id });
    expect(reloaded.status).toBe(TicketStatus.RESERVED);
  });

  it('allows only one of two concurrent reservers to win', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/race');

    const results = await Promise.allSettled([
      service.reserve(ticket.id, west),
      service.reserve(ticket.id, westTwo),
    ]);

    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
  });

  it('forbids reserving a ticket from another locale', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/t2');
    await expect(service.reserve(ticket.id, east)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('confirms a reservation within the window', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/t3');
    await service.reserve(ticket.id, west);

    clock.advanceMinutes(TTL_MINUTES - 1);
    const { ticket: confirmed, reservation } = await service.confirm(
      ticket.id,
      west,
    );

    expect(reservation.status).toBe(ReservationStatus.CONFIRMED);
    expect(confirmed.status).toBe(TicketStatus.CONFIRMED);
  });

  it('auto-releases an unconfirmed ticket after the window', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/t4');
    await service.reserve(ticket.id, west);

    clock.advanceMinutes(TTL_MINUTES + 1);
    const released = await service.releaseExpired(clock.now());

    expect(released).toBe(1);
    const reloaded = await tickets.findOneByOrFail({ id: ticket.id });
    expect(reloaded.status).toBe(TicketStatus.AVAILABLE);
  });

  it('rejects confirmation after the window has expired', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/t5');
    await service.reserve(ticket.id, west);

    clock.advanceMinutes(TTL_MINUTES + 1);
    await service.releaseExpired(clock.now());

    await expect(service.confirm(ticket.id, west)).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('re-queues a released ticket so another reviewer can claim it', async () => {
    const ticket = await seedTicket(Locale.WEST_COAST, 'west/t6');
    await service.reserve(ticket.id, west);
    clock.advanceMinutes(TTL_MINUTES + 1);
    await service.releaseExpired(clock.now());

    const { reservation } = await service.reserve(ticket.id, westTwo);
    expect(reservation.reviewerId).toBe(westTwo.reviewerId);
  });
});
