import { resolveApiPath, resolveRecordPath } from './blueprint';
import { shareInFlight } from './cache';
import { apiRequest } from './client';
import { productCardTitleOf } from '../pages/datatable/cellValue';

/** A row from a blueprint's `dataApi`; its shape is described by the blueprint's columns. */
export type DataRecord = Record<string, unknown>;

export interface RecordPage {
  records: DataRecord[];
  hasNext: boolean;
}

const PAGE_SIZE = 24;

/** Accepts either a bare array or a `{ records: [...] }` envelope. */
function toRecords(body: unknown): DataRecord[] {
  if (Array.isArray(body)) return body as DataRecord[];
  if (body && typeof body === 'object' && Array.isArray((body as { records?: unknown }).records)) {
    return (body as { records: DataRecord[] }).records;
  }
  return [];
}

function toRecordPage(body: unknown, page: number): RecordPage {
  const records = toRecords(body);
  let hasNext = records.length === PAGE_SIZE;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const metadata = body as { hasNext?: unknown; totalPages?: unknown; total?: unknown };
    if (typeof metadata.hasNext === 'boolean') {
      hasNext = metadata.hasNext;
    } else if (typeof metadata.totalPages === 'number') {
      hasNext = page + 1 < metadata.totalPages;
    } else if (typeof metadata.total === 'number') {
      hasNext = (page + 1) * PAGE_SIZE < metadata.total;
    }
  }

  return { records, hasNext };
}

async function loadRecordsPage(url: string): Promise<RecordPage> {
  const query = url.slice(url.indexOf('?') + 1);
  const page = Number(new URLSearchParams(query).get('page') ?? 0);
  return toRecordPage(await apiRequest<unknown>(url), page);
}

const loadRecordsPageShared = shareInFlight(loadRecordsPage);

