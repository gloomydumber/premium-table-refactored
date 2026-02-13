# @gloomydumber/premium-table

Multi-exchange crypto arbitrage premium table with live WebSocket price streaming. Compare price differentials between any two exchange markets in real time.

Built with React + TypeScript + MUI + Jotai + react-virtuoso.

## Installation

This package is published to [GitHub Packages](https://github.com/gloomydumber/premium-table-refactored/pkgs/npm/premium-table).

Point the `@gloomydumber` scope to GitHub Packages. Choose **one**:

**Option A** — Project-level `.npmrc` file:

```
@gloomydumber:registry=https://npm.pkg.github.com
```

**Option B** — `npm login` (per-user, no file needed):

```bash
npm login --scope=@gloomydumber --registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @gloomydumber/premium-table
```

### Peer Dependencies

All of the following must be installed in your project:

```bash
npm install react react-dom @emotion/react @emotion/styled \
  @mui/material @mui/icons-material jotai react-use-websocket react-virtuoso
```

| Package | Version |
|---------|---------|
| `react` / `react-dom` | `^18.0.0 \|\| ^19.0.0` |
| `@emotion/react` / `@emotion/styled` | `^11.0.0` |
| `@mui/material` / `@mui/icons-material` | `^6.0.0 \|\| ^7.0.0` |
| `jotai` | `^2.0.0` |
| `react-use-websocket` | `^4.0.0` |
| `react-virtuoso` | `^4.0.0` |

## Quick Start

```tsx
import { PremiumTable } from "@gloomydumber/premium-table";
import "@gloomydumber/premium-table/style.css";

function App() {
  return <PremiumTable />;
}
```

The CSS import is required — it bundles the JetBrains Mono font and base styles.

## API

### `<PremiumTable>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `string \| number` | `'100vh'` | Container height. Accepts any CSS value. |
| `theme` | `MUI Theme` | Dark theme | Custom MUI theme override. |

The component creates its own Jotai `<Provider>`, so its atoms are isolated from your app's Jotai store.

```tsx
// Custom height
<PremiumTable height={600} />
<PremiumTable height="calc(100vh - 64px)" />

// Custom MUI theme
import { createTheme } from "@mui/material";
const myTheme = createTheme({ palette: { mode: "dark" } });
<PremiumTable theme={myTheme} />
```

### Exports

```ts
// Component
import { PremiumTable } from "@gloomydumber/premium-table";
import type { PremiumTableProps } from "@gloomydumber/premium-table";

// Types
import type { MarketRow, WalletStatus } from "@gloomydumber/premium-table";
import type { ExchangeAdapter, NormalizedTick } from "@gloomydumber/premium-table";

// Exchange adapters
import {
  upbitAdapter, binanceAdapter, bybitAdapter, bithumbAdapter, okxAdapter,
} from "@gloomydumber/premium-table";
```

## Features

### Live Price Streaming

Connects to exchange WebSocket APIs and displays real-time prices. Price updates are batched via `requestAnimationFrame` — handles 500-1000+ messages/sec from Binance trade streams without blocking the main thread.

### Arbitrage Premium

Shows the price differential between two markets:

```
premium = (priceA / (priceB * crossRate)) - 1
```

Premium cells are color-coded by magnitude — red for positive, blue for negative, with opacity scaling from 0.08 (< 0.5%) to 0.55 (>= 5%).

#### Cross-Rate Resolution

When comparing markets with different quote currencies (e.g., KRW vs USDT), a cross-rate converts between them. Fallback hierarchy:

1. **Direct pair** — e.g., Upbit `KRW-USDT` ticker (best accuracy)
2. **BTC-derived** — `crossRate = BTC_priceA / BTC_priceB`
3. **Fixed 1** — same quote currency on both sides

### Price Flash Animation

Prices flash briefly (100ms) on update — red for price up, blue for price down.

### Skeleton Loading + Dynamic Ticker Discovery

On startup, skeleton rows fill the table while full ticker lists are fetched from exchange REST APIs. Once the REST responses arrive and WebSocket prices begin streaming, skeleton rows are replaced by real data. Subsequent tab switches use cached REST data for near-instant loading.

### Tab Navigation

Two-level tabs:
- **Outer tabs** — exchange pair (e.g., Upbit-Binance)
- **Inner tabs** — quote currency (e.g., USDT, USDC)

Korean-vs-Korean pairs have no inner tabs (both KRW).

### Row Actions

Icon-based actions appear in the ticker cell:

| Action | Icon | Behavior |
|--------|------|----------|
| **Pin** | Arrow up | Pins row to top of table. Hover-reveal on normal rows, always visible (green) when pinned. |
| **Mute** | Arrow down | Sorts row to bottom, dims it (opacity 0.3). Hover-reveal on normal rows, always visible when muted. |
| **Expand** | Chevron | Expands pinned row to show wallet status detail. Only available on pinned rows. |

Pin and mute are mutually exclusive — pinning unmutes, muting unpins.

### Preference Persistence

Pin, mute, and expand state is saved to `localStorage` per market pair tab. Preferences survive page refreshes and tab switches — switching from USDT to USDC and back restores your USDT pins. A reset button (↻) in the PREMIUM header clears all preferences for the current tab.

### Sort Order

Rows are sorted by priority:

1. Expanded pinned rows
2. Pinned rows
3. Normal rows — by |premium| descending
4. Muted rows — by |premium| descending

Ties are broken by insertion order (stable sort).

### Sort Freeze on Hover

When the mouse is over the table body, sort order freezes to prevent rows from jumping while you're reading or clicking. Prices still update live in every row — only the order is frozen. Sorting resumes when the mouse leaves.

### Virtualized Rendering

Uses `react-virtuoso` for efficient rendering of large ticker lists. Only visible rows are rendered in the DOM.

### Exchange Brand Colors

Each exchange has a distinct brand color used in table header price columns and wallet status detail gradients:

| Exchange | Color |
|----------|-------|
| Upbit | Blue (`#0A6CFF`) |
| Binance | Gold (`#F0B90B`) |
| Bybit | Teal (`#00C4B3`) |
| Bithumb | Orange (`#F37321`) |
| OKX | Silver (`#CFD3D8`) |

### Wallet Status Detail

Expanding a pinned row reveals per-network transfer status:
- Network name color indicates viable transfer direction (green = both, red = none, exchange-colored gradient = one-way)
- Shows deposit/withdraw status for each exchange

> **Note:** Wallet status is currently randomly generated placeholder data. A future version will connect to a server API.

### Price Formatting

Prices are displayed exactly as received from the exchange — no rounding, no truncation. KRW prices use Korean locale formatting, USD-based prices use US locale.

## Architecture

### Exchange Adapter Pattern

Each exchange is implemented as an `ExchangeAdapter`:

```ts
interface ExchangeAdapter {
  id: string;
  name: string;
  availableQuoteCurrencies: string[];
  getWebSocketUrl(quoteCurrency: string, tickers: string[]): string;
  getSubscribeMessage?(quoteCurrency: string, tickers: string[], crossRateTicker?: string): string;
  parseMessage(data: unknown): NormalizedTick | null;
  getAvailableTickers(quoteCurrency: string): string[];
  fetchAvailableTickers?(quoteCurrency: string): Promise<string[]>;
  normalizeSymbol(rawSymbol: string, quoteCurrency: string): string;
}
```

Adding a new exchange = implement one adapter file. No new hooks or components needed.

### State Management

Jotai atoms with per-row granularity:

- `rowMapAtom` — all row data (prices, pin/mute state)
- `crossRateAtom` — decoupled from row data to prevent all-rows re-render on cross-rate tick
- `sortedTickersAtom` — derived with referential stability (same sort order = same reference)
- `rowAtomFamily(ticker)` — per-row selector so only changed rows re-render

Premium is **not stored** — it's computed at render time from `crossRateAtom` + row prices. This is critical for per-row render isolation.

### Data Flow

```
WebSocket messages (500-1000+/sec)
  → ExchangeAdapter.parseMessage() → NormalizedTick
  → Module-level Maps (O(1) absorption)
  → requestAnimationFrame batch → Single React state flush per frame
  → Per-row atoms → Only changed rows re-render
```

## Development

```bash
git clone https://github.com/gloomydumber/premium-table-refactored.git
cd premium-table-refactored
npm install

npm run dev          # Vite dev server with HMR
npm run build        # TypeScript compile + Vite production build
npm run build:lib    # Library build (dist/index.js + dist/index.d.ts + dist/index.css)
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Supported Exchanges

| Exchange | Quote Currencies | WebSocket | REST (ticker discovery) |
|----------|-----------------|-----------|------------------------|
| Upbit | KRW | `wss://api.upbit.com/websocket/v1` | `https://api.upbit.com/v1/market/all` |
| Binance | USDT, USDC | `wss://stream.binance.com:9443/ws` | `https://api.binance.com/api/v3/ticker/price` |
| Bybit | USDT, USDC | `wss://stream.bybit.com/v5/public/spot` | `https://api.bybit.com/v5/market/tickers?category=spot` |
| Bithumb | KRW | `wss://ws-api.bithumb.com/websocket/v1` | `https://api.bithumb.com/v1/market/all` |
| OKX | USDT, USDC | `wss://ws.okx.com:8443/ws/v5/public` | `https://www.okx.com/api/v5/market/tickers?instType=SPOT` |

## Changelog

See [GitHub Releases](https://github.com/gloomydumber/premium-table-refactored/releases) for version history and release notes.

## License

MIT
