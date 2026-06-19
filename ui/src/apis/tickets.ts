import { apiGet, apiPost } from '@/utilities';
import { API_BASE } from '@/constants';
import { IReservationResult, ITicket } from '@/interfaces';
import { TICKETS_API_URLS } from './urls';

export const getAvailableTickets = (): Promise<ITicket[]> =>
  apiGet<ITicket[]>(TICKETS_API_URLS.available);

export const getActiveHolds = (): Promise<IReservationResult[]> =>
  apiGet<IReservationResult[]>(TICKETS_API_URLS.active);

export const reserveTicket = (id: string): Promise<IReservationResult> =>
  apiPost<IReservationResult>(TICKETS_API_URLS.reserve(id));

export const confirmTicket = (id: string): Promise<IReservationResult> =>
  apiPost<IReservationResult>(TICKETS_API_URLS.confirm(id));

/**
 * SSE URL for the live stream. EventSource cannot set headers, so the JWT is
 * passed as a query parameter (the backend accepts it there for this route).
 */
export const buildTicketStreamUrl = (token: string): string =>
  `${API_BASE}${TICKETS_API_URLS.stream}?access_token=${encodeURIComponent(token)}`;
