// Currency & number formatting helpers for Flynkit.

/**
 * Format an amount as Indian Rupees with grouping (lakhs/crores style),
 * no decimals. Example: 1499 → "₹1,499".
 */
export function formatINR(amount: number | undefined | null): string {
  const n = Number(amount ?? 0);
  if (!isFinite(n)) return '₹0';
  // Round to whole rupees (Blinkit/Zepto style).
  const rounded = Math.round(n);
  // Indian numbering grouping (en-IN).
  const formatted = rounded.toLocaleString('en-IN');
  return `₹${formatted}`;
}
