const IMAGE_URL = /^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg|avif)(\?\S*)?$/i;

export function isImageUrl(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_URL.test(value);
}

function hasMainImage(value: unknown): value is { mainImage: string; isDefault?: unknown } {
  return typeof value === 'object' && value !== null && 'mainImage' in value && isImageUrl(value.mainImage);
}

/** A product's picture from `variants[].mainImage`: the default variant's, else the first one's. */
export function variantImageUrlOf(record: Record<string, unknown>): string | undefined {
  if (!Array.isArray(record.variants)) return undefined;
  const variants = record.variants.filter(hasMainImage);
  return variants.find((variant) => variant.isDefault === true)?.mainImage ?? variants[0]?.mainImage;
}

/** A column meant to hold a picture, judged by its field or heading (e.g. "Image"). */
export const isImageColumn = (c: { field: string; displayName: string }) =>
  /image|photo|picture|thumbnail/i.test(`${c.field} ${c.displayName}`);

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
