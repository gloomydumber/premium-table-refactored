# HANDOFF.md

Session handoff notes. Read this at the start of every session. Update it before closing.

Last updated: 2026-02-14

---

## Completed This Session (2026-02-14)

### Coinbase Exchange Adapter (0.2.0)

Added Coinbase as the 6th exchange adapter. Coinbase unifies USD and USDC into a single order book — `-USD` pairs have the deepest liquidity. The adapter subscribes to `-USD` pairs but displays as **USDC** in the UI.

**Coinbase API details:**
- REST: `GET https://api.exchange.coinbase.com/products` → `[{ id: "BTC-USD", base_currency: "BTC", quote_currency: "USD", status: "online", ... }]` (Exchange API, CORS-safe; Advanced Trade API blocks browser CORS). No prices in product list — WS `ticker_batch` snapshot seeds within 5s.
- WebSocket: `wss://advanced-trade-ws.coinbase.com`
- Subscribe: `{ "type": "subscribe", "product_ids": ["BTC-USD", ...], "channel": "ticker_batch" }` — all products in a single message (235 confirmed)
- Message: `{ "channel": "ticker_batch", "events": [{ "type": "snapshot"|"update", "tickers": [{ "product_id": "BTC-USD", "price": "96432.5" }] }] }`
- No heartbeat required
- Channel: `ticker_batch` (5s intervals, ~47 msg/sec for 235 products)
- Symbol format: `BTC-USD` → split on `-`, index 0 for base
- Quote currencies: `['USDC']` (maps to `-USD` pairs internally)

**Key decision:** Coinbase's USD and USDC share the same order book. Adapter exposes `USDC` as the quote currency but internally fetches/subscribes to `-USD` product IDs for deeper liquidity. `parseMessage` returns `quoteCurrency: 'USDC'` in the NormalizedTick.

**Files created:**
- `src/exchanges/adapters/coinbase.ts` — Full adapter: REST fetch (filter `quote_currency_id === 'USD'`), WS subscribe (single message, `ticker_batch` channel), parsing (`events[0].tickers[0]`), ticker/price caching, `createTickerNormalizer('coinbase')`

**Files changed:**
- `src/exchanges/tickerNormalizer.ts` — Added `coinbase: {}` to `EXCHANGE_ALIASES`
- `src/exchanges/colors.ts` — Added `Coinbase: '#FFFFFF'` (white — official blue `#0052FF` too similar to Upbit `#0A6CFF` on dark theme)
- `src/exchanges/adapters/index.ts` — Added `coinbaseAdapter` export
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Imported `coinbaseAdapter`, added 5 new CEX pairs. Reordered all 15 pairs by prefix priority: Upbit → Bithumb → Binance → Bybit → Coinbase → OKX
- `src/lib.ts` — Added `coinbaseAdapter` export
- `package.json` — Version `0.1.15` → `0.2.0` (feat: MINOR bump)

**Available pairs now (15 total):** Upbit–Bithumb, Upbit–Binance, Upbit–Bybit, Upbit–Coinbase, Upbit–OKX, Bithumb–Binance, Bithumb–Bybit, Bithumb–Coinbase, Bithumb–OKX, Binance–Bybit, Binance–Coinbase, Binance–OKX, Bybit–Coinbase, Bybit–OKX, Coinbase–OKX.

**Design decisions:**
- **CORS fix:** Coinbase Advanced Trade API (`api.coinbase.com/api/v3/brokerage/...`) blocks browser CORS. Switched to Exchange API (`api.exchange.coinbase.com/products`) which is CORS-safe. No REST price seeding — WS `ticker_batch` snapshot populates prices within 5s.
- **Color:** Official Coinbase blue `#0052FF` too similar to Upbit `#0A6CFF` on dark background. Used white `#FFFFFF` instead — Coinbase's logo is a white "C" on blue, and white is maximally distinct from all other exchange colors.
- **Pair order:** Prefix priority Upbit → Bithumb → Binance → Bybit → Coinbase → OKX (Korean domestic exchanges first).
- **`ticker_batch` sends one ticker per message.** Despite the `tickers` array wrapper in the JSON schema, Coinbase sends exactly one ticker per message. Verified empirically (30s live test via `../coinbaseWebsocketPoC/batch-size-test.js`: 59 messages, all `tickers.length=1`) and confirmed by official docs (example shows single-element array). The "batch" in `ticker_batch` refers to time aggregation (5s per product), not multi-product bundling. `events[0].tickers[0]` is correct and loses no data.
- **No `getCachedPrices` / `restPriceCache`.** The Exchange API (`api.exchange.coinbase.com/products`) doesn't return prices, so there's nothing to cache. WS snapshot seeds prices within 5s. Unlike other adapters, Coinbase adapter intentionally omits `getCachedPrices`.

### Versioning Convention Established

Documented SemVer convention in `CLAUDE.md`. Commit prefix determines version bump:
- `feat:` → MINOR (`0.1.x` → `0.2.0`)
- `fix:`, `perf:`, `refactor:` → PATCH
- `ci:`, `docs:`, `chore:` → no bump, no publish

Applied retroactively starting from next feature. Current version `0.1.15` stays as-is.

### GitHub Release Notes: Include Full Commit Body

Changed `publish.yml` release notes format from `%s` (subject only) to `%s` + `%b` (subject + body), with `Co-Authored-By:` lines stripped and consecutive blank lines collapsed.

**Files changed:**
- `.github/workflows/publish.yml` — `git log` format: `"- %s"` → `"- **%s**%n%n%b"` + sed filters

### Exchange Brand Colors for All 5 Exchanges (0.1.15)

**Problem:** The wallet status detail row (`DetailRow`) only defined brand colors for Upbit and Binance in `EXCHANGE_COLORS`. Bybit, Bithumb, and OKX fell back to `#00ff00` (lime green), making the one-way transfer gradient indistinguishable from the "both directions" green. Table header price columns also had no exchange-specific coloring.

**Fix:**
1. Extracted `EXCHANGE_COLORS` from `DetailRow.tsx` into a shared `src/exchanges/colors.ts` module
2. Added brand colors for all 5 exchanges: Upbit (blue `#0A6CFF`), Binance (gold `#F0B90B`), Bybit (teal `#00C4B3`), Bithumb (orange `#F37321`), OKX (silver `#CFD3D8`)
3. Applied exchange brand colors to the two price column `<th>` headers in `ArbitrageTable`

**Design decision:** Bybit's official brand orange was too similar to Binance's gold on a dark background. Used Bybit's secondary teal (`#00C4B3`) for clear visual separation.

**Files created:**
- `src/exchanges/colors.ts` — Shared `EXCHANGE_COLORS` constant

**Files changed:**
- `src/components/ArbitrageTable/Row/DetailRow.tsx` — Imports from shared `colors.ts` instead of defining its own map
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Imports `EXCHANGE_COLORS`, applies to price column header `sx.color`
- `README.md` — Added "Exchange Brand Colors" section with color table
- `package.json` — Version `0.1.14` → `0.1.15`

---

## Completed Previous Session (2026-02-13)

### GitHub Release notes fix

`generate_release_notes: true` in `softprops/action-gh-release@v2` only produces meaningful content from merged PRs. Since this project pushes directly to master, it only showed a "Full Changelog" link. Replaced with a custom step that extracts `git log` commit messages between the previous tag and HEAD and passes them as the `body`.

