# Premium Table Refactored — Implementation Plan

This document is the full blueprint for rebuilding the crypto arbitrage premium table from the original `teamlvr-wireframe-premium-table` project. The new Claude Code instance should read this file first and implement phase by phase.

**Original project location:** `../teamlvr-wireframe-premium-table`
**Reference it freely** — copy structure, types, and logic as needed, but fix every issue listed below.

---

## Scope & Vision

The original project is a **Proof of Concept** with two hardcoded constraints:

1. **23 hardcoded ticker pairs** — The real product should render **all double-listed tickers** between any two exchanges, not a hand-picked 23.
2. **Upbit-Binance only** — The real product should support **any CEX-CEX exchange pair**. The architecture must abstract exchange-specific logic (WebSocket URLs, message formats, ticker naming conventions, quote currencies) behind a common interface so adding a new exchange is implementing an adapter, not rewriting the data pipeline.

> **Distant future note (DEX-CEX):** DEX-CEX arbitrage pairs are a potential future direction but are out of scope. DEXs require on-chain RPC/subgraph queries, different latency profiles, and gas cost modeling that fundamentally differ from CEX WebSocket streams. Just noting this for architectural awareness — do not design for it now.

**For this refactor:** Implement the exchange adapter abstraction and the multi-exchange data model, but the **initial concrete implementation** will still be Upbit + Binance as the first adapter pair. The architecture should make adding Bybit, OKX, Bithumb, Coinone, etc. straightforward.

---

## Tech Stack (same as original)

- React 18 + TypeScript (strict)
- Vite + SWC
- MUI 6 (dark theme, Emotion)
- Jotai (atomic state)
- react-virtuoso (virtual scrolling)
- react-use-websocket

---

## Phase 1: Project Scaffolding

**Important:** This project must be initialized with Vite. The current directory (`premium-table-refactored`) already exists but is empty except for this plan file. Scaffold directly into it.

1. Run Vite scaffolding **inside this directory**:
   ```bash
   npm create vite@latest . -- --template react-swc-ts
   ```
   - This uses the `react-swc-ts` template (React + TypeScript + SWC for fast compilation).
   - If prompted about the directory not being empty, proceed — the only existing file is this `REFACTORING_PLAN.md`.
2. Install base dependencies:
   ```bash
   npm install
   ```
3. Install project-specific dependencies:
   ```bash
   npm install @emotion/react @emotion/styled @mui/material @mui/icons-material jotai react-virtuoso react-use-websocket
   ```
4. Copy over ESLint flat config from original (`../teamlvr-wireframe-premium-table/eslint.config.js`) — it's clean, no changes needed.
5. Copy `tsconfig.app.json` strict settings (noUnusedLocals, noUnusedParameters, etc.) from the original.
6. **Do NOT copy** `src/backup/`, `src/examples/`, `src/mock/`, `src/data/` — all dead code.
7. **Do NOT install** `chance` or `@radix-ui/react-slot` — unused in the refactored project.
8. Verify `npm run build` and `npm run lint` pass with the default Vite template app before proceeding.

---

## Phase 2: Exchange Adapter Abstraction & Types

### Key Concept: "Market" vs "Exchange"

The unit of comparison is **not** "exchange vs exchange" — it's **"market vs market"**.

A **market** is an (exchange, quote currency) pair:
- Upbit has one market: `KRW` (all Korean exchanges trade against KRW)
- Binance has multiple markets: `USDT`, `USDC` (formerly `BUSD`)
- Bybit has: `USDT`, `USDC`
- OKX has: `USDT`, `USDC`

The same base ticker (BTC) can exist on multiple markets within the same exchange, with different prices and liquidity:
- Binance BTC/USDT ≠ Binance BTC/USDC (slight price difference, different liquidity)

The table compares **one market vs another market**. The user selects which two markets to compare (e.g., "Upbit KRW" vs "Binance USDT"). The UI must display the actual quote currency alongside prices.

### 2a. Exchange adapter interface

Create `src/exchanges/types.ts`:

```ts
/** Unique exchange identifier */
export type ExchangeId = string; // e.g., 'upbit', 'binance', 'bybit', 'okx', 'bithumb'

/** A specific market on an exchange: (exchange, quote currency) */
export interface MarketId {
  exchangeId: ExchangeId;
  quoteCurrency: string; // 'KRW', 'USDT', 'USDC', etc.
}

/** What an exchange adapter must provide */
export interface ExchangeAdapter {
  /** Unique identifier */
  id: ExchangeId;

  /** Display name for UI (e.g., "Upbit", "Binance") */
  name: string;

  /**
   * Quote currencies (markets) available on this exchange.
   * Korean CEXes: ['KRW'] — simple, single market.
   * Global CEXes: ['USDT', 'USDC'] — multiple stablecoin markets,
   *   each with different liquidity. Include only stablecoins with
   *   sufficient liquidity (criteria TBD).
   */
  availableQuoteCurrencies: string[];

  /**
   * WebSocket endpoint URL for a specific quote currency market.
   * Different markets may use different WS endpoints or stream formats.
   */
  getWebSocketUrl(quoteCurrency: string, tickers: string[]): string;

  /**
   * Build the subscription message to send after WS connects (if needed).
   * Upbit requires this; Binance encodes subscriptions in the URL.
   */
  getSubscribeMessage?(quoteCurrency: string, tickers: string[]): string;

  /**
   * Parse a raw WS message into a normalized price update, or null if irrelevant.
   * Must return the quote currency so the caller knows which market this tick belongs to.
   */
  parseMessage(data: unknown): NormalizedTick | null;

  /**
   * List all base tickers available for a specific quote currency market.
   * e.g., Binance USDT market has ~400 tickers, USDC market has ~50.
   * For PoC: can be a hardcoded array.
   * Future: fetch from REST API (e.g., GET /api/v3/exchangeInfo).
   */
  getAvailableTickers(quoteCurrency: string): string[] | Promise<string[]>;

  /**
   * Convert exchange-specific ticker symbol to a canonical base symbol.
   * e.g., Upbit "KRW-BTC" → "BTC", Binance "BTCUSDT" → "BTC"
   */
  normalizeSymbol(rawSymbol: string): string;
}

/** Normalized price tick — common output from any exchange adapter */
export interface NormalizedTick {
  ticker: string;        // Canonical base symbol: "BTC", "ETH", etc.
  price: number;         // Price in the specified quote currency
  quoteCurrency: string; // "KRW", "USDT", "USDC", etc.
}
```

