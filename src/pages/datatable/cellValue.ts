const IMAGE_URL = /^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg|avif)(\?\S*)?$/i;

export function isImageUrl(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_URL.test(value);
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** Plain-text form of any record value, for display and search. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return numberFormat.format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