**Files changed:**
- `.github/workflows/publish.yml` — Added "Build release notes from commits" step, replaced `generate_release_notes: true` with explicit `body` from git log

### OKX Exchange Adapter (0.1.14)

Added OKX as the 5th exchange. OKX is a major global CEX with USDT and USDC spot markets.

**OKX API details:**
- REST: `GET https://www.okx.com/api/v5/market/tickers?instType=SPOT` → `{ data: [{ instId: "BTC-USDT", last: "56143.2", ... }] }`
- WebSocket: `wss://ws.okx.com:8443/ws/v5/public`
- Subscribe: `{ "op": "subscribe", "args": [{ "channel": "tickers", "instId": "BTC-USDT" }, ...] }` — batched at 25 args per message
- Message: `{ "arg": { "channel": "tickers", "instId": "BTC-USDT" }, "data": [{ "instId": "BTC-USDT", "last": "56143.2", ... }] }`
- Heartbeat: Send `"ping"` (plain string), receive `"pong"`. 25s interval.
- Symbol format: Hyphen-separated `BTC-USDT` (split on `-`, index 0 for base)
- Quote currencies: USDT, USDC

**Files created:**
- `src/exchanges/adapters/okx.ts` — Full adapter: REST fetch, WS subscribe (batched at 25), parsing, heartbeat, ticker/price caching, `createTickerNormalizer('okx')`

**Files changed:**
- `src/exchanges/tickerNormalizer.ts` — Added `okx: {}` to `EXCHANGE_ALIASES`
- `src/exchanges/adapters/index.ts` — Added `okxAdapter` export
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Imported `okxAdapter`, added Upbit–OKX, Bithumb–OKX, Binance–OKX, Bybit–OKX to `AVAILABLE_CEX_PAIRS`
- `src/lib.ts` — Added `okxAdapter` export
- `package.json` — Version `0.1.13` → `0.1.14`

**Available pairs now:** Upbit–Binance, Upbit–Bybit, Upbit–OKX, Upbit–Bithumb, Bithumb–Binance, Bithumb–Bybit, Bithumb–OKX, Binance–Bybit, Binance–OKX, Bybit–OKX.

---

## Completed Previous Session (2026-02-13)

### Husky Pre-Push Hook + GitHub Actions Auto-Publish + Releases

Automated the publish pipeline. Previously `npm publish` was manual.

**What was added:**

1. **Husky v9 pre-push hook** (`.husky/pre-push`) — Runs `npm run build && npm run lint` before every `git push`. If either fails, the push is rejected. Prevents broken code from reaching the remote.

2. **GitHub Actions workflow** (`.github/workflows/publish.yml`) — Triggers on push to `master`. Steps:
   - Checkout + Node 20 + `npm ci`
   - `npm run build && npm run lint` (CI verification)
   - Compares `package.json` version vs published registry version (`npm view`)
   - If version changed: `npm run build:lib && npm publish` to GitHub Packages
   - Creates a GitHub Release `v{version}` with auto-generated release notes (via `softprops/action-gh-release@v2`)
   - If version unchanged: skips publish + release (build/lint still runs as CI gate)
   - Auth: `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (no manual secret setup needed)
   - Permissions: `contents: write` (for releases/tags), `packages: write` (for npm publish)

3. **README Changelog section** — Links to GitHub Releases page for version history.

**Files created:**
- `.husky/pre-push` — Husky v9 hook (plain shell, no shebang needed)
- `.github/workflows/publish.yml` — CI/CD workflow

**Files changed:**
- `package.json` — Added `husky` to devDependencies, added `"prepare": "husky"` script
- `README.md` — Added `## Changelog` section linking to GitHub Releases

---

## Completed Previous Session (2026-02-13)

### Binance WS Stream: `@trade` → `@miniTicker`

**Problem:** Binance prices occasionally differed from the official Binance UI. The adapter subscribed to `@trade` streams and read `payload.p` (individual trade execution price). Large orders filling across multiple price levels would briefly show intermediate fill prices. The Binance UI displays the consolidated "last price" from the ticker stream's `c` (close) field.

**Fix:** Switched from `@trade` to `@miniTicker` stream, reading `payload.c` instead of `payload.p`. The `@miniTicker` stream updates every 500ms per symbol with the same "last price" the Binance UI shows.

**Side benefit:** Dramatically reduced message volume — from 500-1000+ msg/sec (every trade fill) to ~2 msg/sec per ticker (500ms interval). The RAF batching in `marketData.ts` still applies but has much less work to coalesce.

**Files changed:**
- `src/exchanges/adapters/binance.ts` — Subscribe params: `@trade` → `@miniTicker`; parse field: `payload.p` → `payload.c`

### Bithumb Exchange Adapter

Added Bithumb (Korean CEX) as the 4th exchange. Bithumb's API is nearly identical to Upbit — same symbol format (`KRW-BTC`), same WS Blob messages, same SIMPLE format fields (`cd`/`tp`).

**Bithumb API details:**
- REST: `GET https://api.bithumb.com/v1/market/all` → `[{ "market": "KRW-BTC" }, ...]`
- WebSocket: `wss://ws-api.bithumb.com/websocket/v1`
- Subscribe: `[{"ticket":"premium-table"},{"type":"ticker","codes":["KRW-BTC",...]},{"format":"SIMPLE"}]`
- Response: Blob → JSON with `cd` (`KRW-BTC`), `tp` (trade_price) — same as Upbit SIMPLE format
- Quote currencies: KRW only
- No heartbeat required

**Key decision:** Reuses `parseUpbitJson` from `upbit.ts` in `useExchangeWebSocket` (same Blob→JSON→`{cd,tp}` format). The Blob handling branch in the WS hook now matches both `'upbit'` and `'bithumb'` adapter IDs.

**Available pairs now:** Upbit–Binance, Upbit–Bybit, Upbit–Bithumb, Bithumb–Binance, Bithumb–Bybit, Binance–Bybit.

**Files created:**
- `src/exchanges/adapters/bithumb.ts` — Full adapter: REST fetch, WS subscribe, own `createTickerNormalizer('bithumb')`, module-level ticker cache

**Files changed:**
- `src/exchanges/tickerNormalizer.ts` — Added `bithumb: {}` to `EXCHANGE_ALIASES`
- `src/exchanges/adapters/index.ts` — Added `bithumbAdapter` export
- `src/hooks/useExchangeWebSocket.ts` — Blob handling branch: `currentAdapter.id === 'upbit'` → `currentAdapter.id === 'upbit' || currentAdapter.id === 'bithumb'`
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Imported `bithumbAdapter`, added Upbit–Bithumb, Bithumb–Binance, Bithumb–Bybit to `AVAILABLE_CEX_PAIRS`
- `src/lib.ts` — Added `bithumbAdapter` export

### Korean-Korean Pair Quote Currency Fix

**Problem:** Selecting Upbit–Bithumb showed only skeleton rows — Bithumb WS never connected. `applyCexPair` assumed the B-side exchange always has stablecoins when A-side is Korean: `quoteCurrencyB = stables[0] ?? 'USDT'`. For Korean-Korean pairs `stables` is `[]`, so `quoteCurrencyB` fell through to `'USDT'`. Bithumb doesn't support USDT, so `getAvailableTickers('USDT')` returned `[]` and the WS never subscribed.

**Fix:** Added `isKoreanB` check. Each side now independently resolves its quote currency: `isKoreanA ? 'KRW' : stables[0]` for A, `isKoreanB ? 'KRW' : stables[0]` for B.