### 2b. Market pair & common tickers

A **market pair** is the unit of comparison. The table renders only base tickers listed on **both** markets.

Create `src/exchanges/pair.ts`:

```ts
import type { ExchangeAdapter, MarketId } from './types';

/** Two specific markets being compared */
export interface MarketPair {
  /** Market A: e.g., { exchangeId: 'upbit', quoteCurrency: 'KRW' } */
  marketA: MarketId;
  /** Market B: e.g., { exchangeId: 'binance', quoteCurrency: 'USDT' } */
  marketB: MarketId;

  /** The exchange adapter instances */
  adapterA: ExchangeAdapter;
  adapterB: ExchangeAdapter;

  /** Base tickers listed on BOTH markets — the intersection */
  commonTickers: string[];

  /**
   * Cross-rate between the two quote currencies.
   * - KRW vs USDT: need USDT-KRW rate (fetched from Upbit KRW-USDT ticker)
   * - USDT vs USDC: cross-rate ≈ 1.0 (but not exactly, track it)
   * - KRW vs KRW: cross-rate = 1 (comparing two Korean exchanges)
   */
  crossRateSource: CrossRateConfig;
}

export type CrossRateConfig =
  | { type: 'fixed'; rate: 1 }                          // Same quote currency (KRW vs KRW)
  | { type: 'ticker'; exchangeId: string; code: string } // e.g., Upbit KRW-USDT ticker
  | { type: 'approximate'; rate: number };               // Stablecoin-to-stablecoin (≈1.0)

/**
 * Compute the intersection of base tickers available on both markets.
 */
export function resolveCommonTickers(
  tickersA: string[],
  tickersB: string[],
): string[] {
  const setB = new Set(tickersB);
  return tickersA.filter(t => setB.has(t));
}
```

**Cross-rate examples:**

| Market A | Market B | Cross-rate |
|---|---|---|
| Upbit KRW | Binance USDT | USDT-KRW rate from Upbit `KRW-USDT` ticker (~1,450) |
| Upbit KRW | Binance USDC | USDC-KRW rate (could derive from KRW-USDC or KRW-USDT × USDT/USDC) |
| Bithumb KRW | Upbit KRW | Fixed `1` — same quote currency |
| Binance USDT | Bybit USDT | Fixed `1` — same quote currency |
| Binance USDT | OKX USDC | ~1.0 but should be tracked for accuracy |

### 2c. Concrete adapters (initial: Upbit + Binance)

```
src/exchanges/
  ├── types.ts              # ExchangeAdapter, MarketId, NormalizedTick
  ├── pair.ts               # MarketPair, CrossRateConfig, resolveCommonTickers
  └── adapters/
      ├── upbit.ts          # UpbitAdapter: availableQuoteCurrencies: ['KRW']
      ├── binance.ts        # BinanceAdapter: availableQuoteCurrencies: ['USDT', 'USDC']
      └── index.ts          # Registry: export all adapters
```

**Upbit adapter specifics:**
- Single market: `KRW`
- WS: `wss://api.upbit.com/websocket/v1` + subscription message
- Message format: Blob → JSON with `cd` (code) and `tp` (trade price) in SIMPLE format
- Symbol normalization: `KRW-BTC` → `BTC`
- Special ticker: `KRW-USDT` provides the cross-rate for KRW↔USDT conversion

**Binance adapter specifics:**
- Multiple markets: `['USDT', 'USDC']` (add others with sufficient liquidity as identified)
- WS: Combined stream URL differs by quote currency
  - USDT: `wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/...`
  - USDC: `wss://stream.binance.com:9443/stream?streams=btcusdc@trade/ethusdc@trade/...`
- Message format: JSON with nested `data.s` (symbol), `data.p` (price)
- Symbol normalization: `BTCUSDT` → `BTC`, `BTCUSDC` → `BTC` (strip quote suffix)
- Different ticker sets per market — USDC market has far fewer pairs than USDT

The current 23 hardcoded pairs are **PoC only**. Each adapter should list **all** tickers available on that market, and `resolveCommonTickers` computes the rendered set.

### 2d. Domain types (market-pair-aware)

Create `src/types/market.ts`:

```ts
export interface WalletStatus {
  networkName: string;
  marketA: { deposit: boolean; withdraw: boolean };
  marketB: { deposit: boolean; withdraw: boolean };
}

export interface MarketRow {
  id: number;
  ticker: string;         // Canonical base symbol: "BTC", "ETH"
  priceA: number;         // Price on market A (in A's quote currency)
  priceB: number;         // Price on market B (in B's quote currency)
  premium: number;        // Calculated: (priceA / priceB / crossRate) - 1
  walletStatus: WalletStatus[];
  isPinned: boolean;
}
```

**Important:** `priceA`/`priceB` are stored as raw numbers in each market's native quote currency. The **UI** is responsible for displaying them with the correct currency label and formatting. The active `MarketPair` (from `marketPairAtom`) provides the quote currency strings for column headers and `formatPrice()`.

**UI column headers** are dynamic based on the active market pair:

