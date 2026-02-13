/**
 * Centralized ticker normalization layer.
 *
 * Maps (exchangeId, exchangeSpecificName) → canonicalName so that
 * ticker intersection works correctly for any exchange pair.
 *
 * Usage in adapters:
 *   const normalizer = createTickerNormalizer('binance');
 *   normalizer.toCanonical('BEAMX')  // → 'BEAM'
 *   normalizer.toExchange('BEAM')    // → 'BEAMX'
 */

const EXCHANGE_ALIASES: Record<string, Record<string, string>> = {
  binance: { 'BEAMX': 'BEAM' },
  bybit: {},
  upbit: {},
};

export interface TickerNormalizer {
  toCanonical(exchangeTicker: string): string;
  toExchange(canonicalTicker: string): string;
}

export function createTickerNormalizer(exchangeId: string): TickerNormalizer {
  const aliases = EXCHANGE_ALIASES[exchangeId] ?? {};
  const reverseAliases: Record<string, string> = {};
  for (const [k, v] of Object.entries(aliases)) reverseAliases[v] = k;
  return {
    toCanonical: (t) => aliases[t] ?? t,
    toExchange: (t) => reverseAliases[t] ?? t,
  };
}
