import { useEffect } from 'react';
import { buildTicketStreamUrl } from '@/apis';
import { TICKET_EVENTS } from '@/constants';

/**
 * Subscribes to the locale-scoped SSE stream while a token is present and calls
 * `onEvent` whenever a ticket event arrives. Reconnection is handled by the
 * browser's native EventSource.
 */
export function useTicketStream(token: string | null, onEvent: () => void): void {
  useEffect(() => {
    if (!token) return;

    const source = new EventSource(buildTicketStreamUrl(token));
    const handler = () => onEvent();
    TICKET_EVENTS.forEach(event => source.addEventListener(event, handler));

    return () => source.close();
  }, [token, onEvent]);
}
