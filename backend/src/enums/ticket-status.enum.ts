export enum TicketStatus {
  /** In the queue and claimable by a same-locale reviewer. */
  AVAILABLE = 'available',
  /** Held by a reviewer; awaiting confirmation within the TTL window. */
  RESERVED = 'reserved',
  /** Reviewer confirmed they began processing. */
  CONFIRMED = 'confirmed',
  /** Terminal state (reserved for future "done" flow). */
  COMPLETED = 'completed',
}