function recordsPageUrl(dataApi: string, page: number): string {
  const path = resolveApiPath(dataApi);
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&size=${PAGE_SIZE}`;
}

/** Fetches one page of records, always fresh from the backend (not cached). */
export function fetchRecords(dataApi: string, page: number): Promise<RecordPage> {
  return loadRecordsPageShared(recordsPageUrl(dataApi, page));
}

/**
 * Options for a blueprint dropdown, always fresh from the backend (not cached).
 * The blueprint's `api` already carries its own page/size.
 */
export const fetchOptions = shareInFlight(async (api: string) => toRecords(await apiRequest<unknown>(resolveApiPath(api))));

/** Page size for filtered searches. */
export const SEARCH_PAGE_SIZE = 24;

/**
 * GET `{dataApi}?field=value&...&page={page}&size=24` — the backend does the filtering.
 * Not cached: filters change with every keystroke and results must stay fresh.
 */
export async function searchRecords(
  dataApi: string,
  filters: Record<string, string>,
  page: number,
): Promise<DataRecord[]> {
  const path = resolveApiPath(dataApi);
  const params = new URLSearchParams(filters);
  params.set('page', String(page));
  params.set('size', String(SEARCH_PAGE_SIZE));
  const sep = path.includes('?') ? '&' : '?';
  return toRecords(await apiRequest<unknown>(`${path}${sep}${params}`));
}

/** POST a new record to a form blueprint's `createApi`. */
export function createRecord(createApi: string, body: Record<string, unknown> | FormData) {
  return apiRequest<unknown>(resolveApiPath(createApi), { method: 'POST', body });
}

/**
 * GET one record's full details through a form blueprint's `dataApi`, for prefilling the edit form.
 * Accepts the record itself or an envelope: `{ records: [..] }`, `{ record }` or `{ data }`.
 */
export async function fetchRecord(dataApi: string, recordId: string): Promise<DataRecord> {
  return unwrapRecord(await apiRequest<unknown>(resolveRecordPath(dataApi, recordId)));
}

/** The one record in a response: bare, or inside `{ records: [..] }`, `{ record }` or `{ data }`. */
function unwrapRecord(body: unknown): DataRecord {
  const isObject = (v: unknown): v is DataRecord => !!v && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(body)) return isObject(body[0]) ? body[0] : {};
  if (!isObject(body)) return {};
  const records = body.records;
  if (Array.isArray(records)) return isObject(records[0]) ? records[0] : {};
  if (isObject(body.record)) return body.record;
  if (isObject(body.data)) return body.data;
  return body;
}

/** GET a "view" action's `dataApi` for one variant (`{variantId}` filled in), always fresh. */
export async function fetchVariantDetails(dataApi: string, variantId: string): Promise<DataRecord> {
  const id = encodeURIComponent(variantId);
  const path = dataApi.replace(/\{(variantId|varientId|recordId|id)\}/gi, id);
  return unwrapRecord(await apiRequest<unknown>(resolveApiPath(path)));
}

/**
 * PATCH an edited record to the form blueprint's `createApi` (the `dataApi` is only read, for prefilling).
 * A `{recordId}` in the `createApi`, if there is one, is filled in.
 */
export function updateRecord(createApi: string, recordId: string | undefined, body: Record<string, unknown> | FormData) {
  const path = recordId ? resolveRecordPath(createApi, recordId) : resolveApiPath(createApi);
  return apiRequest<unknown>(path, { method: 'PATCH', body });
}

/**
 * POST a variant's cart quantity to a row action's `createApi` (e.g. `/products/platform/{version}/api/cart`).
 * Sent on "Add to Cart" and on every +/- after it, always with the new total quantity.
 */
export function setCartQuantity(createApi: string, variantId: string, quantity: number) {
  return apiRequest<unknown>(resolveApiPath(createApi), { method: 'POST', body: { variantId, quantity } });
}

const VARIANT_ID_KEYS = ['variantId', 'varientId', 'variant_id'];
const QUANTITY_KEYS = ['quantity', 'qty', 'cartQuantity', 'count'];

/** One line of the saved cart, with whatever display details the backend sends. */
export interface CartItem {
  variantId: string;
  quantity: number;
  name?: string;
  size?: string;
  /** Price of one unit. */
  price?: number;
  mrp?: number;
  imageUrl?: string;
}

/** The saved cart: its lines, plus any bill amounts the backend works out itself. */
export interface Cart {
  items: CartItem[];
  /** e.g. { deliveryCharge: 25, handlingCharge: 2 } when present in the response. */
  charges: { label: string; amount: number }[];
  grandTotal?: number;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

const pick = (o: Obj | undefined, keys: string[]) => {
  if (!o) return undefined;
  const key = keys.find((k) => o[k] !== undefined && o[k] !== null && o[k] !== '');
  return key ? o[key] : undefined;
};
const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^0-9.-]/g, '')) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const IMAGE_KEY = /image|img|photo|picture|thumb/i;
const looksLikeUrl = (v: unknown): v is string => typeof v === 'string' && /^(https?:\/\/|\/|data:image\/)/i.test(v.trim());

/** The first URL-ish value under an image-like key (`mainImage`, `images[0]`, `variant.imageUrl`, `{ url }`...). */
function findImage(node: unknown, underImageKey = false, depth = 0): string | undefined {
  if (depth > 4 || node === null || node === undefined) return undefined;
  if (underImageKey && looksLikeUrl(node)) return node.trim();
  if (Array.isArray(node)) {
    for (const v of node) {
      const found = findImage(v, underImageKey, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;
  const o = node as Obj;
  // Image-named keys first (main image before others), then a `{ url }` inside an image list.
  const keys = Object.keys(o).sort((a, b) => Number(/main/i.test(b)) - Number(/main/i.test(a)));
  for (const k of keys) {
    if (!IMAGE_KEY.test(k)) continue;
    const found = findImage(o[k], true, depth + 1);
    if (found) return found;
  }
  if (underImageKey) {
    const url = pick(o, ['url', 'src', 'href', 'link']);
    if (looksLikeUrl(url)) return url.trim();
  }
  for (const k of ['variant', 'product']) {
    const found = findImage(o[k], false, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** A cart line from one response object, looking in it and its nested `variant` / `product`. */
function toCartItem(o: Obj): CartItem | undefined {
  const variant = isObj(o.variant) ? o.variant : undefined;
  const product = isObj(o.product) ? o.product : undefined;
  const id = pick(o, VARIANT_ID_KEYS) ?? pick(variant, ['id', '_id', ...VARIANT_ID_KEYS]);
  const quantity = num(pick(o, QUANTITY_KEYS));
  if (text(id) === undefined || quantity === undefined || quantity <= 0) return undefined;

  const from = (keys: string[]) => pick(o, keys) ?? pick(variant, keys) ?? pick(product, keys);
  const unitSize = text(from(['unitSize', 'size', 'packSize', 'weight']));
  const unitType = text(from(['unitType', 'unit']));
  const size = unitSize && unitType && !unitSize.toLowerCase().includes(unitType.toLowerCase())
    ? `${unitSize} ${unitType}`
    : unitSize;
  const image = findImage(o);

  return {
    variantId: String(id),
    quantity,
    // Same title as the product cards (brand + name + flavour + ...), else the plain name.
    name: productCardTitleOf(o) || text(from(['productName', 'name', 'title', 'displayName'])),
    size,
    price: num(from(['finalPrice', 'unitPrice', 'sellingPrice', 'salePrice', 'price'])),
    mrp: num(from(['mrp', 'mrpPrice', 'maximumRetailPrice'])),
    imageUrl: image,
  };
}

const CHARGE_LABELS: Record<string, string> = {
  deliveryCharge: 'Delivery charge',
  deliveryFee: 'Delivery charge',
  handlingCharge: 'Handling charge',
  handlingFee: 'Handling charge',
  tax: 'Tax',
  gst: 'GST',
  discount: 'Discount',
};

/**
 * GET the saved cart. The response shape isn't fixed, so this walks it and takes every object with a
 * variant id (`variantId`, or `variant.id`) and a quantity as a line; bill amounts are read off the top.
 */
export async function fetchCart(cartApi: string): Promise<Cart> {
  const body = await apiRequest<unknown>(resolveApiPath(cartApi));
  const items: CartItem[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, depth + 1));
      return;
    }
    const item = toCartItem(node as Obj);
    if (item) items.push(item);
    else Object.values(node).forEach((v) => visit(v, depth + 1));
  };
  visit(body, 0);

  // Bill amounts sit at the top level, or in a single wrapper object (`data`, `cart`, `records[0]`).
  const top = isObj(body) ? body : {};
  const wrapper = [top.data, top.cart, Array.isArray(top.records) ? top.records[0] : undefined].find(isObj);
  const bill = { ...wrapper, ...top };
  const charges = Object.entries(CHARGE_LABELS)
    .map(([key, label]) => ({ label, amount: num(bill[key]) }))
    .filter((c): c is { label: string; amount: number } => c.amount !== undefined && c.amount !== 0);
  const grandTotal = num(pick(bill, ['grandTotal', 'totalAmount', 'total', 'payableAmount']));

  return { items, charges, grandTotal };
}

/** DELETE `{createApi}/{variantId}`: takes the variant out of the cart (the POST won't accept quantity 0). */
export function removeFromCart(createApi: string, variantId: string) {
  const path = resolveApiPath(createApi).replace(/\/+$/, '');
  return apiRequest<unknown>(`${path}/${encodeURIComponent(variantId)}`, { method: 'DELETE' });
}

/** DELETE a record through a row action's `dataApi`. */
export function deleteRecord(dataApi: string, recordId: string) {
  return apiRequest<unknown>(resolveRecordPath(dataApi, recordId), { method: 'DELETE' });
}
