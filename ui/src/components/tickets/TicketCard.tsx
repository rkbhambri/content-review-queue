import { ITicketCardProps } from '@/interfaces';

export function TicketCard({ ticket, onReserve, busy }: ITicketCardProps) {
  const payload = ticket.payload as {
    title?: string;
    priority?: string;
    content?: string;
  };

  return (
    <div className="card ticket">
      <div className="ticket-head">
        <span className="ref">{ticket.externalRef}</span>
        {payload.priority && (
          <span className={`badge prio-${payload.priority}`}>{payload.priority}</span>
        )}
      </div>
      <h3>{payload.title ?? 'Untitled ticket'}</h3>
      {payload.content && <p className="muted">{payload.content}</p>}
      <button onClick={() => onReserve(ticket.id)} disabled={busy}>
        Reserve
      </button>
    </div>
  );
}