| With Upbit-KRW vs Binance-USDT | With Bithumb-KRW vs Upbit-KRW |
|---|---|
| TICKER \| UPBIT (KRW) \| BINANCE (USDT) \| PREMIUM | TICKER \| BITHUMB (KRW) \| UPBIT (KRW) \| PREMIUM |

---

## Phase 3: State Management (Jotai) — Fix the Core Performance Problem

### Problem in original

`ArbitrageTable` calls `useAtomValue(rowMapAtom)` directly (line 136), subscribing to the **entire map**. Every price tick from either WebSocket triggers a re-render of the parent component, which then re-sorts and re-creates the `virtualRows` array. This defeats the per-row atom optimization.

### Fix: Derived sorted-tickers atom

```
src/store/
  ├── marketAtoms.ts     — rowMapAtom, tickersAtom, rowAtomFamily, sortedTickersAtom, pinnedAtom, openRowsAtom
  ├── marketData.ts      — module-level price maps, RAF batch flush (exchange-aware)
  └── marketPairAtom.ts — active MarketPair config atom
```

> **Why RAF for batching?** `requestAnimationFrame` is the correct scheduling mechanism here.
> WebSocket messages from Binance `@trade` streams can arrive at 500-1000+/sec across all pairs.
> With multiple exchanges active, this volume multiplies further.
> The module-level Maps absorb every message (O(1) per write), and RAF coalesces
> all pending updates into a single React state flush synchronized with the browser's paint cycle.
> Unlike `setTimeout`, RAF guarantees zero wasted frames — every state update is immediately
> followed by a paint. `setTimeout` would introduce arbitrary timing gaps between state update
> and paint, causing subtle visual stutter. The per-frame cost after the parent re-render fix
> (sortedTickersAtom) is minimal — only individual row components whose prices changed re-render,
> and those are just text cell updates. See the "How Real Exchanges Handle This" appendix
> at the bottom of this document for industry context.

**Key changes:**

1. **`sortedTickersAtom`** — a read-only derived atom that computes sorted tickers from `rowMapAtom` + `pinnedAtom` + `openRowsAtom`. This replaces the `useEffect` + `setSortedTickers` pattern that was running every frame.

2. **`pinnedAtom`** and **`openRowsAtom`** — move pin/expand state into Jotai atoms instead of local `useState` + `useCallback` in `ArbitrageTable`. This makes sorting reactive without the parent needing to subscribe to `rowMapAtom`.

3. **`ArbitrageTable` should only read `sortedTickersAtom`** (string[]) — never `rowMapAtom` directly. Individual `MainRowByTicker` components read their own `rowAtomFamily(ticker)`.

4. **Remove legacy atoms entirely** — no `upbitDataAtom`, `binanceDataAtom`, `serverDataAtom`, `atoms.types.ts`. The `createRafBatcher` calls that feed these are dead code.

5. **`marketPairAtom`** — stores the active `ExchangePair` config (which two exchanges, their adapters, the resolved common tickers). When the user switches exchange pairs in the future, this atom changes and the entire data pipeline reconnects.

### State model changes for multi-exchange

The original `marketData.ts` uses `krwPriceByTicker` and `usdPriceByTicker` — hardcoded to two specific exchanges. Refactor to market-keyed storage:

```ts
/** Key: "exchangeId:quoteCurrency" (e.g., "binance:USDT", "upbit:KRW") */
type MarketKey = string;

// Price storage keyed by market, not exchange
const pricesByMarket = new Map<MarketKey, Map<string, number>>();
// e.g., pricesByMarket.get('upbit:KRW').get('BTC')     → 142_500_000
// e.g., pricesByMarket.get('binance:USDT').get('BTC')   → 96_432.5
// e.g., pricesByMarket.get('binance:USDC').get('BTC')   → 96_430.0

// Cross-rate: units of quoteCurrencyA per 1 unit of quoteCurrencyB
// e.g., KRW vs USDT → ~1,450 (1 USDT = 1,450 KRW)
// e.g., USDT vs USDC → ~1.0001
// e.g., KRW vs KRW  → 1 (same currency, no conversion)
let crossRate = 0;
```

The `MarketRow` uses `priceA`/`priceB` to store raw prices in each market's native quote currency. The UI displays these with the actual currency label (KRW, USDT, etc.) from the active `MarketPair`.

### Sorting logic (preserve from original)

Priority: expanded pinned → pinned → |premium| descending → insertion id ascending.

---

## Phase 4: WebSocket Layer — Generic Exchange Connection

### Problem in original

- WebSocket hooks are exchange-specific (`useUpbitWebSocket`, `useBinanceWebSocket`) with hardcoded URLs, message formats, and ticker lists.
- WebSocket hooks write to both legacy atoms (via `createRafBatcher`) and active atoms (via `marketData.ts`). The legacy path is dead.
- `WebSocketStatus` component is mounted in production, reads dead atoms, logs to console.
- Adding a new exchange means writing an entirely new hook from scratch.

### Fix: Generic `useExchangeWebSocket` hook

Instead of one hook per exchange, create a single generic hook that takes an `ExchangeAdapter` and wires it to `marketData.ts`:

```
src/hooks/
  ├── useWebSocketHandler.ts      — keep as-is, it's clean
  └── useExchangeWebSocket.ts     — NEW: generic hook driven by ExchangeAdapter
      (remove createRafBatcher.ts — only fed dead atoms)
      (remove useInterval.ts — unused)

src/components/WebSocketProvider/
  ├── WebSocketProvider.tsx       — reads marketPairAtom, spawns two useExchangeWebSocket
  └── index.ts
      (remove useUpbitWebSocket.ts — replaced by generic hook + UpbitAdapter)
      (remove useBinanceWebSocket.ts — replaced by generic hook + BinanceAdapter)
```

