/**
 * Delivery addresses for checkout. There is no address API yet, so they are kept in this browser
 * (localStorage) until one exists.
 */
export interface Address {
  id: string;
  tag: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

const KEY = 'petwork.addresses';
const SELECTED_KEY = 'petwork.addresses.selected';

export function loadAddresses(): Address[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as Address[]) : [];
  } catch {
    return [];
  }
}

export function saveAddresses(list: Address[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked (private window): the addresses still work until the page reloads.
  }
}

export function loadSelectedId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function saveSelectedId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // see saveAddresses
  }
}

export function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.city, `${a.state} ${a.pincode}`.trim()].filter(Boolean).join(', ');
}
