import { apiGet } from '@/utilities';
import { IMetricsSummary } from '@/interfaces';
import { METRICS_API_URLS } from './urls';

export const getMetrics = (): Promise<IMetricsSummary> =>
  apiGet<IMetricsSummary>(METRICS_API_URLS.summary);
