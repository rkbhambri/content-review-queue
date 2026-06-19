import { IHeldCardProps } from '@/interfaces';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function HeldCard({ held, now, onConfirm, busy }: IHeldCardProps) {
  const payload = held.ticket.payload as { title?: string };
  const remaining = new Date(held.reservation.expiresAt).getTime() - now;
  const expired = remaining <= 0 && !held.confirmed;
  const urgent = !held.confirmed && remaining > 0 && remaining < 60_000;

  return (
    <div className={`card held ${held.confirmed ? 'confirmed' : expired ? 'expired' : ''}`}>
      <div className="ticket-head">
        <span className="ref">{held.ticket.externalRef}</span>
        {held.confirmed ? (
          <span className="badge ok">confirmed</span>
        ) : expired ? (
          <span className="badge danger">expired</span>
        ) : (
          <span className={`badge ${urgent ? 'danger' : 'timer'}`}>
            {formatRemaining(remaining)}
          </span>
        )}
      </div>
      <h3>{payload.title ?? 'Untitled ticket'}</h3>
      {!held.confirmed && !expired && (
        <button onClick={() => onConfirm(held.ticket.id)} disabled={busy}>
          Confirm processing
        </button>
      )}
      {held.confirmed && <p className="muted">You are processing this ticket.</p>}
      {expired && <p className="muted">Reservation lapsed; the ticket was re-queued.</p>}
    </div>
  );
}