**`useExchangeWebSocket(adapter, tickers)`** should:
1. Call `adapter.getWebSocketUrl(tickers)` for the WS endpoint
2. Call `adapter.getSubscribeMessage?.(tickers)` for the subscription message (if needed)
3. On each message, call `adapter.parseMessage(data)` to get a `NormalizedTick | null`
4. If non-null, call `updatePrice(adapter.id, tick.ticker, tick.price, ...)` in `marketData.ts`
5. Handle cross-rate tickers (e.g., USDT-KRW) via the adapter's normalization

**`WebSocketProvider`** becomes:
```ts
function WebSocketProvider() {
  const pair = useAtomValue(marketPairAtom);
  useExchangeWebSocket(pair.exchangeA, pair.commonTickers);
  useExchangeWebSocket(pair.exchangeB, pair.commonTickers);
  return null;
}
```

Adding a new exchange (e.g., Bybit) now requires only:
1. Implement `BybitAdapter` in `src/exchanges/adapters/bybit.ts`
2. Register it in the adapter index
3. Select it as part of an exchange pair — no new hooks, no new components

**Remove entirely:**
- `WebSocketStatus.tsx` — dead code
- `createRafBatcher.ts` — fed dead atoms
- `useInterval.ts` — unused
- `useUpbitWebSocket.ts` / `useBinanceWebSocket.ts` — replaced by generic hook

---

## Phase 5: marketData.ts — Market-Aware Module-Level Logic

The original `marketData.ts` pattern is well-designed (module-level Maps + RAF flush). Keep the same architecture but make it market-agnostic.

### Keep
- Module-level `Map`s for price storage and ticker IDs
- `pendingTickers` Set + `scheduleFlush` via `requestAnimationFrame`
- `upsertRow` pattern for atomic row updates

### Change

**Price storage** — replace `krwPriceByTicker` / `usdPriceByTicker` with market-keyed maps:
```ts
const pricesByMarket = new Map<MarketKey, Map<string, number>>();
```

**`updatePrice(marketKey, ticker, price, ...)`** — single generic function replacing `updateUpbitPrice` / `updateBinancePrice`. The function writes to `pricesByMarket.get(marketKey)` and adds the ticker to `pendingTickers`.

### Cross-Rate: How It Works

The cross-rate converts between two different quote currencies so the premium can be calculated.

The cross-rate source follows a **fallback hierarchy** — use the best available method:

#### Priority 1: Direct currency pair (no circularity)

A dedicated quote-vs-quote trading pair on one of the exchanges.

| Market A quote | Market B quote | Source | Example value |
|---|---|---|---|
| KRW | USDT | Upbit `KRW-USDT` (live WS) | ~1,450 |
| KRW | USDC | Upbit `KRW-USDC` (live WS, if listed) | ~1,449 |
| USDT | USDC | Binance `USDCUSDT` (live WS) | ~1.0001 |
| KRW | KRW | Fixed `1` | 1 |
| USDT | USDT | Fixed `1` | 1 |

This is the ideal case — the cross-rate is fully independent of any base ticker in the table, so all premiums are accurate.

#### Priority 2: Multi-hop through available pairs

When no direct pair exists, chain through an intermediate currency.

Example: KRW vs BUSD (Upbit has no `KRW-BUSD` pair)
- Hop 1: `KRW-USDT` rate from Upbit → 1,450
- Hop 2: `BUSDUSDT` rate from Binance → 0.9998
- Result: `KRW/BUSD = 1,450 × 0.9998 ≈ 1,449.7`

This works only if both intermediate pairs exist with sufficient liquidity.

#### Priority 3: BTC-derived (fallback when no currency pair path exists)

When neither a direct pair nor a multi-hop path is available, derive the cross-rate from **BTC** — the highest-liquidity base ticker on every exchange:

```
crossRate = BTC price on Market A / BTC price on Market B
```

Example: KRW vs BUSD (if no BUSD/USDT pair available either)
- BTC on Upbit KRW = 142,500,000
- BTC on Binance BUSD = 96,432
- Implied crossRate = 142,500,000 / 96,432 ≈ 1,477.5

**Tradeoff:** BTC's premium will always read ~0% (since the cross-rate is derived from BTC itself). All other tickers' premiums are measured relative to BTC's implied rate. This is acceptable because:
- This is what arbitrage traders actually do — BTC's rate is treated as the baseline
- BTC has the deepest liquidity on every exchange, so its implied rate is the least distorted by thin order books
- The circularity only affects BTC's row; all other rows remain meaningful

**The UI should indicate which cross-rate method is active** (future enhancement) so the user understands why BTC shows ~0% premium when in fallback mode.

#### CrossRateConfig (updated from Phase 2b)

```ts
export type CrossRateConfig =
  | { type: 'fixed'; rate: 1 }                            // Same quote currency
  | { type: 'ticker'; exchangeId: string; code: string }  // Direct pair (e.g., Upbit KRW-USDT)
  | { type: 'multi-hop'; hops: Array<{                    // Chained through intermediate
      exchangeId: string; code: string;
    }> }
  | { type: 'btc-derived' };                               // Fallback: derive from BTC prices
```

#### Implementation

```ts
// Cross-rate handling in marketData.ts
let crossRate = 0;
let crossRateType: CrossRateConfig['type'] = 'fixed';

function updateCrossRate(price: number) {
  crossRate = price;
  // When the cross-rate changes, all tickers need premium recalculation.
  // Add all known tickers to pendingTickers and schedule flush.
}

// For 'btc-derived' mode, called after any BTC price update on either market:
function recalcBtcDerivedCrossRate() {
  const btcA = pricesByMarket.get(marketKeyA)?.get('BTC') ?? 0;
  const btcB = pricesByMarket.get(marketKeyB)?.get('BTC') ?? 0;
  if (btcA > 0 && btcB > 0) {
    updateCrossRate(btcA / btcB);
  }
}
```

