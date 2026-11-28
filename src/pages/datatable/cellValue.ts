import { LEGACY_ID_NAMES, toCartKey, UPC_NAMES, VARIANT_ID_NAMES } from '../../api/cartKey';

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

const normalizeName = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

const TITLE_PART_ALIASES = [
  ['brandName', 'brand', 'brandname'],
  ['productName', 'name', 'product'],
  ['flavour', 'flavor', 'flavourName', 'flavorName'],
  ['lifeStage', 'lifestage', 'lifeStageName', 'lifestageName'],
  ['petType', 'pettype', 'petTypeName', 'pettypename'],
  ['categoryName', 'category', 'categoryname'],
] as const;

export const CARD_TITLE_FIELD_NAMES = [
  ...TITLE_PART_ALIASES.flat(),
  'breedSize',
  'breedsize',
] as const;

function scalarTitleValue(value: unknown, depth = 0): string | undefined {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text !== '—' ? text : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const values = value.map((item) => scalarTitleValue(item, depth + 1)).filter((item): item is string => !!item);
    return values.length ? [...new Set(values)].join(', ') : undefined;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['name', 'displayName', 'label', 'value', 'code']) {
      const found = Object.entries(record).find(([field]) => normalizeName(field) === normalizeName(key));
      if (found) {
        const text = scalarTitleValue(found[1], depth + 1);
        if (text) return text;
      }
    }
  }
  return undefined;
}

function titleValueForAliases(record: Record<string, unknown>, aliases: readonly string[], depth = 0): string | undefined {
  if (depth > 4) return undefined;
  const aliasNames = new Set(aliases.map(normalizeName));

  for (const [key, value] of Object.entries(record)) {
    if (aliasNames.has(normalizeName(key))) {
      const text = scalarTitleValue(value);
      if (text) return text;
    }
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const text = titleValueForAliases(item as Record<string, unknown>, aliases, depth + 1);
          if (text) return text;
        }
      }
    } else if (value && typeof value === 'object') {
      const text = titleValueForAliases(value as Record<string, unknown>, aliases, depth + 1);
      if (text) return text;
    }
  }
  return undefined;
}

/** Combined card title: brand + product name + flavour + life stage + pet type + category. */
export function productCardTitleOf(
  record: Record<string, unknown>,
  fallback = '',
): string {
  const parts = TITLE_PART_ALIASES
    .map((aliases) => titleValueForAliases(record, aliases))
    .filter((value): value is string => !!value);

  const title = parts.length ? [...new Set(parts)].join(' ') : fallback.trim();
  return title || '';
}

function cardNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function cardNestedValue(record: Record<string, unknown>, aliases: readonly string[]): unknown {
  const names = new Set(aliases.map(normalizeName));
  for (const [key, value] of Object.entries(record)) {
    if (names.has(normalizeName(key)) && value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

/** The offer row shown below a card title: size on the left, MRP and final price on the right. */
export function cardOfferOf(record: Record<string, unknown>): {
  size?: string;
  mrp?: number;
  price?: number;
  discount?: number;
} {
  const variants = Array.isArray(record.variants)
    ? record.variants.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];

  const formatUnitSize = (source: Record<string, unknown>): string | undefined => {
    const sizeValue = cardNestedValue(source, ['unitSize', 'size', 'packSize', 'weight', 'sizeName']);
    const unitType = cardNestedValue(source, ['unitType', 'unit', 'measureType', 'measurementUnit']);
    const sizeText = scalarTitleValue(sizeValue);
    const unitText = scalarTitleValue(unitType);
    if (!sizeText) return undefined;
    if (!unitText) return sizeText;

    const normalizedSize = normalizeName(sizeText);
    const normalizedUnit = normalizeName(unitText);
    if (normalizedSize.includes(normalizedUnit)) return sizeText;
    return `${sizeText} ${unitText}`;
  };

  const source = variants.find((variant) => variant.isDefault === true) ??
    variants.find((variant) =>
      cardNestedValue(variant, ['finalPrice', 'sellingPrice', 'salePrice', 'price']) !== undefined ||
      cardNestedValue(variant, ['mrp', 'mrpPrice', 'maximumRetailPrice']) !== undefined,
    ) ??
    record;
  const size = formatUnitSize(source);

  const mrp = cardNumber(cardNestedValue(source, ['mrp', 'mrpPrice', 'maximumRetailPrice', 'costPrice']));
  const price = cardNumber(cardNestedValue(source, ['finalPrice', 'sellingPrice', 'salePrice', 'price']));
  const suppliedDiscount = cardNumber(cardNestedValue(source, ['discount', 'discountPercent', 'discountPercentage']));
  const computedDiscount = mrp && price && mrp > price
    ? Math.round(((mrp - price) / mrp) * 100)
    : undefined;
  return {
    size,
    mrp,
    price,
    discount: suppliedDiscount ?? computedDiscount,
  };
}

const scalarText = (v: unknown) => (v === undefined || typeof v === 'object' ? undefined : String(v));

/**
 * A variant's cart key (see `api/cartKey.ts`): its variant id when it has one, else its UPC
 * (new backend), else a generic id from older rows.
 */
export function variantCartKeyOf(variant: Record<string, unknown>): string | undefined {
  const variantId = scalarText(cardNestedValue(variant, VARIANT_ID_NAMES));
  if (variantId) return toCartKey('variantId', variantId);
  const upc = scalarText(cardNestedValue(variant, UPC_NAMES));
  if (upc) return toCartKey('upc', upc);
  const id = scalarText(cardNestedValue(variant, LEGACY_ID_NAMES));
  return id ? toCartKey('variantId', id) : undefined;
}

/**
 * The cart key a product's cart line is for: its default variant (else its first one), or the record
 * itself when it has no `variants` (a row that already is a variant).
 */
export function cartKeyOf(record: Record<string, unknown>): string | undefined {
  const variants = Array.isArray(record.variants)
    ? record.variants.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];
  return variantCartKeyOf(variants.find((v) => v.isDefault === true) ?? variants[0] ?? record);
}

/** Cart key -> the variant's main image, from the products on screen (the cart panel's fallback picture). */
export function cartImagesByKey(records: Record<string, unknown>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const record of records) {
    const variants = Array.isArray(record.variants) ? record.variants : [record];
    const fallback = variantImageUrlOf(record);
    for (const v of variants) {
      if (!v || typeof v !== 'object') continue;
      const variant = v as Record<string, unknown>;
      const key = variantCartKeyOf(variant);
      if (!key) continue;
      const image = typeof variant.mainImage === 'string' && variant.mainImage ? variant.mainImage : fallback;
      if (image) out[key] = image;
    }
  }
  return out;
}

/** Cart key -> the product card's title (brand + name + flavour + ...), so the cart and invoice match the cards. */
export function cartTitlesByKey(records: Record<string, unknown>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const record of records) {
    const title = productCardTitleOf(record);
    if (!title) continue;
    const variants = Array.isArray(record.variants) ? record.variants : [record];
    for (const v of variants) {
      if (!v || typeof v !== 'object') continue;
      const key = variantCartKeyOf(v as Record<string, unknown>);
      if (key) out[key] = title;
    }
  }
  return out;
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
