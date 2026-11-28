/**
 * What a cart line is identified by. The original backend uses variant ids; the new backend uses UPCs.
 * A record's variant id wins when it has one, else its UPC is used.
 *
 * The key travels through the app as one string (so it works as a map key and a React key):
 * a variant id as-is, a UPC as `upc:<code>`.
 */
export type CartKeyType = 'variantId' | 'upc';

export interface CartKey {
  type: CartKeyType;
  value: string;
}

const UPC_PREFIX = 'upc:';

/** Field names holding a variant id (checked first). */
export const VARIANT_ID_NAMES = ['variantId', 'varientId', 'variant_id'];
/** Field names holding a UPC (used when there is no variant id). */
export const UPC_NAMES = ['upc', 'upcCode', 'upc_code', 'upcNumber'];
/** Older rows that carry their variant id under a generic name (checked last). */
export const LEGACY_ID_NAMES = ['id', '_id', 'variantCode'];

export function toCartKey(type: CartKeyType, value: string): string {
  return type === 'upc' ? `${UPC_PREFIX}${value}` : value;
}

export function parseCartKey(key: string): CartKey {
  return key.startsWith(UPC_PREFIX)
    ? { type: 'upc', value: key.slice(UPC_PREFIX.length) }
    : { type: 'variantId', value: key };
}