**Files changed:**
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — `applyCexPair` uses independent `isKoreanA`/`isKoreanB` checks

### KRW Placeholder Tab for Korean-Korean Pairs

**Problem:** Korean-Korean pairs (Upbit–Bithumb) had no stablecoin tabs, causing the header UI to shrink and look inconsistent compared to other pairs.

**Fix:** When `stablecoins` is empty, a single non-interactive "KRW" tab is rendered as a placeholder. The `Tabs` component is now always rendered (not conditionally).

**Files changed:**
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Always render `<Tabs>`, show `<Tab label="KRW" />` when `stablecoins` is empty

### Centralized Ticker Normalization Layer

Extracted per-adapter ticker alias logic (e.g., Binance `BEAMX→BEAM`) into a shared `tickerNormalizer.ts` module. Any exchange pair now resolves aliases through one canonical registry instead of each adapter defining its own `TICKER_ALIASES` / `REVERSE_ALIASES` constants.

**Design:** `createTickerNormalizer(exchangeId)` returns `{ toCanonical, toExchange }` using a centralized `EXCHANGE_ALIASES` map. Each adapter calls the factory once at module scope and uses it at the same 3 touch points: `fetchAvailableTickers`, `getSubscribeMessage`, `parseMessage`.

**Files created:**
- `src/exchanges/tickerNormalizer.ts` — `EXCHANGE_ALIASES` registry, `TickerNormalizer` interface, `createTickerNormalizer()` factory

**Files changed:**
- `src/exchanges/adapters/binance.ts` — Removed `TICKER_ALIASES` and `REVERSE_ALIASES` constants, replaced with `normalizer.toCanonical()` / `normalizer.toExchange()` calls
- `src/exchanges/adapters/bybit.ts` — Added normalizer at 3 touch points (currently all no-ops with empty alias map, but wired up for future aliases)
- `src/exchanges/adapters/upbit.ts` — Added normalizer at 3 touch points (currently all no-ops with empty alias map)
- `src/lib.ts` — Exports `createTickerNormalizer` and `TickerNormalizer` type for library consumers building custom adapters

**Adding a new exchange after this:** Add aliases to `EXCHANGE_ALIASES` in `tickerNormalizer.ts`, call `createTickerNormalizer(exchangeId)` in the adapter, use `toCanonical()`/`toExchange()` at the 3 touch points.

### Bybit Subscription Batching Fix

**Problem:** Bybit Spot WebSocket limits subscribe requests to 10 args per message. We were sending 80+ args in a single subscribe message, causing Bybit to silently reject the subscription. Connection showed green (WS open) but no ticker data flowed.

**Fix:** Changed `getSubscribeMessage` return type from `string` to `string | string[]` in the `ExchangeAdapter` interface. Bybit adapter now batches args into groups of 10, returning `string[]`. `useExchangeWebSocket.ts` sends each message separately when an array is returned.

**Files changed:**
- `src/exchanges/types.ts` — `getSubscribeMessage` return type: `string` → `string | string[]`
- `src/exchanges/adapters/bybit.ts` — `getSubscribeMessage` returns `string[]` with batches of 10
- `src/hooks/useExchangeWebSocket.ts` — Handles `string | string[]` from `getSubscribeMessage`

### CEX Pair Selector: Tabs → Select Dropdown + Binance-Bybit Restored

**Problem:** Outer CEX pair tabs don't scale — adding more exchanges makes the tab bar too cramped. Also, the Binance-Bybit pair was missing from `AVAILABLE_CEX_PAIRS`.

**Fix:** Replaced the outer `Tabs` component with an MUI `Select` dropdown. Dark-themed (green border, dark menu, green text), compact at 18px height. Auto-blurs after selection to avoid lingering focus highlight. Stablecoin inner tabs remain as-is.

**Available pairs now:** Upbit–Binance, Upbit–Bybit, Binance–Bybit.

**Files changed:**
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Replaced outer `Tabs`/`Tab` with `Select`/`MenuItem`, restored Binance-Bybit pair, removed unused `tabSx` constant

---

## Completed Previous Session (2026-02-13)

### Bybit Exchange Adapter

Added Bybit as a third exchange, enabling Upbit-Bybit and Binance-Bybit premium comparisons.

**Bybit API details:**
- REST: `https://api.bybit.com/v5/market/tickers?category=spot` — fetches all spot tickers with prices
- WebSocket: `wss://stream.bybit.com/v5/public/spot` with `tickers.*` stream (50ms consolidated updates with `lastPrice`)
- Subscribe: `{ "op": "subscribe", "args": ["tickers.BTCUSDT", ...] }`
- Heartbeat: Application-level ping required every 20s (`{"op":"ping"}`)
- Symbol format: Same as Binance (`BTCUSDT`, `ETHUSDC` — strip quote suffix for base ticker)
- Quote currencies: USDT, USDC

**Stream choice:** Uses `tickers` stream (not `publicTrade`). Simpler message format (single object vs trade array), sufficient granularity for premium display, lower message volume.

**Heartbeat implementation:** Added optional `heartbeatConfig` to `ExchangeAdapter` interface. `useWebSocketHandler` passes it to `react-use-websocket`'s built-in `heartbeat` option (which already supports `message`, `interval`, `timeout`). Only Bybit sets this — Upbit and Binance don't need application-level heartbeat.

**Files created:**
- `src/exchanges/adapters/bybit.ts` — Full adapter: REST fetch, WS parsing, ticker/price caching, heartbeat config

**Files changed:**
- `src/exchanges/types.ts` — Added optional `heartbeatConfig?: { message: string; interval: number }` to `ExchangeAdapter`
- `src/exchanges/adapters/index.ts` — Added `bybitAdapter` export
- `src/hooks/useWebSocketHandler.ts` — Added optional 4th `heartbeat` parameter, spread into `useWebSocket` options
- `src/hooks/useExchangeWebSocket.ts` — Passes `adapter.heartbeatConfig` to `useWebSocketHandler`
- `src/components/MarketPairSelector/MarketPairSelector.tsx` — Added Upbit-Bybit and Binance-Bybit to `AVAILABLE_CEX_PAIRS`
- `src/lib.ts` — Added `bybitAdapter` export

---

## Completed Previous Session (2026-02-13)

### README Installation Section Update

Updated the Installation section in `README.md` to present two clear options for configuring the `@gloomydumber` GitHub Packages scope:
- **Option A:** Project-level `.npmrc` file with registry mapping
- **Option B:** `npm login --scope=@gloomydumber` (per-user, no file needed)

No authentication token is required since the package is published from a public repository.

**Files changed:**
- `README.md` — Rewrote Installation section

### package-lock.json version sync

Committed `package-lock.json` version bump from `0.1.8` to `0.1.10` (was out of sync with `package.json`).


### Delisted Ticker Filter + Alias Mapping in Binance Adapter (0.1.10)

**Problem:** Binance's `/api/v3/ticker/price` returns tickers that are delisted (e.g., WAVES, AERGO, ELF, SNT) with stale non-zero prices, and tickers that were renamed (e.g., BEAMX on Binance = BEAM on Upbit) which don't match Upbit's canonical names. This caused delisted tickers appearing in the table with stale prices and renamed tickers missing from the table (intersection fails).

