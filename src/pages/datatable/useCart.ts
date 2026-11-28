import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlueprintAction, DataTableBlueprint } from '../../api/blueprint';
import { fetchCart, type Cart } from '../../api/records';
import { isCartAction, isCartNamed } from './actionDisplay';

export type CartLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; cart: Cart };

export interface CartController {
  /** The row action that adds to the cart (its `createApi` takes the POSTs); undefined when there is none. */
  addAction: BlueprintAction | undefined;
  /** Quantity per cart key (variant id, or `upc:<code>`), as last accepted by the backend. Shared by product cards and the cart panel. */
  quantities: Record<string, number>;
  setQuantity: (cartKey: string, quantity: number) => void;
  /** The full saved cart, loaded by `reload` (e.g. when the cart panel opens). */
  load: CartLoad;
  reload: () => void;
}

/**
 * The page's cart. It is loaded once when the page opens, so items added earlier show their quantity on
 * the product cards, and again whenever `reload` is called. Reads go to the header "Cart" action's
 * `dataApi`, else the add action's `createApi` (the same endpoint).
 */
export function useCart(blueprint: DataTableBlueprint | null): CartController {
  const addAction = useMemo(() => (blueprint?.rowLevelactions ?? []).find(isCartAction), [blueprint]);
  const cartApi = useMemo(() => {
    const cartAction = (blueprint?.actions ?? []).find((a) => isCartNamed(a) && !!a.dataApi);
    return cartAction?.dataApi ?? addAction?.createApi;
  }, [blueprint, addAction]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [load, setLoad] = useState<CartLoad>({ status: 'idle' });
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    if (!cartApi) return;
    let cancelled = false;
    fetchCart(cartApi)
      .then((cart) => {
        if (cancelled) return;
        setLoad({ status: 'ready', cart });
        // The saved cart is the truth: replace every quantity with what it holds.
        setQuantities(Object.fromEntries(cart.items.map((i) => [i.key, i.quantity])));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: err instanceof Error ? err.message : 'Could not load the cart.' });
      });
    return () => {
      cancelled = true;
    };
  }, [cartApi, loadCount]);

  const setQuantity = useCallback((cartKey: string, quantity: number) => {
    setQuantities((q) => ({ ...q, [cartKey]: quantity }));
  }, []);

  // Keeps an already-loaded cart on screen while the fresh copy loads, so the panel doesn't flash.
  const reload = useCallback(() => {
    setLoad((l) => (l.status === 'ready' ? l : { status: 'loading' }));
    setLoadCount((n) => n + 1);
  }, []);

  return { addAction, quantities, setQuantity, load, reload };
}
