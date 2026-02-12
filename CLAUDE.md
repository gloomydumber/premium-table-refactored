# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Handoff

**Read `HANDOFF.md` at the start of every session.** It contains decisions made, bugs fixed, and architectural invariants that must be preserved. **Update `HANDOFF.md` before closing every session** with what was done and any new issues discovered.

## Build & Dev Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # TypeScript compile (tsc -b) + Vite production build
npm run lint       # ESLint flat config across all .ts/.tsx files
npm run preview    # Preview production build locally
```

No test framework is configured. Verification is manual: open dev server, confirm WebSocket connections, live price streaming, sorting, pin/expand, and premium color display.

## Project Overview

Refactored version of `../teamlvr-wireframe-premium-table`. Multi-exchange crypto arbitrage premium table showing live price differentials between any two exchange markets (not just Upbit-Binance).

**Stack:** React 18 + TypeScript (strict) + Vite 6 (SWC) + MUI 7 (dark theme, Emotion) + Jotai + react-virtuoso + react-use-websocket

**Key difference from original:** The original hardcodes Upbit KRW vs Binance USDT with 23 ticker pairs. This refactor introduces an `ExchangeAdapter` abstraction so any CEX pair can be compared, and tickers are dynamically computed as the intersection of both markets.

## Architecture

### Data Flow

```
User selects CEX pair + stablecoin → marketPairAtom
                                        │
                            WebSocketProvider reads it
                           ┌────────────┴────────────┐
                   useExchangeWebSocket(A)    useExchangeWebSocket(B)
                           │                         │
                   ExchangeAdapter.parseMessage() → NormalizedTick
                           └────────────┬────────────┘
                                        ▼
                              marketData.ts
                         (module-level Maps + RAF batch)
                                        │
                     ┌──────────────────┼──────────────────┐
                rowMapAtom         tickersAtom        crossRateAtom
                     │                  │             (separate path,
                     │                  │              NOT in RAF batch)
                     └────────┬─────────┘                  │
                     sortedTickersAtom (derived) ──────────┘
                              │
                    ArbitrageTable (reads sorted list only)
                              │
                    MainRowByTicker ← rowAtomFamily(ticker) + crossRateAtom
                              │          (computes premium at render time)
                    MemoMainRow (per-row re-render, flash on price change only)
```

### "Market" vs "Exchange"

The comparison unit is **market vs market**, where a market = (exchange, quoteCurrency):
- Upbit has one market: KRW
- Binance has multiple: USDT, USDC
- The table compares one market against another; column headers are dynamic (e.g., "UPBIT (KRW)" vs "BINANCE (USDT)")

### Exchange Adapter Pattern

`src/exchanges/types.ts` defines the `ExchangeAdapter` interface. Each adapter provides: WebSocket URL generation, subscribe message format, message parsing (→ `NormalizedTick`), available tickers per quote currency, and symbol normalization (e.g., `KRW-BTC` → `BTC`, `BTCUSDT` → `BTC`).

Adding a new exchange = implement one adapter file + register it. No new hooks or components needed.

### State Management (Jotai)

- `rowMapAtom` — Record<string, MarketRow> with price data (NO premium — premium is derived)
- `tickersAtom` — string[] of known tickers
- `crossRateAtom` — cross-rate between quote currencies (decoupled from rowMapAtom to prevent all-rows re-render)
- `sortedTickersAtom` — **derived** read-only atom with referential stability (selectAtom + array equality)
- `rowAtomFamily(ticker)` — per-row atoms so only changed rows re-render
- `pinnedAtom`, `openRowsAtom`, `mutedAtom` — pin/expand/mute state in Jotai (not local useState)
- `wsReadyStateAAtom`, `wsReadyStateBAtom` — WebSocket connection readyState for each exchange
- `marketPairAtom` — active MarketPair config (adapters, common tickers, cross-rate config)

**Critical rule:** `ArbitrageTable` reads `sortedTickersAtom` (string[]) only, never `rowMapAtom` directly.

### RAF Batching (marketData.ts)

Module-level Maps absorb every WebSocket message at O(1). `requestAnimationFrame` coalesces all pending updates into one React state flush per frame. This handles 500-1000+ messages/sec from Binance trade streams without blocking the main thread.

### Premium Calculation

```
premium = (priceA / (priceB × crossRate)) - 1
```

Cross-rate converts between quote currencies. Fallback hierarchy:
1. **Direct pair** — e.g., Upbit `KRW-USDT` ticker (best accuracy)
2. **Multi-hop** — chain through intermediate currency
3. **BTC-derived** — `crossRate = BTC_priceA / BTC_priceB` (BTC row shows ~0% premium)
4. **Fixed 1** — same quote currency on both sides (e.g., KRW vs KRW)

### Row Sorting

Priority: expanded pinned → pinned → normal (|premium| descending) → muted (|premium| descending) → insertion id ascending.

### UI Structure

Two-level tab navigation: outer tabs select CEX pair (e.g., Upbit-Binance), inner tabs select stablecoin/quote currency (e.g., USDT, USDC). Korean-vs-Korean pairs have no inner tabs (both KRW).

## Key Implementation Details

- **Flash animation cleanup:** `MainRow` useEffect for price flash (100ms timeout) must return cleanup to prevent firing after Virtuoso unmounts/recycles the node. Also includes Virtuoso recycling guard (`prevTickerRef`) to prevent spurious flashes when sort order changes.
- **Price formatting:** `formatPrice(price, quoteCurrency)` in `src/utils/format.ts` — displays the raw exchange value with no rounding or truncation (`maximumFractionDigits: 20`).
- **Theme:** `createTheme()` must be outside the component body (static dark theme).
- **react-virtuoso constraint:** No native collapsible rows. Only pinned rows can expand to show wallet status detail.
- **Wallet status:** Currently randomly generated per ticker (placeholder for future server API).

## Reference Project

The original PoC lives at `../teamlvr-wireframe-premium-table`. Copy structure, types, and logic as needed but apply the fixes from `REFACTORING_PLAN.md`. Key files to reference: `store/marketData.ts` (RAF pattern), `hooks/useWebSocketHandler.ts` (clean WS wrapper), `ArbitrageTable` component structure.

## Implementation Plan

`REFACTORING_PLAN.md` in the repo root contains the full 10-phase blueprint. Read it before making architectural changes.

## TypeScript

Strict mode with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`. Target ES2020. `src/backup/` excluded from build.
