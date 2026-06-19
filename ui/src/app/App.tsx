import { useCallback, useEffect, useState } from 'react';
import {
  confirmTicket,
  getActiveHolds,
  getAvailableTickets,
  getMetrics,
  login as loginRequest,
  reserveTicket,
} from '@/apis';
import { Login, HeldCard, MetricsPanel, TicketCard } from '@/components';
import { LOCALES } from '@/constants';
import { useNow, useTicketStream } from '@/hooks';
import {
  IHeld,
  IMetricsSummary,
  ISession,
  ITicket,
} from '@/interfaces';
import { Locale } from '@/types';
import { clearSession, getSession, setSession } from '@/utilities';

export function App() {
  const [session, setSessionState] = useState<ISession | null>(getSession);
  const [available, setAvailable] = useState<ITicket[]>([]);
  const [held, setHeld] = useState<IHeld[]>([]);
  const [metrics, setMetrics] = useState<IMetricsSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = useNow();

  const token = session?.token ?? null;
  const localeLabel = session
    ? LOCALES.find(option => option.value === session.reviewer.locale)?.label
    : '';

  const flash = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
    setAvailable([]);
    setHeld([]);
    setMetrics(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [tickets, summary, holds] = await Promise.all([
        getAvailableTickets(),
        getMetrics(),
        getActiveHolds(),
      ]);
      setAvailable(tickets);
      setMetrics(summary);
      // Server is the source of truth for holds, so they survive a refresh.
      setHeld(
        holds.map(hold => ({
          ...hold,
          confirmed: hold.reservation.status === 'confirmed',
        })),
      );
    } catch {
      // A 401 clears the session in the axios layer; reflect that here.
      if (!getSession()) logout();
    }
  }, [token, logout]);

  useTicketStream(token, () => void refresh());

  // Initial load whenever a session is established.
  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);

  const login = async (reviewerId: string, locale: Locale) => {
    const result = await loginRequest(reviewerId, locale);
    const next: ISession = { token: result.accessToken, reviewer: result.reviewer };
    setSession(next);
    setSessionState(next);
    void refresh();
  };

  const reserve = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      const result = await reserveTicket(id);
      setHeld(prev => [
        { ...result, confirmed: false },
        ...prev.filter(item => item.ticket.id !== id),
      ]);
      setAvailable(prev => prev.filter(ticket => ticket.id !== id));
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not reserve');
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  const confirm = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      const result = await confirmTicket(id);
      setHeld(prev =>
        prev.map(item =>
          item.ticket.id === id
            ? { ...item, confirmed: true, reservation: result.reservation }
            : item,
        ),
      );
      void refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not confirm');
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (!session) {
    return (
      <div className="page center">
        <Login onLogin={login} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <strong>Content Review Queue</strong>
          <span className="muted">
            {' '}
            · {session.reviewer.reviewerId} · {localeLabel}
          </span>
        </div>
        <button className="ghost" onClick={logout}>
          Sign out
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <main className="layout">
        <section>
          <h2>
            Available tickets <span className="count">{available.length}</span>
          </h2>
          {available.length === 0 && (
            <p className="muted">No tickets available right now. New ones appear live.</p>
          )}
          <div className="grid">
            {available.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onReserve={reserve}
                busy={busyId === ticket.id}
              />
            ))}
          </div>
        </section>

        <aside>
          <h2>
            Your holds <span className="count">{held.length}</span>
          </h2>
          {held.length === 0 && (
            <p className="muted">Reserve a ticket to start the 20-minute timer.</p>
          )}
          <div className="grid">
            {held.map(item => (
              <HeldCard
                key={item.ticket.id}
                held={item}
                now={now}
                onConfirm={confirm}
                busy={busyId === item.ticket.id}
              />
            ))}
          </div>
          <MetricsPanel metrics={metrics} />
        </aside>
      </main>
    </div>
  );
}
