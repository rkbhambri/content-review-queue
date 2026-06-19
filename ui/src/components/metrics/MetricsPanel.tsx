import { IMetricsPanelProps } from '@/interfaces';

export function MetricsPanel({ metrics }: IMetricsPanelProps) {
  if (!metrics) return null;
  const tickets = metrics.tickets.byStatus;
  const reservations = metrics.reservations.byStatus;

  const stats: { label: string; value: number }[] = [
    { label: 'Available', value: tickets.available ?? 0 },
    { label: 'Reserved', value: tickets.reserved ?? 0 },
    { label: 'Confirmed', value: tickets.confirmed ?? 0 },
    { label: 'Active holds', value: reservations.active ?? 0 },
    { label: 'Expired holds', value: reservations.expired ?? 0 },
  ];

  return (
    <div className="card metrics">
      <h2>Queue metrics</h2>
      <div className="metric-grid">
        {stats.map(stat => (
          <div key={stat.label} className="metric">
            <span className="metric-value">{stat.value}</span>
            <span className="metric-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
