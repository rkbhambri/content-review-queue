import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ticket } from '@/entities';
import { LOCALES, Locale, TicketStatus } from '@/enums';

/**
 * Ingestion strategy: file-system source of truth.
 *
 * Tickets live as JSON under `tickets/<locale>/*.json`. On boot we read those
 * files and insert any that are not yet present (keyed by a stable
 * `externalRef` = "<locale>/<filename>"). This keeps ingestion declarative and
 * idempotent: re-running never duplicates, and adding a file adds a ticket.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get<boolean>('ingestion.seedOnBoot', true)) {
      this.logger.log('SEED_ON_BOOT disabled; skipping ingestion');
      return;
    }
    await this.ingestFromFiles();
  }

  async ingestFromFiles(): Promise<number> {
    const baseDir = this.resolveTicketsDir();
    if (!baseDir) {
      this.logger.warn('No tickets/ directory found; nothing to ingest');
      return 0;
    }

    const parsed = this.readTicketFiles(baseDir);
    if (parsed.length === 0) return 0;

    const refs = parsed.map(ticket => ticket.externalRef);
    const existing = await this.tickets.find({
      where: { externalRef: In(refs) },
      select: { externalRef: true },
    });
    const known = new Set(existing.map(ticket => ticket.externalRef));

    const toInsert = parsed
      .filter(ticket => !known.has(ticket.externalRef))
      .map(ticket =>
        this.tickets.create({
          externalRef: ticket.externalRef,
          locale: ticket.locale,
          status: TicketStatus.AVAILABLE,
          payload: ticket.payload,
        }),
      );

    if (toInsert.length > 0) {
      await this.tickets.save(toInsert);
      this.logger.log(
        `Ingested ${toInsert.length} new ticket(s) from ${baseDir}`,
      );
    } else {
      this.logger.log('Tickets already up to date; nothing new to ingest');
    }
    return toInsert.length;
  }

  private readTicketFiles(baseDir: string): Array<{
    externalRef: string;
    locale: Locale;
    payload: Record<string, unknown>;
  }> {
    const results: Array<{
      externalRef: string;
      locale: Locale;
      payload: Record<string, unknown>;
    }> = [];

    for (const locale of LOCALES) {
      const localeDir = join(baseDir, locale);
      if (!existsSync(localeDir)) continue;

      for (const file of readdirSync(localeDir)) {
        if (!file.endsWith('.json')) continue;
        const fullPath = join(localeDir, file);
        try {
          const payload = JSON.parse(readFileSync(fullPath, 'utf-8')) as Record<
            string,
            unknown
          >;
          const name = file.replace(/\.json$/, '');
          results.push({ externalRef: `${locale}/${name}`, locale, payload });
        } catch (error) {
          this.logger.error(
            `Failed to parse ${fullPath}: ${(error as Error).message}`,
          );
        }
      }
    }
    return results;
  }

  /** Look for the tickets directory in the likely runtime locations. */
  private resolveTicketsDir(): string | null {
    const candidates = [
      join(process.cwd(), 'tickets'),
      join(__dirname, '..', '..', 'tickets'),
    ];
    return candidates.find(dir => existsSync(dir)) ?? null;
  }
}