**Solution:** Added three constants inside `src/exchanges/adapters/binance.ts`:
- `DELISTED_TICKERS` — `Set(['WAVES', 'AERGO', 'ELF', 'SNT'])` — filtered out in `fetchAvailableTickers`
- `TICKER_ALIASES` — `{ BEAMX: 'BEAM' }` — maps Binance names → canonical names
- `REVERSE_ALIASES` — auto-derived `{ BEAM: 'BEAMX' }` — reverse-maps canonical → Binance names for WS subscriptions

**Touch points (3 methods modified):**
1. `fetchAvailableTickers` — skips delisted, stores canonical names in `tickerCache` and `restPriceCache`
2. `getSubscribeMessage` — reverse-maps canonical → exchange name (e.g., BEAM → `beamxusdt@trade`)
3. `parseMessage` — maps incoming WS trade symbols → canonical (e.g., BEAMX → BEAM)

**Files changed:**
- `src/exchanges/adapters/binance.ts` — Added constants, applied in 3 methods

### Also Included in 0.1.10 (pre-existing changes committed together)

- `src/store/marketAtoms.ts` — WS readyState atoms default changed from `0` (CONNECTING) to `3` (CLOSED), so status dots show red/closed before WS actually connects instead of misleading yellow/connecting
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — REST price seeding split into a separate `useEffect` keyed on `pair` (instead of `marketKeyA`/`marketKeyB`), so cached prices re-seed correctly when `initMarketPairAsync` resolves with real tickers. Removed `setWsReadyStateA(0)`/`setWsReadyStateB(0)` from tab-switch effect (readyState is now managed by the WS hook itself)

---

## Completed Previous Session (2026-02-12)

### react-grid-layout Fixed Container (usage example)

**Change:** `App.tsx` now demonstrates embedding `<PremiumTable>` inside a react-grid-layout as a fixed, full-viewport grid item. The item is `static: true`, not draggable, not resizable — serving as a usage reference for the WTS consumer project.

**Grid item fills viewport via CSS:** `.react-grid-item { height: 100% !important }` in `grid-overrides.css` bypasses RGL's row-height math so the item always fills the container regardless of viewport size.

**`setUpdatesPaused` in `marketData.ts`:** Module-level pause flag that prevents RAF flush and buffers cross-rate updates. Exported from `src/lib.ts` for consumer use. Consumers wrapping `<PremiumTable>` in their own react-grid-layout can call `setUpdatesPaused(true/false)` during resize.

**Files changed:**
- `src/App.tsx` — Fixed grid item (`static: true`, `isResizable={false}`), full-viewport height via CSS
- `src/grid-overrides.css` — Replaced resize handle styles with `.react-grid-item { height: 100% !important }`
- `src/store/marketData.ts` — `setUpdatesPaused` API (pause flag + pending cross-rate buffer)
- `src/lib.ts` — Exports `setUpdatesPaused`

### Post-0.1.9 Fixes

**Fix 1 — No scroll in App.tsx grid:** `height: '100vh'` + `overflow: 'hidden'` on html/body/#root + `autoSize={false}`. Grid fills exactly one viewport height without generating scrollbars.

**Fix 2 — Filter delisted Binance tickers:** Added `price > 0` filter in `fetchAvailableTickers`. The `/ticker/price` endpoint returns ALL symbols including delisted/halted pairs (which have `price: "0.00000000"`). The old `exchangeInfo` had `status: 'TRADING'` filter. Now `!p || isNaN(p)` skips zero-price and invalid entries.

**Fix 3 — Tooltips on WS status dots:** Each dot is wrapped in a themed `<Tooltip>` showing `"{ExchangeName} WebSocket: {Status}"` (e.g., "Upbit WebSocket: Connected"). Tooltip styling reuses the same theme as the reset button tooltip (black bg, lime text, green border). Extracted `wsTooltipSlotProps` as a static constant to avoid re-creating on render. Added `cursor: 'default'` to the dot for tooltip hover UX.

**Files changed:**
- `src/App.tsx` — `autoSize={false}`, `height: '100vh'`, fixed static grid item
- `src/grid-overrides.css` — `overflow: hidden` on html/body/#root, `.react-grid-item { height: 100% !important }`
- `src/exchanges/adapters/binance.ts` — `price > 0` filter in `fetchAvailableTickers` loop
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — `wsStatusDot` now accepts `exchangeName`, wraps dot in themed `<Tooltip>`, extracted `wsTooltipSlotProps` + `WS_STATUS_LABELS`, column widths 16/30/30/24

### Three Improvements (0.1.9)

#### 1. Binance REST endpoint switch to `/ticker/price` + seed initial prices

**Problem:** `fetchAvailableTickers` fetched ~1.5MB `exchangeInfo`. The lighter `/api/v3/ticker/price` returns `{ symbol, price }[]` (~50KB) and provides initial prices to seed rows before WS connects.

**Changes:**
- `src/exchanges/types.ts` — Added optional `getCachedPrices?(quoteCurrency: string): Map<string, number>` to `ExchangeAdapter` interface
- `src/exchanges/adapters/binance.ts` — Switched from `exchangeInfo` to `ticker/price` endpoint. Added `restPriceCache` (module-level Map). `fetchAvailableTickers` now extracts tickers AND prices from the same response. Added `getCachedPrices()` method.
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — After `initMarketData()`, seeds cached prices from both adapters via `updatePrice()`. Uses `pairRef` to avoid lint warning about `pair` in effect deps.

**Result:** Binance priceB column populates instantly from REST data. WS trade events overwrite REST prices as they arrive.

#### 2. WebSocket connection status dots in table header

**Change:** Added colored dots (6px circles) next to each exchange name in the table header showing WS connection health.

**Colors:** Green (`#00ff00`) = OPEN, Yellow (`#ffff00`) = CONNECTING, Red (`#ff0000`) = CLOSING/CLOSED.

**Implementation:**
- `src/store/marketAtoms.ts` — Added `wsReadyStateAAtom` and `wsReadyStateBAtom` (number atoms, default 0)
- `src/hooks/useWebSocketHandler.ts` — Now returns `readyState` alongside `sendMessage`
- `src/hooks/useExchangeWebSocket.ts` — Now returns `readyState` from `useWebSocketHandler`
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — Captures `readyState` from both `useExchangeWebSocket` calls, syncs to atoms via `useEffect`. Resets both to `0` on tab switch.
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Reads `wsReadyStateAAtom`/`wsReadyStateBAtom`, renders `wsStatusDot()` helper after each exchange name in header cells.

#### 3. react-grid-layout fixed container (dev-only usage example)

**Change:** Wrapped `PremiumTable` in a react-grid-layout in `App.tsx` as a fixed, full-viewport grid item. Dev-only — the library component does NOT depend on it. Consumers wrap `<PremiumTable>` in their own layout.

**Implementation:**
- `package.json` — Added `react-grid-layout` as devDependency (NOT peer/regular dep)
- `src/App.tsx` — Imports `WidthProvider` and `Responsive` from `react-grid-layout/legacy`. Single static grid item (`static: true`, `isDraggable={false}`, `isResizable={false}`).
- `src/grid-overrides.css` (new) — Viewport height override: `.react-grid-item { height: 100% !important }` bypasses RGL row math.

**Note:** react-grid-layout v2 moved `WidthProvider` and `Responsive` to `react-grid-layout/legacy` subpath. The main entry uses hooks-based API (`useContainerWidth`, `useGridLayout`). `@types/react-grid-layout` was removed (conflicts with native types).

### Tooltip on localStorage Reset Button (0.1.8)

