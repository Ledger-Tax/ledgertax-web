/**
 * Formats an amount in smallest units (a decimal string, as the API sends it) with `decimals` places.
 * Uses BigInt, never floating point: for example ("15000000", 7) gives "1.5". Trailing zeros are
 * trimmed, but at least one decimal digit is kept only if the amount has a fraction.
 *
 * @returns the formatted amount, or the original text if it is not a whole number
 */
export function formatUnits(amount: string, decimals: number): string {
  if (!/^-?\d+$/.test(amount) || !Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    return amount;
  }
  const negative = amount.startsWith('-');
  const digits = (negative ? amount.slice(1) : amount).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Shortens an asset id for display: `native` stays, `CODE:GABC...WXYZ` becomes `CODE (GABC…WXYZ)`. */
export function shortAsset(asset: string | undefined): string {
  if (!asset) return '';
  if (asset === 'native') return 'XLM';
  const [code, issuer] = asset.split(':');
  if (!issuer) return asset;
  return `${code} (${issuer.slice(0, 4)}…${issuer.slice(-4)})`;
}

/** Shortens an address or hash for display. */
export function shorten(value: string | undefined, keep = 6): string {
  if (!value) return '';
  return value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
