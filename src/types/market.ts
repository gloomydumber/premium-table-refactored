export interface WalletStatus {
  networkName: string;
  marketA: { deposit: boolean; withdraw: boolean };
  marketB: { deposit: boolean; withdraw: boolean };
}

export interface MarketRow {
  id: number;
  ticker: string;
  priceA: number;
  priceB: number;
  walletStatus: WalletStatus[];
  isPinned: boolean;
}