**Change:** Added a themed MUI `<Tooltip>` to the `RestartAltIcon` reset button in the PREMIUM header cell. The tooltip explains that it resets pin, mute, and expand preferences for the current tab only (other tabs are not affected).

**Tooltip styling:** Matches the table's dark/lime theme — black background (`rgba(0, 0, 0, 0.92)`), lime text, green border (`rgba(0, 255, 0, 0.3)`), JetBrains Mono font. Arrow styled to match.

**Files changed:**
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Added `Tooltip` import, wrapped `IconButton` in `<Tooltip>` with `slotProps` for themed styling

### Persist User Preferences (Pin/Mute/Expand) with localStorage (0.1.6 → 0.1.7)

**Problem:** Pin, mute, and expand state was lost on page refresh and tab switch. Users had to re-pin/mute rows every time.

**Solution:** Preferences are now persisted to localStorage, scoped per market pair tab.

**Storage key format:** `premium-table:prefs:${marketKeyA}|${marketKeyB}` (e.g., `premium-table:prefs:upbit:KRW|binance:USDT`)

**Storage value:** JSON with `pinned`, `muted`, `openRows` arrays (serialized from Sets).

**How it works:**
1. On tab switch: `WebSocketProvider` clears market data, then restores pin/mute/expand from localStorage for the new tab key (instead of clearing to empty Sets)
2. On toggle: `ArbitrageTable` has a `useEffect` watching `pinned`, `muted`, `openRows` that saves to localStorage after every change. Uses `prevKeysRef` to skip saving when market keys just changed (page refresh or tab switch), preventing stale atom values from overwriting saved prefs before WebSocketProvider restores them.
3. On data arrival: A sync effect runs on every `sortedTickers` change to set `isPinned`/`isMuted` flags on `rowMapAtom` for rows arriving in incremental WS batches. Short-circuits via `next===prev` when all flags already match.
4. Reset: An always-visible `RestartAltIcon` in the PREMIUM header cell clears all prefs for the current tab

**Files created:**
- `src/utils/prefsStorage.ts` — `buildPrefsKey()`, `savePrefs()`, `loadPrefs()` with try/catch safety

**Files changed:**
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — Replaced `setPinned(new Set()); setOpenRows(new Set()); setMuted(new Set())` with `loadPrefs()` restore
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Added save effect, rowMap flag sync on data arrival, `handleResetPrefs` callback, `RestartAltIcon` button in PREMIUM header

### Remove Fallback Tickers + Skeleton Loading UI (0.1.5 → 0.1.6)

**Change:** Deleted all hardcoded fallback ticker arrays (`KRW_TICKERS_FALLBACK`, `USDT_TICKERS_FALLBACK`, `USDC_TICKERS_FALLBACK`) from exchange adapters. Added skeleton loading rows (40 shimmer rows) that display while REST APIs fetch tickers and WS prices arrive.

**Motivation:** Fallback arrays were ugly maintenance burdens that could drift out of sync with actual exchange listings. The table previously showed 0 rows (blank) before first WS price with no loading indication. Now it shows skeleton rows immediately, replaced by real data once prices stream in.

**How it works:**
1. `buildDefaultMarketPair()` → `getAvailableTickers()` returns `[]` → `commonTickers = []`
2. `sortedTickersAtom = []` → ArbitrageTable renders 40 skeleton rows
3. REST APIs respond → `commonTickers` updated → WS subscribes with full list
4. First prices arrive → skeleton replaced by real rows
5. Subsequent tab switches use cached REST data → instant data, minimal/no skeleton

**Files changed:**
- `src/exchanges/adapters/upbit.ts` — Deleted `KRW_TICKERS_FALLBACK`, `getAvailableTickers` returns `cachedKrwTickers ?? []`, catch returns `[]`
- `src/exchanges/adapters/binance.ts` — Deleted `USDT_TICKERS_FALLBACK` and `USDC_TICKERS_FALLBACK`, `getAvailableTickers` returns `tickerCache.get(quoteCurrency) ?? []`, catch returns `[]`
- `src/store/marketPairAtom.ts` — `initMarketPairAsync` guard simplified from `dynamicTickers.length > defaultPair.commonTickers.length` to `dynamicTickers.length > 0`
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Added `'skeleton'` to `VirtualRow` type, generates 40 skeleton rows when `sortedTickers` is empty, renders `<SkeletonRow />` for skeleton type

### Sort Freeze Disabled During Skeleton Loading

**Problem:** Hovering over skeleton rows triggered the sort-freeze feature (`sortFrozenAtom`), which is meaningless when there's no real data to sort.

**Fix:** `TableBody` in `VirtuosoTableComponents.tsx` now reads `tickersAtom` and only sets `sortFrozenAtom` to `true` on `mouseEnter` when `tickers.length > 0`.

**Files changed:**
- `src/components/ArbitrageTable/VirtuosoTableComponents.tsx` — Added `useAtomValue(tickersAtom)`, `onMouseEnter` guarded by `hasData`

### Binance REST Endpoint Updated

**Change:** Switched Binance ticker discovery endpoint from `https://data-api.binance.vision/api/v3/exchangeInfo` to `https://api.binance.com/api/v3/exchangeInfo`.

**Files changed:**
- `src/exchanges/adapters/binance.ts` — Updated fetch URL

### MUI v6 → v7 Upgrade (0.1.4)

**Change:** Upgraded MUI devDependencies from v6.4.1 to v7.0.0+. Widened peerDependencies to accept both `^6.0.0 || ^7.0.0` for backward compatibility.

**Motivation:** `@mui/icons-material@latest` resolves to v7 and requires `@mui/material@^7`. Consumers on v7 were getting peer dep conflicts. The library uses no deprecated v6 APIs (no `Grid`, no `size="normal"`, no deep imports), so the upgrade is zero-breakage.

**Files changed:**
- `package.json` — version `0.1.3` → `0.1.4`, devDeps MUI `^6.4.1` → `^7.0.0`, peerDeps MUI `^6.0.0` → `^6.0.0 || ^7.0.0`

**Verified:** `npm run build`, `npm run build:lib`, `npm run lint` all pass. Test project (`../newTestProject`) updated to MUI v7.3.7 and builds cleanly.

### PremiumTable `height` default: `'100%'` → `'100vh'`

**Change:** Changed the default value of the optional `height` prop from `'100%'` to `'100vh'`.

**Motivation:** With `height: '100%'`, if the consumer's parent chain has no explicit height (e.g., bare `<body>`), the table collapses to zero height and is invisible. `'100vh'` fills the viewport out of the box without requiring parent height setup. Consumers embedding in a sized container can still override with `height={500}` or `height="100%"`.

**Files changed:**
- `src/components/PremiumTable/PremiumTable.tsx` — default `'100%'` → `'100vh'`
- `src/App.tsx` — removed now-redundant `height="100vh"` prop, relies on default

### 0. Library Build — Publish as GitHub Package

**Change:** Converted project to dual-mode: standalone dev app (`npm run dev`) AND publishable npm library (`npm run build:lib`) for `@gloomydumber/premium-table` on GitHub Packages.

**New files:**
- `src/components/PremiumTable/PremiumTable.tsx` — Self-contained wrapper: own Jotai `<Provider>` (atom isolation), ThemeProvider with default dark theme, WebSocketProvider, ArbitrageTable. Props: `height`, optional `theme` override.
- `src/components/PremiumTable/theme.ts` — Default dark theme extracted from old `App.tsx` (internal, not exported from library).
- `src/components/PremiumTable/index.ts` — Barrel export.
- `src/lib.ts` — Library entry point. Exports: `PremiumTable`, `PremiumTableProps`, type-only exports for `MarketRow`, `WalletStatus`, `ExchangeAdapter`, `NormalizedTick`, plus `upbitAdapter` and `binanceAdapter`.
- `.npmrc` — Scoped registry config for `@gloomydumber` → GitHub Packages.

