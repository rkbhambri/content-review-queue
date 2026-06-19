/** Queue-health snapshot returned by GET /metrics. */
export interface IMetricsSummary {
  generatedAt: string;
  tickets: {
    total: number;
    byStatus: Record<string, number>;
    byLocale: Record<string, Record<string, number>>;
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
  };
}
