export type QueueEventType =
  | 'ticket.available'
  | 'ticket.reserved'
  | 'ticket.confirmed'
  | 'ticket.released';