**Modified files:**
- `src/App.tsx` — Simplified to just `<PremiumTable height="100vh" />`, dogfooding the library component.
- `vite.config.ts` — Conditional lib mode (`--mode lib`): `vite-plugin-dts` for `.d.ts` generation, rollup externals for React/MUI/Jotai/etc.
- `package.json` — Name `@gloomydumber/premium-table`, `private: false`, `version: 0.1.0`, `main`/`types`/`exports` fields, `files` restricted to `dist/index.js` + `dist/index.d.ts`, `peerDependencies` for all runtime deps, `build:lib` and `prepublishOnly` scripts, `publishConfig` for GitHub Packages.
- `src/exchanges/adapters/binance.ts` — Removed unused `_crossRateTicker` parameter from `getSubscribeMessage` (pre-existing lint error).

**Post-publish fixes (0.1.1 → 0.1.3):**
- `0.1.1`: Widened React peer dep to `^18.0.0 || ^19.0.0` (Vite template now defaults to React 19).
- `0.1.2`: Changed Upbit REST fetch from relative `/api/upbit/v1/market/all` (required Vite proxy) to direct `https://api.upbit.com/v1/market/all` (CORS-safe). Removed now-unnecessary Vite proxy config from `vite.config.ts`.
- `0.1.3`: Bundled JetBrains Mono font via `@fontsource/jetbrains-mono` (regular `dependency`, not peer). Consumers import `@gloomydumber/premium-table/style.css` for font + styles. Removed Google Fonts `<link>` from `index.html`. Lib build now produces `dist/index.css` (font woff2 inlined).

**Key decisions:**
- Own `<Provider>` in PremiumTable prevents atom conflicts with host app's Jotai store.
- Default theme is internal — not exported. Consumer overrides via `theme` prop.
- Runtime deps are `peerDependencies` (externalized in lib build), duplicated in `devDependencies` for standalone dev.
- `vite-plugin-dts` with `rollupTypes: true` produces a single rolled-up `index.d.ts`.

### 1. Sort Freeze on Hover (Prevent Row Jumping While Targeting Pin/Mute)

**Problem:** Binance WS sends 500-1000+ messages/sec, causing premium-based sort order to shift rapidly. When hovering over a row to click pin/mute, the target row could jump away before the click lands.

**Fix:** Sort order freezes while the mouse is over `<tbody>`. Prices still update live in every row — only the row **order** is frozen. When the mouse leaves `<tbody>`, sorting resumes and all accumulated order changes apply in one frame.

**Implementation:** `sortFrozenAtom` (boolean) gates a `_freezeAwareSortedAtom` layer between `_rawSortedAtom` and the `selectAtom` wrapper. When frozen, a module-level `_frozenSnapshot` is returned instead of the live sort. The existing `selectAtom` referential equality check prevents any downstream re-renders while frozen. `sortFrozenAtom` is also reset to `false` on tab switch (same pattern as other UI state atoms).

**Files changed:**
- `src/store/marketAtoms.ts` — Added `sortFrozenAtom`, `_frozenSnapshot`, `_freezeAwareSortedAtom`; `sortedTickersAtom` now wraps the freeze-aware atom
- `src/components/ArbitrageTable/VirtuosoTableComponents.tsx` — `TableBody` component uses `useSetAtom(sortFrozenAtom)` with `onMouseEnter`/`onMouseLeave`
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — Resets `sortFrozenAtom` to `false` on pair change

### 1. Icon-Based Row Actions (Pin ↑, Mute ↓, Expand ▾)

**Change:** Replaced all row-wide click handlers with dedicated icons in the ticker cell. Removed `PushPinIcon`. Removed `onClick` from all price/premium cells. Added `isOpen` prop through `ArbitrageTable → MainRowByTicker → MemoMainRow` + `areEqual` check.

**Icon visibility by state:**
| State | ↑ Pin | ↓ Mute | Expand |
|-------|-------|--------|--------|
| **Neutral** | hover-reveal | hover-reveal | hidden |
| **Pinned** | always visible (green) | hidden | ▴ always visible (lime) when open, ▾ hover-reveal when closed |
| **Muted** | hidden | always visible | hidden |

Pin and mute icons are mutually exclusive in the UI — pinned rows never show ↓, muted rows never show ↑.

**Files changed:**
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Pass `isOpen={openRows.has(ticker)}` to `MainRowByTicker`
- `src/components/ArbitrageTable/Row/MainRow.tsx` — Replaced `PushPinIcon` with `ArrowUpwardIcon`, added `ExpandMore/LessIcon` for expand, removed row-wide `onClick`, added `isOpen` prop + `areEqual` check

### 1. Clear Pin/Expand/Mute State on Tab Switch (superseded by localStorage persistence in 0.1.7)

**Problem:** Switching between stablecoin tabs (e.g., USDT → USDC) or exchange pair tabs preserved the pinned, expanded, and muted row state from the previous tab. Rows that were pinned/muted on USDT appeared pinned/muted on USDC even though they might not exist or have different data.

**Original fix:** Reset `pinnedAtom`, `openRowsAtom`, and `mutedAtom` to empty Sets on tab switch.

**Superseded by 0.1.7:** Tab switch now restores per-tab prefs from localStorage instead of clearing to empty. See "Persist User Preferences" above.

**Files changed:**
- `src/components/WebSocketProvider/WebSocketProvider.tsx` — Now calls `loadPrefs()` instead of resetting to empty Sets

### 1. Mute Feature — Hover-Reveal Down-Arrow to Sort Rows to Bottom

**Purpose:** Some rows have high premiums but are meaningless (delisting, abnormal market conditions). Users can now mute rows to push them to the bottom of the table.

**Interaction:**
- Normal row on hover: small down-arrow icon appears after ticker name
- Click the down-arrow: row becomes muted (dimmed + sorted to bottom)
- Muted row: down-arrow always visible, row text/prices dimmed (opacity 0.3). Click again to unmute.
- Pin and mute are mutually exclusive: pinning a muted row unmutes it; muting a pinned row unpins + closes detail.

**Sort priority (updated):** expanded pinned → pinned → normal (|premium| desc) → muted (|premium| desc)

**Files changed:**
- `src/types/market.ts` — Added `isMuted: boolean` to `MarketRow`
- `src/store/marketAtoms.ts` — Added `mutedAtom` (Set<string>), updated `_rawSortedAtom` comparator to sort muted below normal
- `src/store/marketData.ts` — `upsertRow` preserves `isMuted` from existing row
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Added `mutedAtom` state + `mutedRef`, `handleToggleMute` callback with pin/mute mutual exclusion, updated `handleTogglePin` to unmute, passed `onToggleMute` through `MainRowByTicker`
- `src/components/ArbitrageTable/Row/MainRow.tsx` — Added `ArrowDownwardIcon` with `tr:hover &` visibility, dimmed styling when muted, updated `areEqual` memo check

### 1. USDC Cross-Rate Subscription Fix

**Problem:** Upbit's `getSubscribeMessage` hardcoded `KRW-USDT` as the cross-rate ticker. When switching to the USDC tab, the system expected `KRW-USDC` messages but never subscribed to them, so `crossRateAtom` stayed `0` and all premiums showed `0.00%`.

