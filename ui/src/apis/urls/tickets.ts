export const TICKETS_API_URLS = {
  available: '/tickets/available',
  active: '/tickets/active',
  reserve: (id: string) => `/tickets/${id}/reserve`,
  confirm: (id: string) => `/tickets/${id}/confirm`,
  stream: '/tickets/stream',
};
