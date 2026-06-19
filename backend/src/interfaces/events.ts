import { Locale } from '@/enums';
import { QueueEventType } from '@/types';

/** A domain event broadcast to SSE subscribers. */
export interface IQueueEvent {
  type: QueueEventType;
  locale: Locale;
  ticketId: string;
  reviewerId?: string;
  at: string;
}

/** Shape Nest serializes for an SSE message. */
export interface ISseMessage {
  type: QueueEventType | 'heartbeat';
  data: string;
}