**Fix:** Made the cross-rate ticker dynamic. `getSubscribeMessage` now accepts an optional `crossRateTicker` parameter. `useExchangeWebSocket` derives it from `crossRateConfig` and passes it through. Upbit adapter uses the parameter instead of hardcoding.

**Files changed:**
- `src/exchanges/types.ts` — Added optional `crossRateTicker` param to `getSubscribeMessage` signature
- `src/exchanges/adapters/upbit.ts` — Uses `crossRateTicker` param instead of hardcoded `KRW-USDT`
- `src/exchanges/adapters/binance.ts` — Added `_crossRateTicker` param to signature (no behavior change)
- `src/hooks/useExchangeWebSocket.ts` — `subscribe` callback derives `crossRateTicker` from `crossRateConfigRef` and passes to `getSubscribeMessage`

### 2. Ticker Filtering on Incoming WS Messages

**Problem:** When switching tabs, old subscription messages leak through before re-subscribe takes effect. `updatePrice` accepted any ticker, so stale/orphan rows appeared in the UI.

**Fix:** Added `tickerSetRef` (a `Set<string>` updated from `tickers` prop on each render). Both Upbit and Binance message paths check `tickerSetRef.current.has(tick.ticker)` before calling `updatePrice`. Cross-rate tickers are handled before this check (early return to `updateCrossRate`), so they aren't filtered out.

**Files changed:**
- `src/hooks/useExchangeWebSocket.ts` — Added `tickerSetRef` and filter guard in both Upbit and Binance code paths

### 3. Pin→Expand Stale Closure Fix

**Problem:** After pinning a row, clicking to expand it didn't work for ~10 seconds. Two-layer stale closure: `handleToggleExpand` captured `pinned` (a Set) in its closure. When pinning updated the Set, React created a new callback — but `MemoMainRow`'s `areEqual` doesn't compare callback props, so the memoized row kept the old `handleToggleExpand` where `pinned` didn't include the just-pinned ticker. The guard `if (!pinned.has(ticker)) return` silently dropped the expand click. It only started working after a price update caused `MemoMainRow` to re-render and pick up the new callback.

**Fix:** Replaced `pinned` closure capture with `pinnedRef` (a ref always pointing to the latest `pinned` Set). `handleToggleExpand` now has stable identity (`[setOpenRows]` deps only) and always reads current state via the ref.

**Files changed:**
- `src/components/ArbitrageTable/ArbitrageTable.tsx` — Added `pinnedRef`, `handleToggleExpand` reads `pinnedRef.current` instead of `pinned`

---

## Completed Previous Session (2026-02-11)

### 1. Dynamic Ticker Fetching from Exchange REST APIs

Both adapters previously hardcoded only 23 tickers. Now they fetch full lists from REST APIs at startup, with the hardcoded lists as synchronous fallback for instant render.

**Files changed:**

- `vite.config.ts` — Added dev proxy `/api/upbit` → `https://api.upbit.com` (Upbit REST has CORS restrictions)
- `src/exchanges/types.ts` — Added optional `fetchAvailableTickers?(quoteCurrency: string): Promise<string[]>` to `ExchangeAdapter` interface
- `src/exchanges/adapters/upbit.ts` — `fetchAvailableTickers('KRW')` fetches `/api/upbit/v1/market/all`, filters `KRW-` prefix, caches in module-level variable. `getAvailableTickers` returns cache if populated, else hardcoded fallback.
- `src/exchanges/adapters/binance.ts` — `fetchAvailableTickers` uses `https://api.binance.com/api/v3/exchangeInfo`. Caches per quote currency. **Also switched WS from URL-encoded streams to subscribe-based**: `getWebSocketUrl` returns base URL `wss://stream.binance.com:9443/ws`, `getSubscribeMessage` sends `{ method: 'SUBSCRIBE', params: [...], id: 1 }`. This avoids URL length limits with 100+ tickers.
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

### 5. Repo Cleanup

- Deleted `.continue/` folder — was redundant symlinks duplicating `.claude/skills/` (both pointed to `.agents/skills/`)
- Deleted `.agents/` folder — moved actual skill files directly into `.claude/skills/` (jotai-expert, mui, performance, vite)
- Git initialized, remote set to `https://github.com/gloomydumber/premium-table-refactored.git`, initial commit pushed to `origin/master`

---

## Architecture Decisions to Preserve

1. **Premium is derived, not stored.** `MarketRow` has NO `premium` field. Premium is computed at the render layer from `crossRateAtom` + `row.priceA` + `row.priceB`. This is critical for per-row isolation. DO NOT add premium back to MarketRow.

2. **Cross-rate is decoupled.** `crossRateAtom` is a separate Jotai atom. `updateCrossRate()` only sets this atom — it never touches `pendingTickers` or `rowMapAtom`. Breaking this coupling will re-introduce the all-rows-flash-at-once bug.

3. **`sortedTickersAtom` has referential stability.** It's wrapped in `selectAtom` with element-wise array equality. If sort order doesn't change, the same reference is returned. Removing this causes ArbitrageTable to re-render on every cross-rate tick.

4. **Binance WS is subscribe-based** (not URL-encoded streams). The URL is always `wss://stream.binance.com:9443/ws`. Subscriptions are sent via `getSubscribeMessage` using `@miniTicker` streams (not `@trade`). `@miniTicker` provides the consolidated last price (`c` field) matching the Binance UI, updating every 500ms. `useWebSocketHandler` re-fires subscribe when the callback identity changes (tickers expand after REST fetch).

5. **Price formatting must preserve raw exchange values.** No rounding, no toFixed, no truncation. `maximumFractionDigits: 20`.

6. **Virtuoso recycling guard in MainRow.** `prevTickerRef` detects when the component is reused for a different ticker and resets price refs + flash state. Without this, sort-order changes cause spurious flashes.

7. **Folder structure:** Skills live directly in `.claude/skills/` (no `.agents/` indirection, no `.continue/` duplication).

8. **Cross-rate ticker subscription is dynamic.** `getSubscribeMessage` receives the cross-rate ticker from `crossRateConfig`, not hardcoded. Hardcoding breaks any tab that uses a different stablecoin (e.g., USDC).

9. **Incoming WS messages are filtered against `commonTickers`.** `tickerSetRef` in `useExchangeWebSocket` prevents stale/orphan tickers from leaking into the row map during tab switches.

10. **`handleToggleExpand` must use `pinnedRef`, not `pinned` directly.** `MemoMainRow`'s `areEqual` skips callback comparison, so a closure capturing `pinned` goes stale until the next price-driven re-render. The ref ensures the guard always sees the latest pinned state.

11. **Pin and mute are mutually exclusive.** `handleTogglePin` unmutes; `handleToggleMute` unpins + closes detail. Both `mutedAtom` and `isMuted` on `MarketRow` must stay in sync (same pattern as `pinnedAtom` / `isPinned`). `handleToggleMute` uses `pinnedRef` (not `pinned` closure) for the same stale-closure reason as `handleToggleExpand`.

12. **UI state atoms are restored from localStorage on tab switch.** `pinnedAtom`, `openRowsAtom`, `mutedAtom` are restored from `loadPrefs()` in `WebSocketProvider`'s pair-change `useEffect` (not cleared to empty). `sortFrozenAtom` is still reset to `false`. If a new UI state atom is added (e.g., selected rows), decide whether to persist or clear it there.

