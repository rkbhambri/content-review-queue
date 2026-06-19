export enum ReservationStatus {
  /** Hold is live and within the TTL window. */
  ACTIVE = 'active',
  /** Reviewer confirmed in time. */
  CONFIRMED = 'confirmed',
  /** TTL elapsed without confirmation; ticket re-queued. */
  EXPIRED = 'expired',
  /** Reserved for an explicit manual release flow (future). */
  RELEASED = 'released',
}
