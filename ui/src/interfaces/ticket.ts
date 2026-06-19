import { Locale, ReservationStatus, TicketStatus } from '@/types';

export interface ITicket {
  id: string;
  externalRef: string;
  locale: Locale;
  status: TicketStatus;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface IReservation {
  id: string;
  status: ReservationStatus;
  reservedAt: string;
  expiresAt: string;
  confirmedAt: string | null;
}

export interface IReservationResult {
  ticket: ITicket;
  reservation: IReservation;
}

/** A ticket currently held by the signed-in reviewer (UI-side state). */
export interface IHeld {
  ticket: ITicket;
  reservation: IReservation;
  confirmed: boolean;
}