For `type: 'ticker'` cross-rates (e.g., Upbit `KRW-USDT`), the `useExchangeWebSocket` hook detects the cross-rate ticker in the WS stream and calls `updateCrossRate` instead of `updatePrice`. The adapter's `parseMessage` returns this as a `NormalizedTick`, and the hook routes it based on whether the ticker matches the cross-rate config.

For `type: 'multi-hop'`, each hop is a separate WS subscription. The intermediate rates are multiplied to produce the final cross-rate.

For `type: 'btc-derived'`, no additional subscription is needed — BTC prices already flow through the normal data pipeline. After each BTC price update on either market, `recalcBtcDerivedCrossRate()` is called.

**Important:** During stablecoin depeg events (e.g., USDC at $0.87 in March 2023), cross-rates derived from Priority 1 or 2 would correctly reflect the depeg. A BTC-derived rate would not capture stablecoin-specific pricing distortion — another reason to prefer direct pairs when available.

### Premium Calculation

```ts
/**
 * Premium = how much more expensive the asset is on Market A vs Market B,
 * after normalizing both prices to the same unit via the cross-rate.
 *
 * crossRate = units of quoteCurrencyA per 1 unit of quoteCurrencyB
 *   e.g., KRW vs USDT: crossRate = 1,450 (1 USDT = 1,450 KRW)
 *
 * Formula:
 *   premium = (priceA / (priceB × crossRate)) - 1
 *
 * Examples:
 *   Upbit BTC = 142,500,000 KRW, Binance BTC = 96,432 USDT, crossRate = 1,450
 *   premium = (142,500,000 / (96,432 × 1,450)) - 1 = ~0.019 (+1.9% kimchi premium)
 *
 *   Bithumb BTC = 142,800,000 KRW, Upbit BTC = 142,500,000 KRW, crossRate = 1
 *   premium = (142,800,000 / (142,500,000 × 1)) - 1 = ~0.002 (+0.2%)
 *
 *   Binance BTC = 96,432 USDT, OKX BTC = 96,430 USDC, crossRate = 1.0001
 *   premium = (96,432 / (96,430 × 1.0001)) - 1 = ~0.00001 (~0%)
 */
function calculatePremium(ticker: string): number {
  const priceA = pricesByMarket.get(marketKeyA)?.get(ticker) ?? 0;
  const priceB = pricesByMarket.get(marketKeyB)?.get(ticker) ?? 0;
  if (priceA <= 0 || priceB <= 0 || crossRate <= 0) return 0;
  return (priceA / (priceB * crossRate)) - 1;
}
```

> **Note:** The original code's formula `krw / usd / usdtKrwPrice - 1` is mathematically equivalent to `krw / (usd × usdtKrwPrice) - 1` due to left-to-right evaluation. The refactored version uses explicit parentheses `priceA / (priceB × crossRate)` for clarity.

**`upsertRow`** — uses `priceA`/`priceB` fields, reads from `pricesByMarket` with the active market keys.

