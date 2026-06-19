import { QueueEventType } from '@/types';

/** localStorage key for the persisted reviewer session. */
export const SESSION_STORAGE_KEY = 'crq.session';

/** Base path the browser uses to reach the API (nginx proxies this in Docker). */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

/** SSE event names the UI reacts to by refreshing the queue. */
export const TICKET_EVENTS: QueueEventType[] = [
  'ticket.available',
  'ticket.reserved',
  'ticket.confirmed',
  'ticket.released',
];
