export type TicketStatus = 'available' | 'reserved' | 'confirmed' | 'completed';

export type ReservationStatus = 'active' | 'confirmed' | 'expired' | 'released';

export type QueueEventType =
  | 'ticket.available'
  | 'ticket.reserved'
  | 'ticket.confirmed'
  | 'ticket.released';
