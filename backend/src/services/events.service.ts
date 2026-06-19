import { Injectable } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Locale } from '@/enums';
import { IQueueEvent, ISseMessage } from '@/interfaces';

/**
 * In-process pub/sub backing the SSE stream. A single RxJS Subject fans events
 * out to every connected client; each client subscription is filtered down to
 * its own locale so reviewers only ever receive events relevant to them.
 */
@Injectable()
export class EventsService {
  private readonly stream$ = new Subject<IQueueEvent>();

  emit(event: Omit<IQueueEvent, 'at'>): void {
    this.stream$.next({ ...event, at: new Date().toISOString() });
  }

  /** Locale-scoped SSE feed with a periodic heartbeat to hold the connection. */
  streamForLocale(locale: Locale): Observable<ISseMessage> {
    const events$ = this.stream$.asObservable().pipe(
      filter(event => event.locale === locale),
      map(
        (event): ISseMessage => ({
          type: event.type,
          data: JSON.stringify(event),
        }),
      ),
    );

    const heartbeat$ = interval(15_000).pipe(
      map(
        (): ISseMessage => ({
          type: 'heartbeat',
          data: JSON.stringify({ at: new Date().toISOString() }),
        }),
      ),
    );

    return merge(events$, heartbeat$);
  }
}