13. **Sort freezes on tbody hover.** `sortFrozenAtom` gates `_freezeAwareSortedAtom` which caches a `_frozenSnapshot` (module-level variable). When frozen, `sortedTickersAtom` returns the snapshot instead of the live sort. Prices still update live — only order is frozen. Do not remove the freeze layer or the snapshot variable.

14. **No fallback ticker arrays.** `getAvailableTickers` returns `[]` when cache is empty. Skeleton rows fill the table until REST APIs respond. Do not re-add hardcoded fallback arrays.

15. **User preferences persist in localStorage per tab.** Key format: `premium-table:prefs:${marketKeyA}|${marketKeyB}`. `WebSocketProvider` loads prefs on tab switch/refresh; `ArbitrageTable` saves via effect with `prevKeysRef` guard (skips saving when market keys just changed, preventing stale atom values from overwriting saved prefs). A continuous sync effect sets `isPinned`/`isMuted` flags on `rowMapAtom` as rows arrive in incremental WS batches.

16. **Binance REST uses `/ticker/price`, not `exchangeInfo`.** The lighter endpoint returns `{symbol, price}[]` instead of full exchange metadata (~1.5MB). Prices are cached in `restPriceCache` and seeded into rows before WS connects via `getCachedPrices()`. Do not switch back to `exchangeInfo`.

17. **WebSocket readyState is exposed via atoms.** `wsReadyStateAAtom`/`wsReadyStateBAtom` default to `3` (CLOSED), set from `useExchangeWebSocket` return values, synced via `useEffect` in `WebSocketProvider`. Read in `ArbitrageTable` for header status dots.

21. **Heartbeat is adapter-driven.** `ExchangeAdapter.heartbeatConfig` is optional. When set, `useWebSocketHandler` passes it to `react-use-websocket`'s built-in `heartbeat` option. Only adapters that need application-level ping (e.g., Bybit) set this. Do not add manual `setInterval` ping logic — use the library's heartbeat support.

22. **Ticker normalization is centralized in `tickerNormalizer.ts`.** `EXCHANGE_ALIASES` maps `(exchangeId, exchangeName) → canonicalName`. Each adapter calls `createTickerNormalizer(exchangeId)` at module scope and uses `normalizer.toCanonical()` / `normalizer.toExchange()` at 3 touch points: `fetchAvailableTickers`, `getSubscribeMessage`, `parseMessage`. `DELISTED_TICKERS` stays per-adapter (exchange-specific concern). When adding a new exchange, add aliases to the centralized registry and wire up the normalizer in the adapter.

23. **Bybit Spot: max 10 args per subscribe request.** `getSubscribeMessage` returns `string[]` with batches of 10. The `ExchangeAdapter` interface allows `string | string[]` return type. `useExchangeWebSocket.ts` iterates the array and sends each message. Other adapters (Upbit, Binance) still return a single string. If adding an exchange with similar limits, return `string[]` from `getSubscribeMessage`.

24. **Bithumb uses the same Blob→JSON path as Upbit.** Both exchanges send Blob-wrapped SIMPLE format messages with `cd`/`tp` fields. The Blob handling branch in `useExchangeWebSocket.ts` matches both `'upbit'` and `'bithumb'` adapter IDs and reuses `parseUpbitJson`. If adding another exchange with Blob messages and the same SIMPLE format, extend this check. If the format differs, add a separate branch.

25. **OKX uses JSON messages (not Blob).** Falls into the generic synchronous `parseMessage` path in `useExchangeWebSocket.ts` — same as Binance/Bybit. Heartbeat is `"ping"` (plain string) at 25s. Subscribe messages batched at 25 args per message (returns `string[]`). Symbol format is hyphen-separated (`BTC-USDT`), parsed by splitting on `-`.

26. **Exchange brand colors are centralized in `src/exchanges/colors.ts`.** `EXCHANGE_COLORS` maps exchange display name → hex color. Used in `ArbitrageTable` for price column header text color and in `DetailRow` for one-way transfer gradient. When adding a new exchange, add its brand color here. Fallback is `#00ff00` (lime green).

18. **react-grid-layout is dev-only.** It's in `devDependencies`, NOT `peerDependencies`. The library build (`build:lib`) does not include it. Only `App.tsx` imports it. Do not add it to `src/lib.ts` exports or vite externals.

19. **`setUpdatesPaused` exported for consumer resize integration.** Consumers embedding `<PremiumTable>` in a resizable react-grid-layout can call `setUpdatesPaused(true)` on resize start and `setUpdatesPaused(false)` on resize stop to freeze RAF flushes and buffer cross-rate updates during drag. The dev `App.tsx` uses a fixed (non-resizable) grid item as a usage reference.

20. **Sort freeze is disabled during skeleton loading.** `TableBody` in `VirtuosoTableComponents.tsx` checks `tickersAtom.length > 0` before setting `sortFrozenAtom` to `true`. Without this, hovering skeleton rows would freeze an empty sort snapshot and block real data from appearing correctly.

---

## Known Issues / Future Work

- **~~Upbit REST proxy~~:** Fixed — switched from Vite dev proxy (`/api/upbit`) to direct `https://api.upbit.com/v1/market/all` endpoint (CORS-safe). No proxy needed.
- **Wallet status** is still randomly generated per ticker (placeholder). Needs actual server API with backend, because some exchanges require POST requests with API key and secret.
- **No test framework** configured. Verification is manual.
- **Sort order instability (partially mitigated):** Sort freezes on tbody hover, but rows still jump when the mouse is outside the table. User decided this is acceptable — without hover, there's no click target to protect.
- **`useWebSocketHandler` re-subscribe:** Sends ALL tickers on re-subscribe. Non-issue in practice since skeleton loading (0.1.6+) means the full ticker list is only sent once per tab. Binance handles duplicates gracefully.
- **Flash still needs live verification.** The cross-rate decoupling and Virtuoso recycling guard are architecturally correct but should be visually confirmed with `npm run dev` — check that rows flash independently, not all at once.
- **Export/share:** Export current table snapshot (pinned rows, premiums) as CSV or shareable link. Considerable for future.
- **Alerts/notifications:** Notify when a ticker's premium crosses a user-defined threshold. Considerable for future.
- **~~Shared ticker normalization utility~~:** Done — `src/exchanges/tickerNormalizer.ts` provides `createTickerNormalizer(exchangeId)` with centralized `EXCHANGE_ALIASES` registry. All three adapters wired up.
- **~~GitHub Actions automated publish~~:** Done — `.github/workflows/publish.yml` auto-publishes to GitHub Packages on version change and creates GitHub Releases. Husky pre-push hook gates pushes on build+lint.
- **Coinbase ticker aliases may be needed.** Coinbase lists some tickers under different names than other exchanges (e.g., Polygon rebranded MATIC → POL on Coinbase). If a ticker exists on both exchanges but is missing from the table, add an alias to `coinbase: {}` in `tickerNormalizer.ts`. Same pattern as Binance's `BEAMX → BEAM`.
- **Upbit–Coinbase cross-rate depends on Upbit listing `KRW-USDC`.** The pair uses `{ type: 'ticker', code: 'KRW-USDC' }` from Upbit. If Upbit delists `KRW-USDC`, premiums for Upbit–Coinbase would break (cross-rate stays 0, all premiums show 0%). Same risk applies to Bithumb–Coinbase if Bithumb lists `KRW-USDC`.
