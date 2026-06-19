import { Reservation, Ticket } from '@/entities';

/** Result of a reserve/confirm transition: the ticket plus its reservation. */
export interface IReservationOutcome {
  ticket: Ticket;
  reservation: Reservation;
}