### Keep as-is
- **Wallet status generation:** Currently `getWalletStatusForTicker` generates random booleans and caches them. Keep this for now (it's a placeholder for server data), but add a clear `// PLACEHOLDER:` comment so it's obvious.

---

## Phase 6: Market Pair Selector — Two-Level Tab Navigation

### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [ Upbit-Binance ]  [ Upbit-Bybit ]  [ Bithumb-Binance ]  ... │  ← CEX pair tabs
├─────────────────────────────────────────────────────────────────┤
│  [ USDT ]  [ USDC ]  [ FDUSD ]                                 │  ← Stablecoin tabs
├──────────┬──────────────┬──────────────────┬────────────────────┤
│  TICKER  │  UPBIT (KRW) │  BINANCE (USDT)  │     PREMIUM       │
├──────────┼──────────────┼──────────────────┼────────────────────┤
│  BTC     │ 142,500,000  │ 96,432.50        │      +1.90%       │
│  ETH     │   3,200,000  │  2,180.30        │      +1.70%       │
│  ...     │              │                  │                    │
└──────────┴──────────────┴──────────────────┴────────────────────┘
```

**Outer tabs (CEX pair):** Each tab represents an exchange-vs-exchange comparison. Selecting a tab changes which two exchanges are being compared, which reconnects both WebSocket streams and recomputes the common tickers.

**Inner tabs (stablecoin):** Shows the available quote currencies for the selected CEX pair. Selecting a stablecoin tab changes which market is active on the relevant exchange side, which reconnects that exchange's WS stream and updates the cross-rate config.

### Tab behavior by CEX pair type

| CEX pair type | Outer tab example | Inner tabs show | Notes |
|---|---|---|---|
| Korean vs Global | Upbit-Binance | Global exchange's stablecoins: `USDT`, `USDC`, ... | Korean side is always KRW, no choice needed |
| Korean vs Korean | Upbit-Bithumb | **No inner tabs** — both are KRW | Cross-rate = 1, direct comparison |
| Global vs Global | Binance-Bybit | Stablecoins common to both: `USDT`, `USDC`, ... | Both sides use the same selected stablecoin, cross-rate = 1 |

For Korean-vs-Global pairs, the inner tab only controls the global exchange's quote currency. The Korean side is locked to KRW.

For Global-vs-Global pairs, the inner tab selects the same stablecoin for **both** sides (e.g., both on USDT). Cross-stablecoin comparison (Binance-USDT vs Bybit-USDC) is a potential future enhancement but adds cross-rate complexity — skip for now.

### Component structure

```
src/components/
  ├── MarketPairSelector/
  │   ├── MarketPairSelector.tsx     — outer + inner tab bar, writes to marketPairAtom
  │   ├── CexPairTabs.tsx            — outer tabs: exchange pair selection
  │   ├── StablecoinTabs.tsx         — inner tabs: quote currency selection
  │   └── index.ts
```

**State flow:**
1. `CexPairTabs` selection → determines which two `ExchangeAdapter`s are active
2. `StablecoinTabs` selection → determines which `quoteCurrency` to use on each side
3. Both write to `marketPairAtom`, which holds the full `MarketPair` config
4. `WebSocketProvider` reads `marketPairAtom` and (re)connects WS streams
5. `marketData.ts` clears stale prices and rebuilds `pricesByMarket` for the new market pair

### Available CEX pairs

The available outer tabs are derived from the registered adapters. For PoC, hardcode the pairs. Future: compute all valid pairs from the adapter registry.

```ts
// src/exchanges/pairs.ts — registered exchange pair configurations
export const AVAILABLE_CEX_PAIRS = [
  { adapterA: upbitAdapter, adapterB: binanceAdapter },   // Upbit-Binance
  // Future:
  // { adapterA: upbitAdapter, adapterB: bybitAdapter },
  // { adapterA: bithumbAdapter, adapterB: binanceAdapter },
] as const;
```

### Available stablecoins per pair

When a CEX pair is selected, the inner tabs show the intersection of available quote currencies on the relevant exchange(s):

```ts
function getAvailableStablecoins(pair: CexPair): string[] {
  const isKoreanA = pair.adapterA.availableQuoteCurrencies.includes('KRW');
  const isKoreanB = pair.adapterB.availableQuoteCurrencies.includes('KRW');

  if (isKoreanA && isKoreanB) {
    // Korean vs Korean — no stablecoin choice, both KRW
    return [];
  }
  if (isKoreanA) {
    // Korean vs Global — show global side's stablecoins
    return pair.adapterB.availableQuoteCurrencies;
  }
  if (isKoreanB) {
    // Global vs Korean — show global side's stablecoins
    return pair.adapterA.availableQuoteCurrencies;
  }
  // Global vs Global — show stablecoins common to both
  const setB = new Set(pair.adapterB.availableQuoteCurrencies);
  return pair.adapterA.availableQuoteCurrencies.filter(q => setB.has(q));
}
```

---

## Phase 7: ArbitrageTable Component — Decouple from Full Map

### Problem in original

The component is ~266 lines doing too much: reading the full row map, sorting, managing pin state, managing open/collapse state, building virtual rows, defining Virtuoso table components, AND rendering.

### Fix: Split responsibilities

```
src/components/ArbitrageTable/
  ├── ArbitrageTable.tsx          — orchestrator, reads sortedTickersAtom only
  ├── ArbitrageTable.types.ts     — remove (types moved to src/types/market.ts)
  ├── VirtuosoTableComponents.tsx — extracted Scroller, Table, TableHead, TableBody, TableRow
  ├── Row/
  │   ├── MainRow.tsx             — price cells + flash animation + arbitrage indicator
  │   ├── DetailRow.tsx           — wallet status expand table
  │   └── index.ts
  └── SkeletonRow/
      ├── SkeletonRow.tsx         — keep as-is
      └── index.ts
```

**ArbitrageTable.tsx should:**
1. Read `sortedTickersAtom` (string[]) — NOT `rowMapAtom`
2. Read `openRowsAtom` to build the `VirtualRow[]` flat list
3. Read `marketPairAtom` to get exchange names and quote currencies for dynamic column headers (e.g., "UPBIT (KRW)" / "BINANCE (USDT)")
4. Pass `toggleRow` and `handlePin` actions that write to `openRowsAtom` / `pinnedAtom` / `rowMapAtom`
5. No `useEffect` for sorting — it's a derived atom now

**VirtuosoTableComponents.tsx:**
- Extract all the `React.forwardRef` Virtuoso component overrides into their own file. This is ~40 lines of boilerplate that clutters the main component.

---

## Phase 8: Row Component Fixes

### 8a. Flash timeout cleanup

**Original bug:** `MainRow` creates `setTimeout` for price flash animation (100ms) but never cleans up on unmount. With Virtuoso recycling DOM nodes, the timeout can fire after the component unmounts.

**Fix:** Add cleanup returns to the `useEffect`s:

```ts
React.useEffect(() => {
  // ... existing flash logic ...
  return () => {
    if (krwTimeoutRef.current !== null) {
      clearTimeout(krwTimeoutRef.current);
    }
  };
}, [row.krwPrice]);
```

### 8b. Number formatting

**Original:** Prices render as raw `{row.krwPrice}` and `{row.usdPrice}` — no formatting.

**Fix:** Add formatting utilities in `src/utils/format.ts`, driven by quote currency:

```ts
/**
 * Format price based on the exchange's quote currency.
 * Each quote currency has different conventions.
 */
export function formatPrice(price: number, quoteCurrency: string): string {
  switch (quoteCurrency) {
    case 'KRW':
      // KRW: whole numbers with comma separators → "98,432,000"
      return Math.round(price).toLocaleString('ko-KR');
    case 'USDT':
    case 'USD':
      // USD/USDT: 2-8 decimals depending on magnitude → "96,432.50" or "0.00001234"
      if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    default:
      return price.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }
}

// Premium: percentage with 2 decimal places → "+1.23%" or "-0.45%"
export const formatPremium = (p: number) => `${p >= 0 ? '+' : ''}${(p * 100).toFixed(2)}%`;
```

The `MainRow` component reads the exchange pair's quote currencies from context or atom to pass to `formatPrice`.

### 8c. Typo fix

`isAribtrageable` → `isArbitrageable` (function name in Row.tsx)

### 8d. Premium background color

Keep the original `calculatePremiumBackgroundColor` logic — it works well. The opacity steps based on premium magnitude are a nice touch.

---

## Phase 9: App.tsx — Structure & Fixes

### Problem

`createTheme()` is called inside the component body on every render.

### Fix

```ts
// Move outside component — theme is static
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00ff00' },
    text: { primary: '#00ff00' },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WebSocketProvider />
      <Layout>
        <MarketPairSelector />
        <ArbitrageTable />
      </Layout>
    </ThemeProvider>
  );
}
```

---

## Phase 10: Verify & Lint

1. `npm run build` — must pass with zero errors
2. `npm run lint` — must pass clean
3. Manual verification: open dev server, confirm both WebSockets connect, prices stream, sorting works, pin/expand works, premium colors display

---

## Summary: What Gets Removed

| File/Code | Why |
|---|---|
| `src/store/atoms.ts` | Legacy atoms, nothing reads them |
| `src/store/atoms.types.ts` | Types for legacy atoms |
| `src/hooks/createRafBatcher.ts` | Only fed legacy atoms |
| `src/hooks/useInterval.ts` | Unused (was for mock server) |
| `src/components/WebSocketStatus.tsx` | Dev logger mounted in prod, reads dead atoms |
| `src/data/upbitKRWMarket.ts` | Commented out, replaced by inline lists |
| `src/mock/` | Deprecated mock server |
| `src/backup/` | Archived iterations |
| `src/examples/` | Unused example component |
| `Row` default export | Deprecated, replaced by `MemoMainRow`/`MemoDetailRow` |
| `batchRef` + `createRafBatcher` calls in WS hooks | Dead write path |
| `chance` dependency | Only used by removed mock server |
| `@radix-ui/react-slot` dependency | Never used in any component |

## Summary: What Gets Fixed

| Issue | Fix |
|---|---|
| Parent re-renders on every price tick | Derived `sortedTickersAtom` — parent reads sorted list, not full map |
| Sorting runs 60x/sec in useEffect | Sorting moves into derived atom, computed only when deps change |
| Dual atom write path (legacy + active) | Remove legacy path entirely |
| Hardcoded duplicate ticker lists | Exchange adapters provide their own ticker lists; `resolveCommonTickers` computes intersection |
| Hardcoded Upbit/Binance WebSocket logic | `ExchangeAdapter` interface + generic `useExchangeWebSocket` hook |
| `krwPrice`/`usdPrice` exchange-specific fields | Generic `priceA`/`priceB` keyed by active exchange pair |
| Flash timeout no cleanup on unmount | Add `useEffect` cleanup returns |
| No number formatting | `formatPrice(price, quoteCurrency)` driven by exchange adapter |
| `createTheme` on every render | Move theme outside component |
| 266-line monolithic ArbitrageTable | Split into ArbitrageTable + VirtuosoTableComponents |
| `isAribtrageable` typo | Rename to `isArbitrageable` |
| `WebSocketStatus` in production | Remove |

---

## File Structure (Target)

```
src/
├── App.tsx
├── main.tsx
├── vite-env.d.ts
├── exchanges/
│   ├── types.ts                      # ExchangeAdapter, NormalizedTick interfaces
│   ├── pair.ts                       # ExchangePair, resolveCommonTickers
│   └── adapters/
│       ├── upbit.ts                  # UpbitAdapter (KRW quote, Blob messages, subscription model)
│       ├── binance.ts                # BinanceAdapter (USDT quote, JSON messages, combined stream URL)
│       └── index.ts                  # Adapter registry
├── types/
│   └── market.ts                     # MarketRow (priceA/priceB), WalletStatus, ExchangePairId
├── store/
│   ├── marketAtoms.ts                # rowMapAtom, tickersAtom, rowAtomFamily,
│   │                                 # sortedTickersAtom, pinnedAtom, openRowsAtom
│   ├── marketData.ts                 # Exchange-aware price maps, RAF batch flush
│   └── marketPairAtom.ts           # Active MarketPair config (CEX pair + stablecoin selection)
├── hooks/
│   ├── useWebSocketHandler.ts        # Low-level WS hook wrapper (keep from original)
│   └── useExchangeWebSocket.ts       # Generic hook: ExchangeAdapter → marketData.ts
├── components/
│   ├── MarketPairSelector/
│   │   ├── MarketPairSelector.tsx     # Two-level tab navigation, writes to marketPairAtom
│   │   ├── CexPairTabs.tsx            # Outer tabs: exchange pair selection
│   │   ├── StablecoinTabs.tsx         # Inner tabs: quote currency selection
│   │   └── index.ts
│   ├── WebSocketProvider/
│   │   ├── WebSocketProvider.tsx      # Reads marketPairAtom, spawns 2x useExchangeWebSocket
│   │   └── index.ts
│   └── ArbitrageTable/
│       ├── ArbitrageTable.tsx         # Reads sortedTickersAtom + marketPairAtom for headers
│       ├── VirtuosoTableComponents.tsx
│       ├── Row/
│       │   ├── MainRow.tsx            # Flash animation, formatPrice(quoteCurrency), arbitrage check
│       │   ├── DetailRow.tsx          # Wallet status expand (exchange-agnostic labels)
│       │   └── index.ts
│       ├── SkeletonRow/
│       │   ├── SkeletonRow.tsx
│       │   └── index.ts
│       └── index.ts
└── utils/
    └── format.ts                      # formatPrice(price, quoteCurrency), formatPremium
