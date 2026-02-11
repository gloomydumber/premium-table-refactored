/**
 * Format price preserving the exact value from the exchange response.
 * No rounding, no toFixed, no truncation — display the number as-is.
 */
export function formatPrice(price: number, quoteCurrency: string): string {
  if (price <= 0) return '-';
  switch (quoteCurrency) {
    case 'KRW':
      return price.toLocaleString('ko-KR', { maximumFractionDigits: 20 });
    case 'USDT':
    case 'USDC':
    case 'USD':
      return price.toLocaleString('en-US', { maximumFractionDigits: 20 });
    default:
      return price.toLocaleString('en-US', { maximumFractionDigits: 20 });
  }
}

/**
 * Format premium as percentage: "+1.23%" or "-0.45%"
 */
export function formatPremium(p: number): string {
  if (p === 0) return '0.00%';
  return `${p >= 0 ? '+' : ''}${(p * 100).toFixed(2)}%`;
}

/**
 * Calculate premium background color with opacity based on magnitude.
 */
export function calculatePremiumBackgroundColor(premium: number): string {
  const absPremium = Math.abs(premium) * 100;
  if (absPremium === 0) return 'transparent';
  const baseColor = premium >= 0 ? '255, 0, 0' : '0, 0, 255';

  let opacity: number;
  if (absPremium < 0.5) opacity = 0.08;
  else if (absPremium < 1) opacity = 0.15;
  else if (absPremium < 2) opacity = 0.25;
  else if (absPremium < 3) opacity = 0.35;
  else if (absPremium < 5) opacity = 0.45;
  else opacity = 0.55;

  return `rgba(${baseColor}, ${opacity})`;
}
