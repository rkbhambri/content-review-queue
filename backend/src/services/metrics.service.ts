import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, Ticket } from '@/entities';
import { LOCALES, ReservationStatus, TicketStatus } from '@/enums';
import { IMetricsSummary } from '@/interfaces';
import { InMemoryCacheService } from './cache.service';

@Injectable()
export class MetricsService {
  private readonly cacheTtlMs: number;

  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
    private readonly cache: InMemoryCacheService,
    config: ConfigService,
  ) {
    this.cacheTtlMs = config.get<number>('cache.ttlMs', 3000);
  }

  /** Queue-health snapshot. Cached briefly since it aggregates over all rows. */
  async getSummary(): Promise<IMetricsSummary> {
    return this.cache.wrap('metrics:summary', this.cacheTtlMs, () =>
      this.compute(),
    );
  }

  private async compute(): Promise<IMetricsSummary> {
    const ticketRows = await this.tickets
      .createQueryBuilder('t')
      .select('t.locale', 'locale')
      .addSelect('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.locale')
      .addGroupBy('t.status')
      .getRawMany<{ locale: string; status: string; count: string }>();

    const reservationRows = await this.reservations
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus = this.zero(Object.values(TicketStatus));
    const byLocale: Record<string, Record<string, number>> = {};
    for (const locale of LOCALES) {
      byLocale[locale] = this.zero(Object.values(TicketStatus));
    }

    let ticketTotal = 0;
    for (const row of ticketRows) {
      const count = Number(row.count);
      ticketTotal += count;
      byStatus[row.status] = (byStatus[row.status] ?? 0) + count;
      byLocale[row.locale] =
        byLocale[row.locale] ?? this.zero(Object.values(TicketStatus));
      byLocale[row.locale][row.status] = count;
    }

    const reservationByStatus = this.zero(Object.values(ReservationStatus));
    let reservationTotal = 0;
    for (const row of reservationRows) {
      const count = Number(row.count);
      reservationTotal += count;
      reservationByStatus[row.status] = count;
    }

    return {
      generatedAt: new Date().toISOString(),
      tickets: { total: ticketTotal, byStatus, byLocale },
      reservations: { total: reservationTotal, byStatus: reservationByStatus },
    };
  }

  private zero(keys: string[]): Record<string, number> {
    return keys.reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
  }
}
