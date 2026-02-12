# HANDOFF.md

Session handoff notes. Read this at the start of every session. Update it before closing.

Last updated: 2026-02-12

---

## Completed This Session (2026-02-12)

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

4. **Binance WS is subscribe-based** (not URL-encoded streams). The URL is always `wss://stream.binance.com:9443/ws`. Subscriptions are sent via `getSubscribeMessage`. `useWebSocketHandler` re-fires subscribe when the callback identity changes (tickers expand after REST fetch).

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

17. **WebSocket readyState is exposed via atoms.** `wsReadyStateAAtom`/`wsReadyStateBAtom` are set from `useExchangeWebSocket` return values, synced via `useEffect` in `WebSocketProvider`. Reset to `0` on tab switch. Read in `ArbitrageTable` for header status dots.

18. **react-grid-layout is dev-only.** It's in `devDependencies`, NOT `peerDependencies`. The library build (`build:lib`) does not include it. Only `App.tsx` imports it. Do not add it to `src/lib.ts` exports or vite externals.

19. **`setUpdatesPaused` exported for consumer resize integration.** Consumers embedding `<PremiumTable>` in a resizable react-grid-layout can call `setUpdatesPaused(true)` on resize start and `setUpdatesPaused(false)` on resize stop to freeze RAF flushes and buffer cross-rate updates during drag. The dev `App.tsx` uses a fixed (non-resizable) grid item as a usage reference.

20. **Sort freeze is disabled during skeleton loading.** `TableBody` in `VirtuosoTableComponents.tsx` checks `tickersAtom.length > 0` before setting `sortFrozenAtom` to `true`. Without this, hovering skeleton rows would freeze an empty sort snapshot and block real data from appearing correctly.

---

## Known Issues / Future Work

- **Upbit REST proxy** (`/api/upbit` in vite.config.ts) only works in dev. Production deployment needs a real proxy or backend endpoint.
- **Wallet status** is still randomly generated per ticker (placeholder). Needs actual server API with backend, because some exchanges require POST requests with API key and secret.
- **No test framework** configured. Verification is manual.
- **Sort order instability (partially mitigated):** Sort freezes on tbody hover, but rows still jump when the mouse is outside the table. User decided this is acceptable — without hover, there's no click target to protect.
- **`useWebSocketHandler` re-subscribe:** Sends ALL tickers on re-subscribe. Non-issue in practice since skeleton loading (0.1.6+) means the full ticker list is only sent once per tab. Binance handles duplicates gracefully.
- **Flash still needs live verification.** The cross-rate decoupling and Virtuoso recycling guard are architecturally correct but should be visually confirmed with `npm run dev` — check that rows flash independently, not all at once.
- **Export/share:** Export current table snapshot (pinned rows, premiums) as CSV or shareable link. Considerable for future.
- **Alerts/notifications:** Notify when a ticker's premium crosses a user-defined threshold. Considerable for future.
