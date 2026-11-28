import type { Cart, CartItem } from '../../api/records';
import type { CartController } from './useCart';

export const currency = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;

export interface CartLine {
  item: CartItem;
  quantity: number;
}

export interface CartSummary {
  saved: Cart | null;
  lines: CartLine[];
  unitCount: number;
  itemsTotal: number;
  charges: Cart['charges'];
  grandTotal: number;
}

/**
 * The cart as shown in the cart and checkout screens. Quantities come from the shared cart state, so
 * every +/− (here or on the product cards) shows up straight away, totals included.
 */
export function summarizeCart(cart: CartController, titles?: Record<string, string>): CartSummary {
  const saved = cart.load.status === 'ready' ? cart.load.cart : null;
  const lines = (saved?.items ?? [])
    .map((item) => ({
      item: titles?.[item.key] ? { ...item, name: titles[item.key] } : item,
      quantity: cart.quantities[item.key] ?? item.quantity,
    }))
    .filter((l) => l.quantity > 0);
  const unitCount = lines.reduce((n, l) => n + l.quantity, 0);
  const itemsTotal = lines.reduce((sum, l) => sum + (l.item.price ?? 0) * l.quantity, 0);
  const charges = saved?.charges ?? [];
  const grandTotal = charges.reduce(
    (sum, c) => sum + (c.label === 'Discount' ? -Math.abs(c.amount) : c.amount),
    itemsTotal,
  );
  return { saved, lines, unitCount, itemsTotal, charges, grandTotal };
}
