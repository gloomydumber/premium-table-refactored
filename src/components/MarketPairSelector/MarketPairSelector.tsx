import { useAtom, useSetAtom } from 'jotai';
import { Box, Tabs, Tab, Select, MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { marketPairAtom } from '../../store/marketPairAtom';
import { filterAtom } from '../../store/marketAtoms';
import { resolveCommonTickers, fetchCommonTickers } from '../../exchanges/pair';
import type { MarketPair, CrossRateConfig } from '../../exchanges/pair';
import type { ExchangeAdapter } from '../../exchanges/types';
import { upbitAdapter, binanceAdapter, bybitAdapter, bithumbAdapter, okxAdapter, coinbaseAdapter } from '../../exchanges/adapters';
import { TickerFilter } from './TickerFilter';

interface CexPairConfig {
  label: string;
  adapterA: ExchangeAdapter;
  adapterB: ExchangeAdapter;
}

const AVAILABLE_CEX_PAIRS: CexPairConfig[] = [
  { label: 'Upbit – Binance', adapterA: upbitAdapter, adapterB: binanceAdapter },
  { label: 'Upbit – Bithumb', adapterA: upbitAdapter, adapterB: bithumbAdapter },
  { label: 'Upbit – Bybit', adapterA: upbitAdapter, adapterB: bybitAdapter },
  { label: 'Upbit – Coinbase', adapterA: upbitAdapter, adapterB: coinbaseAdapter },
  { label: 'Upbit – OKX', adapterA: upbitAdapter, adapterB: okxAdapter },
  { label: 'Bithumb – Binance', adapterA: bithumbAdapter, adapterB: binanceAdapter },
  { label: 'Bithumb – Bybit', adapterA: bithumbAdapter, adapterB: bybitAdapter },
  { label: 'Bithumb – Coinbase', adapterA: bithumbAdapter, adapterB: coinbaseAdapter },
  { label: 'Bithumb – OKX', adapterA: bithumbAdapter, adapterB: okxAdapter },
  { label: 'Binance – Bybit', adapterA: binanceAdapter, adapterB: bybitAdapter },
  { label: 'Binance – Coinbase', adapterA: binanceAdapter, adapterB: coinbaseAdapter },
  { label: 'Binance – OKX', adapterA: binanceAdapter, adapterB: okxAdapter },
  { label: 'Bybit – Coinbase', adapterA: bybitAdapter, adapterB: coinbaseAdapter },
  { label: 'Bybit – OKX', adapterA: bybitAdapter, adapterB: okxAdapter },
  { label: 'Coinbase – OKX', adapterA: coinbaseAdapter, adapterB: okxAdapter },
];

function getAvailableStablecoins(adapterA: ExchangeAdapter, adapterB: ExchangeAdapter): string[] {
  const isKoreanA = adapterA.availableQuoteCurrencies.includes('KRW');
  const isKoreanB = adapterB.availableQuoteCurrencies.includes('KRW');

  if (isKoreanA && isKoreanB) return [];
  if (isKoreanA) return adapterB.availableQuoteCurrencies;
  if (isKoreanB) return adapterA.availableQuoteCurrencies;

  const setB = new Set(adapterB.availableQuoteCurrencies);
  return adapterA.availableQuoteCurrencies.filter(q => setB.has(q));
}

function buildCrossRateConfig(
  adapterA: ExchangeAdapter,
  quoteCurrencyA: string,
  quoteCurrencyB: string,
): CrossRateConfig {
  if (quoteCurrencyA === quoteCurrencyB) return { type: 'fixed', rate: 1 };
  if (quoteCurrencyA === 'KRW' && (quoteCurrencyB === 'USDT' || quoteCurrencyB === 'USDC')) {
    return { type: 'ticker', exchangeId: adapterA.id, code: `KRW-${quoteCurrencyB}` };
  }
  return { type: 'btc-derived' };
}

/** Short exchange names for the compact selected-value display */
const SHORT_NAMES: Record<string, string> = {
  Upbit: 'UP',
  Binance: 'BN',
  Bybit: 'BY',
  Bithumb: 'BT',
  OKX: 'OK',
  Coinbase: 'CB',
};

function renderCexLabel(val: number | '') {
  if (val === '') return '';
  const cfg = AVAILABLE_CEX_PAIRS[val];
  if (!cfg) return '';
  const a = SHORT_NAMES[cfg.adapterA.name] ?? cfg.adapterA.name;
  const b = SHORT_NAMES[cfg.adapterB.name] ?? cfg.adapterB.name;
  return `${a}–${b}`;
}

const innerTabSx = {
  minHeight: 20,
  minWidth: 0,
  px: 0.5,
  py: 0,
  fontSize: '0.65rem',
  textTransform: 'uppercase' as const,
  fontFamily: 'inherit',
  color: 'text.secondary',
  '&.Mui-selected': { color: 'primary.main' },
};

export function MarketPairSelector() {
  const [pair, setPair] = useAtom(marketPairAtom);
  const setFilter = useSetAtom(filterAtom);

  const currentCexIndex = AVAILABLE_CEX_PAIRS.findIndex(
    p => p.adapterA.id === pair.adapterA.id && p.adapterB.id === pair.adapterB.id,
  );

  const cexConfig = AVAILABLE_CEX_PAIRS[currentCexIndex >= 0 ? currentCexIndex : 0];
  const stablecoins = getAvailableStablecoins(cexConfig.adapterA, cexConfig.adapterB);
  const currentStablecoin = pair.marketB.quoteCurrency;
  const stablecoinIndex = stablecoins.indexOf(currentStablecoin);

  const applyCexPair = (index: number) => {
    const config = AVAILABLE_CEX_PAIRS[index];
    const isKoreanA = config.adapterA.availableQuoteCurrencies.includes('KRW');
    const isKoreanB = config.adapterB.availableQuoteCurrencies.includes('KRW');
    const stables = getAvailableStablecoins(config.adapterA, config.adapterB);
    const quoteCurrencyA = isKoreanA ? 'KRW' : (stables[0] ?? 'USDT');
    const quoteCurrencyB = isKoreanB ? 'KRW' : (stables[0] ?? 'USDT');

    const commonTickers = resolveCommonTickers(
      config.adapterA.getAvailableTickers(quoteCurrencyA),
      config.adapterB.getAvailableTickers(quoteCurrencyB),
    );

    const basePair: MarketPair = {
      marketA: { exchangeId: config.adapterA.id, quoteCurrency: quoteCurrencyA },
      marketB: { exchangeId: config.adapterB.id, quoteCurrency: quoteCurrencyB },
      adapterA: config.adapterA,
      adapterB: config.adapterB,
      commonTickers,
      crossRateSource: buildCrossRateConfig(config.adapterA, quoteCurrencyA, quoteCurrencyB),
    };
    setPair(basePair);

    fetchCommonTickers(config.adapterA, quoteCurrencyA, config.adapterB, quoteCurrencyB)
      .then(dynamicTickers => {
        if (dynamicTickers.length > commonTickers.length) {
          setPair({ ...basePair, commonTickers: dynamicTickers });
        }
      });
  };

  const handleCexChange = (event: SelectChangeEvent<number>) => {
    setFilter('');
    applyCexPair(event.target.value as number);
    // Remove focus highlight after selection
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleStablecoinChange = (_: React.SyntheticEvent, index: number) => {
    setFilter('');
    const selectedStablecoin = stablecoins[index];
    const isKoreanA = cexConfig.adapterA.availableQuoteCurrencies.includes('KRW');
    const quoteCurrencyA = isKoreanA ? 'KRW' : selectedStablecoin;
    const quoteCurrencyB = isKoreanA ? selectedStablecoin : quoteCurrencyA;

    const commonTickers = resolveCommonTickers(
      cexConfig.adapterA.getAvailableTickers(quoteCurrencyA),
      cexConfig.adapterB.getAvailableTickers(quoteCurrencyB),
    );

    const basePair: MarketPair = {
      ...pair,
      marketB: { ...pair.marketB, quoteCurrency: quoteCurrencyB },
      marketA: { ...pair.marketA, quoteCurrency: quoteCurrencyA },
      commonTickers,
      crossRateSource: buildCrossRateConfig(cexConfig.adapterA, quoteCurrencyA, quoteCurrencyB),
    };
    setPair(basePair);

    fetchCommonTickers(cexConfig.adapterA, quoteCurrencyA, cexConfig.adapterB, quoteCurrencyB)
      .then(dynamicTickers => {
        if (dynamicTickers.length > commonTickers.length) {
          setPair({ ...basePair, commonTickers: dynamicTickers });
        }
      });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: '4px', alignItems: 'center', height: 18, flexShrink: 0 }}>
      <Select
        value={currentCexIndex >= 0 ? currentCexIndex : 0}
        onChange={handleCexChange}
        renderValue={renderCexLabel}
        size="small"
        variant="outlined"
        sx={{
          flex: '0 0 auto',
          fontFamily: 'inherit',
          fontSize: '0.6rem',
          color: 'primary.main',
          height: 18,
          '& .MuiSelect-select': {
            py: '1px',
            px: '6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'divider',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'text.secondary',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'divider',
          },
          '& .MuiSvgIcon-root': {
            color: 'text.secondary',
            fontSize: '0.85rem',
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              '& .MuiMenuItem-root': {
                fontFamily: 'inherit',
                fontSize: '0.7rem',
                color: 'text.primary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  bgcolor: 'action.selected',
                },
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              },
            },
          },
        }}
      >
        {AVAILABLE_CEX_PAIRS.map((config, i) => (
          <MenuItem key={config.label} value={i}>{config.label}</MenuItem>
        ))}
      </Select>
      <TickerFilter />
      </Box>

      <Tabs
        value={stablecoins.length > 0 ? (stablecoinIndex >= 0 ? stablecoinIndex : 0) : 0}
        onChange={stablecoins.length > 0 ? handleStablecoinChange : undefined}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 20,
          '& .MuiTabs-indicator': { backgroundColor: 'primary.main', height: '1px' },
        }}
      >
        {stablecoins.length > 0
          ? stablecoins.map((sc) => (
              <Tab key={sc} label={sc} sx={innerTabSx} />
            ))
          : <Tab label="KRW" sx={innerTabSx} />
        }
      </Tabs>
    </Box>
  );
}
