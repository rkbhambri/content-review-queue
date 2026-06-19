/**
 * Supported review locales. String values intentionally match the ticket
 * seed folder names (tickets/<locale>/*.json) so ingestion stays declarative.
 */
export enum Locale {
  WEST_COAST = 'west-coast',
  EAST_COAST = 'east-coast',
  MIDWEST = 'midwest',
  SOUTH = 'south',
}

export const LOCALES: Locale[] = Object.values(Locale);

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as string[]).includes(value);
