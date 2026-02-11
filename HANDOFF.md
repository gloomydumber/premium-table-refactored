# HANDOFF.md

Session handoff notes. Read this at the start of every session. Update it before closing.

Last updated: 2026-02-11

---

## Completed This Session

### 1. Dynamic Ticker Fetching from Exchange REST APIs

Both adapters previously hardcoded only 23 tickers. Now they fetch full lists from REST APIs at startup, with the hardcoded lists as synchronous fallback for instant render.

**Files changed:**

- `vite.config.ts` — Added dev proxy `/api/upbit` → `https://api.upbit.com` (Upbit REST has CORS restrictions)
- `src/exchanges/types.ts` — Added optional `fetchAvailableTickers?(quoteCurrency: string): Promise<string[]>` to `ExchangeAdapter` interface
- `src/exchanges/adapters/upbit.ts` — `fetchAvailableTickers('KRW')` fetches `/api/upbit/v1/market/all`, filters `KRW-` prefix, caches in module-level variable. `getAvailableTickers` returns cache if populated, else hardcoded fallback.
- `src/exchanges/adapters/binance.ts` — `fetchAvailableTickers` uses `https://data-api.binance.vision/api/v3/exchangeInfo` (CORS-friendly). Caches per quote currency. **Also switched WS from URL-encoded streams to subscribe-based**: `getWebSocketUrl` returns base URL `wss://stream.binance.com:9443/ws`, `getSubscribeMessage` sends `{ method: 'SUBSCRIBE', params: [...], id: 1 }`. This avoids URL length limits with 100+ tickers.
- `src/exchanges/pair.ts` — Added `fetchCommonTickers()` async function (calls both adapters' `fetchAvailableTickers`, intersects results)
- `src/store/marketPairAtom.ts` — Added `initMarketPairAsync()` that fetches dynamic tickers and updates atom if more tickers found than fallback
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — Calls `initMarketPairAsync` on first mount. Table renders immediately with 23 fallback tickers, re-renders with full set (~80-120) once REST APIs respond.
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Tab change handlers render immediately with sync data, then fetch dynamic tickers in background
- `src/hooks/useWebSocketHandler.ts` — Removed `didSubscribeRef` guard; subscribe callback re-fires when its identity changes (needed because tickers expand after REST fetch, requiring re-subscription on the existing WS connection)

### 2. Cross-Rate Decoupled from Row Data Path (Performance Fix)

**Problem:** `updateCrossRate()` marked ALL tickers as pending on every KRW-USDT trade. Since `premium = priceA / (priceB * crossRate) - 1`, premium changes for every row when cross-rate moves. This created new `MarketRow` objects for all 100+ rows, causing `selectAtom` to emit for every row, every `MemoMainRow` to re-render simultaneously, and accumulated price changes to flash in sync.

**Solution:** Premium is no longer stored in `MarketRow`. Cross-rate lives in its own `crossRateAtom`. Premium is computed at the render layer.

**Files changed:**

- `src/types/market.ts` — Removed `premium` field from `MarketRow`
- `src/store/marketAtoms.ts` — Added `crossRateAtom`. Added `calcPremium()` helper. `sortedTickersAtom` computes premium inline from `crossRateAtom` + row prices. Wrapped in `selectAtom` with array equality for referential stability (same sort order = same reference = no ArbitrageTable re-render).
- `src/store/marketData.ts` — `updateCrossRate()` sets `crossRateAtom` via setter, does NOT touch `pendingTickers`. Removed `calculatePremium()`. `upsertRow` has shallow equality check (prices only). `initMarketData` and `clearMarketData` accept `setCrossRate` parameter.
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — Passes `setCrossRate` (from `useSetAtom(crossRateAtom)`) to `initMarketData`/`clearMarketData`
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — `MainRowByTicker` reads `crossRateAtom`, computes premium via `calcPremium()`, passes as prop
- `src/components/ArbitrageTable/Row/MainRow.tsx` — Accepts `premium` as separate prop. `areEqual` compares `formatPremium()` strings (tiny cross-rate fluctuations that don't change the displayed value skip re-render)

### 3. Virtuoso Recycling Flash Bug Fix

**Problem:** When sort order changes, Virtuoso reuses the same `MemoMainRow` component instance for a different ticker. Internal refs (`prevPriceARef`) held the OLD ticker's price. New ticker's price looked like a "change" causing spurious flash on all repositioned rows simultaneously.

**Fix in `MainRow.tsx`:**
- Ref reset during render: when `row.ticker` changes, `prevPriceARef`/`prevPriceBRef` are immediately reset to new row's prices. Subsequent `useEffect([row.priceA])` sees equal values, no flash.
- `useEffect([row.ticker])` clears stale `flashA`/`flashB` state and pending timeouts from old ticker.

### 4. Price Formatting — Raw Exchange Values

**Problem:** `formatPrice()` was rounding/truncating exchange responses. KRW >= 1 was `Math.round()`'d, USDT >= 1 got `maximumFractionDigits: 2`.

**Fix:** `formatPrice()` now uses `maximumFractionDigits: 20` — displays exactly what the exchange sent, no rounding/trimming.

---

## Architecture Decisions to Preserve

1. **Premium is derived, not stored.** `MarketRow` has NO `premium` field. Premium is computed at the render layer from `crossRateAtom` + `row.priceA` + `row.priceB`. This is critical for per-row isolation. DO NOT add premium back to MarketRow.

2. **Cross-rate is decoupled.** `crossRateAtom` is a separate Jotai atom. `updateCrossRate()` only sets this atom — it never touches `pendingTickers` or `rowMapAtom`. Breaking this coupling will re-introduce the all-rows-flash-at-once bug.

3. **`sortedTickersAtom` has referential stability.** It's wrapped in `selectAtom` with element-wise array equality. If sort order doesn't change, the same reference is returned. Removing this causes ArbitrageTable to re-render on every cross-rate tick.

4. **Binance WS is subscribe-based** (not URL-encoded streams). The URL is always `wss://stream.binance.com:9443/ws`. Subscriptions are sent via `getSubscribeMessage`. `useWebSocketHandler` re-fires subscribe when the callback identity changes (tickers expand after REST fetch).

5. **Price formatting must preserve raw exchange values.** No rounding, no toFixed, no truncation. `maximumFractionDigits: 20`.

6. **Virtuoso recycling guard in MainRow.** `prevTickerRef` detects when the component is reused for a different ticker and resets price refs + flash state. Without this, sort-order changes cause spurious flashes.

---

## Known Issues / Future Work

- **Upbit REST proxy** (`/api/upbit` in vite.config.ts) only works in dev. Production deployment needs a real proxy or backend endpoint.
- **Wallet status** is still randomly generated per ticker (placeholder). Needs actual server API.
- **No test framework** configured. Verification is manual.
- **Sort order instability:** Premium-based sorting can cause rapid row swaps when prices fluctuate. Consider debouncing sort updates or adding a minimum delta threshold.
- **Binance `exchangeInfo` payload** is large (~1.5MB). Consider caching it or using a lighter endpoint if available.
- **`useWebSocketHandler` re-subscribe:** When tickers expand (REST fetch completes), ALL tickers are re-subscribed including already-subscribed ones. Binance handles duplicates gracefully, but an incremental subscribe (new tickers only) would be cleaner.
