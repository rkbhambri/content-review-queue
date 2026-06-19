import { Locale } from '@/types';
import { IHeld, ITicket } from './ticket';
import { IMetricsSummary } from './metrics';

export interface ILoginProps {
  onLogin: (reviewerId: string, locale: Locale) => Promise<void>;
}

export interface ITicketCardProps {
  ticket: ITicket;
  onReserve: (id: string) => void;
  busy: boolean;
}

export interface IHeldCardProps {
  held: IHeld;
  now: number;
  onConfirm: (id: string) => void;
  busy: boolean;
}

export interface IMetricsPanelProps {
  metrics: IMetricsSummary | null;
}