```

### Adding a new exchange (e.g., Bybit)

1. Create `src/exchanges/adapters/bybit.ts` implementing `ExchangeAdapter`
2. Export it from `src/exchanges/adapters/index.ts`
3. Select it as part of an exchange pair — everything else (WS connection, data flow, rendering) works automatically

---

## Appendix: How Real Exchanges Handle This

Research into how production exchanges (Binance, Coinbase, Upbit) and industry-standard charting libraries handle high-frequency rendering on the web. This informed the RAF decision and may guide future optimization.

### The Three-Tier Architecture

Battle-tested exchange frontends separate concerns into three layers:

```
Layer 1: Web Worker          — Parse/process WebSocket messages off the main thread
Layer 2: Throttled Bridge    — postMessage() to main thread at controlled intervals
Layer 3: Rendering           — DOM or Canvas, only on main thread
```

**Layer 1 — Web Workers** offload WebSocket message parsing and data structure maintenance (order book deltas, trade aggregation) to a background thread. The main JS thread never touches raw WebSocket data. This prevents high message volume from blocking UI paint. Our current project handles this on the main thread, which is acceptable for ~23 ticker pairs but would become a bottleneck at hundreds of pairs.

**Layer 2 — Throttled Bridge** is the key insight: the Worker doesn't `postMessage()` on every WebSocket message. It accumulates changes and sends a snapshot to the main thread on a controlled interval — similar to our RAF batching, but decoupled from the render cycle. Some implementations use a timer (100-200ms), others let the main thread pull on demand.

**Layer 3 — Rendering** splits into two approaches depending on what's being rendered:

### DOM vs Canvas: It Depends on What You're Rendering

| Component | Real exchanges use | Why |
|---|---|---|
| **Charts** (candlestick, depth) | HTML5 Canvas 2D | Thousands of data points, pixel-level control, no DOM overhead |
| **Order book** (price levels) | DOM or Canvas | DOM for simple books, Canvas for ultra-high-frequency L2/L3 data |
| **Price ticker table** | DOM | Low element count, text-only, benefits from browser text rendering |
| **Trade history** | DOM with virtualization | Scrollable list, text content, CSS styling needed |

**TradingView Lightweight Charts** — the industry standard embedded by most exchanges — uses **Canvas 2D** (not WebGL). Their architecture: keep a data model in JS, render the entire chart to a `<canvas>` element on each frame. No React, no DOM diffing for chart content.

**Coinbase's order book** uses React with Redux selectors for memoized state slicing, **200ms debounce** on incoming WebSocket deltas, and limits the visible book to 25 levels. They also use the **Page Visibility API** to pause updates when the tab is backgrounded.

**Key performance discovery from production apps**: the biggest rendering bottleneck is often **CSS-in-JS** (styled-components, Emotion) recalculating styles on every re-render. Switching critical hot-path components from styled-components to inline styles or plain CSS classes can be more impactful than changing the batching strategy.

### What This Means For Our Project

Our project is a **price ticker table**. With the PoC's 23 rows this was firmly in "DOM is fine" territory. With multi-exchange support and all double-listed tickers, row counts could reach **100-300+** depending on exchange pairs. This is still DOM-appropriate — react-virtuoso handles thousands of rows — but the WebSocket message volume scales significantly.

**Scaling estimate with multi-exchange:**
- 2 exchanges × 200 common tickers × ~20 trades/sec/ticker = **~8,000 messages/sec**
- Multiple simultaneous exchange pairs (future) could push this higher

The refactored architecture addresses this:

| Concern | Production exchanges | Our project (refactored) | Status |
|---|---|---|---|
| WS processing off main thread | Web Worker | Main thread | OK for initial launch; add Worker when supporting 3+ simultaneous exchange pairs |
| Update batching | Timer or RAF in Worker | RAF in `marketData.ts` | Correct approach |
| Rendering | DOM for tables, Canvas for charts | DOM (react-virtuoso) | Correct — even at 300 rows, virtualization handles it |
| Per-row granularity | Memoized selectors / atoms | Jotai `rowAtomFamily` | Correct approach |
| Parent re-render prevention | Derived selectors only | Derived `sortedTickersAtom` | Fixed in Phase 3 |
| Exchange abstraction | Internal adapters per exchange | `ExchangeAdapter` interface | Correct approach |
| CSS-in-JS hot path | Avoid on frequently updating cells | MUI `sx` prop on flash cells | Monitor — swap to inline if needed |

### Future Optimization (Beyond This Refactor)

As the project scales:
1. **Web Worker** for WebSocket message processing — move `marketData.ts` logic into a Worker. Becomes necessary when handling 3+ exchange pairs simultaneously or 10,000+ msg/sec
2. **Canvas** for any chart/visualization components (consider TradingView Lightweight Charts)
3. **Page Visibility API** — pause WebSocket subscriptions or flush interval when tab is hidden
4. **CSS-in-JS audit** — profile whether Emotion's `sx` prop recalculation is a bottleneck on flash animation cells; if so, switch those cells to inline styles
5. **DEX-CEX pairs** — would require on-chain RPC/subgraph queries, different latency profiles, gas cost modeling, and fundamentally different data fetching patterns. Out of scope for now but the `ExchangeAdapter` interface could theoretically support it with a non-WebSocket adapter that polls on-chain data

### Sources

- [TradingView Lightweight Charts — Canvas 2D, not WebGL](https://github.com/tradingview/lightweight-charts/discussions/1192)
- [Case Study: High-Performance WebSocket App (Web Worker architecture)](https://kangzeroo.medium.com/case-study-coding-a-high-performance-web-app-2021-tutorial-da6265971753)
- [React + WebSockets Order Book (debounce + Page Visibility API)](https://www.freecodecamp.org/news/react-websockets-project-build-real-time-order-book-app/)
- [TradingView Lightweight Charts — performant financial charts with Canvas](https://github.com/tradingview/lightweight-charts)
- [Building High-Performance UI with Canvas and WebGL](https://medium.com/@beyons/building-a-high-performance-ui-framework-with-html5-canvas-and-webgl-f7628af8a3c2)
- [WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
