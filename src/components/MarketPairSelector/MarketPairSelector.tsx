import { useAtom } from 'jotai';
import { Box, Tabs, Tab } from '@mui/material';
import { marketPairAtom } from '../../store/marketPairAtom';
import { resolveCommonTickers, fetchCommonTickers } from '../../exchanges/pair';
import type { MarketPair, CrossRateConfig } from '../../exchanges/pair';
import type { ExchangeAdapter } from '../../exchanges/types';
import { upbitAdapter, binanceAdapter } from '../../exchanges/adapters';

interface CexPairConfig {
  label: string;
  adapterA: ExchangeAdapter;
  adapterB: ExchangeAdapter;
}

const AVAILABLE_CEX_PAIRS: CexPairConfig[] = [
  { label: 'Upbit-Binance', adapterA: upbitAdapter, adapterB: binanceAdapter },
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

const tabSx = {
  minHeight: 22,
  minWidth: 0,
  px: 0.5,
  py: 0,
  fontSize: '0.7rem',
  textTransform: 'uppercase' as const,
  fontFamily: 'inherit',
  color: 'rgba(0, 255, 0, 0.4) !important',
  '&.Mui-selected': { color: '#00ff00 !important' },
};

const innerTabSx = {
  ...tabSx,
  minHeight: 20,
  fontSize: '0.65rem',
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

  const handleCexChange = (_: React.SyntheticEvent, index: number) => {
    const config = AVAILABLE_CEX_PAIRS[index];
    const isKoreanA = config.adapterA.availableQuoteCurrencies.includes('KRW');
    const stables = getAvailableStablecoins(config.adapterA, config.adapterB);
    const quoteCurrencyA = isKoreanA ? 'KRW' : (stables[0] ?? 'USDT');
    const quoteCurrencyB = isKoreanA ? (stables[0] ?? 'USDT') : quoteCurrencyA;

    // Render immediately with sync fallback
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

    // Then fetch full dynamic list in background
    fetchCommonTickers(config.adapterA, quoteCurrencyA, config.adapterB, quoteCurrencyB)
      .then(dynamicTickers => {
        if (dynamicTickers.length > commonTickers.length) {
          setPair({ ...basePair, commonTickers: dynamicTickers });
        }
      });
  };

  const handleStablecoinChange = (_: React.SyntheticEvent, index: number) => {
    const selectedStablecoin = stablecoins[index];
    const isKoreanA = cexConfig.adapterA.availableQuoteCurrencies.includes('KRW');
    const quoteCurrencyA = isKoreanA ? 'KRW' : selectedStablecoin;
    const quoteCurrencyB = isKoreanA ? selectedStablecoin : quoteCurrencyA;

    // Render immediately with sync fallback
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

    // Then fetch full dynamic list in background
    fetchCommonTickers(cexConfig.adapterA, quoteCurrencyA, cexConfig.adapterB, quoteCurrencyB)
      .then(dynamicTickers => {
        if (dynamicTickers.length > commonTickers.length) {
          setPair({ ...basePair, commonTickers: dynamicTickers });
        }
      });
  };

  return (
    <Box>
      <Tabs
        value={currentCexIndex >= 0 ? currentCexIndex : 0}
        onChange={handleCexChange}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 22,
          '& .MuiTabs-indicator': { backgroundColor: '#00ff00', height: '1px' },
        }}
      >
        {AVAILABLE_CEX_PAIRS.map((config) => (
          <Tab key={config.label} label={config.label} sx={tabSx} />
        ))}
      </Tabs>

      {stablecoins.length > 0 && (
        <Tabs
          value={stablecoinIndex >= 0 ? stablecoinIndex : 0}
          onChange={handleStablecoinChange}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 20,
            '& .MuiTabs-indicator': { backgroundColor: '#00ff00', height: '1px' },
          }}
        >
          {stablecoins.map((sc) => (
            <Tab key={sc} label={sc} sx={innerTabSx} />
          ))}
        </Tabs>
      )}
    </Box>
  );
}
