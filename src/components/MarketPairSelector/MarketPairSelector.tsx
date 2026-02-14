import { useAtom } from 'jotai';
import { Box, Tabs, Tab, Select, MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { marketPairAtom } from '../../store/marketPairAtom';
import { resolveCommonTickers, fetchCommonTickers } from '../../exchanges/pair';
import type { MarketPair, CrossRateConfig } from '../../exchanges/pair';
import type { ExchangeAdapter } from '../../exchanges/types';
import { upbitAdapter, binanceAdapter, bybitAdapter, bithumbAdapter, okxAdapter, coinbaseAdapter } from '../../exchanges/adapters';

interface CexPairConfig {
  label: string;
  adapterA: ExchangeAdapter;
  adapterB: ExchangeAdapter;
}

const AVAILABLE_CEX_PAIRS: CexPairConfig[] = [
  { label: 'Upbit – Bithumb', adapterA: upbitAdapter, adapterB: bithumbAdapter },
  { label: 'Upbit – Binance', adapterA: upbitAdapter, adapterB: binanceAdapter },
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

const innerTabSx = {
  minHeight: 20,
  minWidth: 0,
  px: 0.5,
  py: 0,
  fontSize: '0.65rem',
  textTransform: 'uppercase' as const,
  fontFamily: 'inherit',
  color: 'rgba(0, 255, 0, 0.4) !important',
  '&.Mui-selected': { color: '#00ff00 !important' },
};

export function MarketPairSelector() {
  const [pair, setPair] = useAtom(marketPairAtom);

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
    applyCexPair(event.target.value as number);
    // Remove focus highlight after selection
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleStablecoinChange = (_: React.SyntheticEvent, index: number) => {
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
      <Select
        value={currentCexIndex >= 0 ? currentCexIndex : 0}
        onChange={handleCexChange}
        size="small"
        variant="outlined"
        sx={{
          fontFamily: 'inherit',
          fontSize: '0.6rem',
          color: '#00ff00',
          height: 18,
          '& .MuiSelect-select': {
            py: '1px',
            px: '6px',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 255, 0, 0.3)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 255, 0, 0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(0, 255, 0, 0.3)',
          },
          '& .MuiSvgIcon-root': {
            color: 'rgba(0, 255, 0, 0.5)',
            fontSize: '0.85rem',
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              bgcolor: '#1a1a1a',
              border: '1px solid rgba(0, 255, 0, 0.3)',
              '& .MuiMenuItem-root': {
                fontFamily: 'inherit',
                fontSize: '0.7rem',
                color: 'rgba(0, 255, 0, 0.7)',
                '&.Mui-selected': {
                  color: '#00ff00',
                  bgcolor: 'rgba(0, 255, 0, 0.08)',
                },
                '&:hover': {
                  bgcolor: 'rgba(0, 255, 0, 0.12)',
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

      <Tabs
        value={stablecoins.length > 0 ? (stablecoinIndex >= 0 ? stablecoinIndex : 0) : 0}
        onChange={stablecoins.length > 0 ? handleStablecoinChange : undefined}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 20,
          '& .MuiTabs-indicator': { backgroundColor: '#00ff00', height: '1px' },
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
