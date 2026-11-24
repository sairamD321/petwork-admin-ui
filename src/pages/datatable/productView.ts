import type { DataRecord } from '../../api/records';
import { cardOfferOf, cartVariantIdOf, productCardTitleOf } from './cellValue';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export interface ViewVariant {
  id?: string;
  size?: string;
  mrp?: number;
  price?: number;
  discount?: number;
  images: string[];
}

export interface ProductView {
  name: string;
  brand?: string;
  description?: string;
  highlights: { label: string; value: string }[];
  variants: ViewVariant[];
  /** The variant that was clicked (else the default one). */
  initialIndex: number;
}

const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

/** Text for a value that may be plain or an object like `{ name: "Dog" }`. */
function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(text).filter((v): v is string => !!v);
    return parts.length ? [...new Set(parts)].join(', ') : undefined;
  }
  if (isObj(value)) return text(value.name ?? value.displayName ?? value.label ?? value.value);
  return undefined;
}

/** First value among `sources` whose key matches one of `aliases` (case and punctuation ignored). */
function pick(sources: Obj[], aliases: string[]): string | undefined {
  const names = new Set(aliases.map(normalize));
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (names.has(normalize(key))) {
        const found = text(value);
        if (found) return found;
      }
    }
  }
  return undefined;
}

const looksLikeUrl = (v: unknown): v is string =>
  typeof v === 'string' && /^(https?:)?\/\/|^\/\S|^data:image\//i.test(v.trim());

const IMAGE_KEY = /image|photo|picture|thumbnail|gallery/i;

/** Every picture URL on an object (main image first), not looking inside its `variants`. */
function imagesOf(source: Obj): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (looksLikeUrl(v)) out.push(v.trim());
    else if (isObj(v)) add(v.url ?? v.imageUrl ?? v.src ?? v.link);
  };
  const keys = Object.keys(source)
    .filter((k) => IMAGE_KEY.test(k))
    // `mainImage` / `image` before lists like `images`, `gallery`.
    .sort((a, b) => Number(/main|primary|default/i.test(b)) - Number(/main|primary|default/i.test(a)));
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) value.forEach(add);
    else add(value);
  }
  return out;
}

const HIGHLIGHTS: [string, string[]][] = [
  ['Brand', ['brandName', 'brand']],
  ['Product type', ['productType', 'productTypeName']],
  ['Pet type', ['petType', 'petTypeName']],
  ['Flavour', ['flavour', 'flavor', 'flavourName']],
  ['Life stage', ['lifeStage', 'lifeStageName']],
  ['Breed size', ['breedSize', 'breedSizeName']],
  ['Category', ['categoryName', 'category', 'foodCategory']],
  ['SKU', ['sku']],
  ['HSN code', ['hsnCode', 'hsn']],
];

/**
 * Reads a "view" response into what the product page shows. The response may be a product with
 * `variants`, a variant with a nested `product`, or a single flat variant.
 */
export function toProductView(root: DataRecord, clickedVariantId: string | undefined): ProductView {
  const product = isObj(root.product) ? root.product : root;
  const listed = [root.variants, product.variants].find(Array.isArray) as unknown[] | undefined;
  const rawVariants = (listed ?? []).filter(isObj);
  if (!rawVariants.length) rawVariants.push(root);

  const productImages = imagesOf(product);
  const variants: ViewVariant[] = rawVariants.map((v) => {
    const offer = cardOfferOf({ variants: [{ ...v, isDefault: true }] });
    const own = imagesOf(v);
    return {
      id: cartVariantIdOf(v),
      size: offer.size,
      mrp: offer.mrp,
      price: offer.price,
      discount: offer.discount,
      images: [...new Set([...own, ...productImages])],
    };
  });

  let initialIndex = variants.findIndex((v) => v.id !== undefined && v.id === clickedVariantId);
  if (initialIndex < 0) initialIndex = Math.max(0, rawVariants.findIndex((v) => v.isDefault === true));

  const sources = [product, root, rawVariants[initialIndex]];
  return {
    name: productCardTitleOf(product) || pick(sources, ['productName', 'name', 'title']) || 'Product',
    brand: pick(sources, ['brandName', 'brand']),
    description: pick(sources, ['productDetails', 'description', 'details', 'productDescription', 'about']),
    highlights: HIGHLIGHTS.map(([label, aliases]) => ({ label, value: pick(sources, aliases) ?? '' })).filter(
      (h) => h.value,
    ),
    variants,
    initialIndex,
  };
}
