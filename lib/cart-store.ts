import { cartReducer, parseStoredCart, type CartAction, type CartLine } from './cart';

/**
 * Panier conservé dans le navigateur (localStorage), partagé entre les onglets.
 * Les composants le lisent avec useSyncExternalStore (voir useCartLines).
 */

const STORAGE_KEY = 'tigerz.cart.v1';
const EMPTY: CartLine[] = [];

let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    lines = parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    lines = EMPTY;
  }
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Stockage indisponible (navigation privée, quota) : le panier reste en mémoire.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  lines = parseStoredCart(event.newValue);
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
  };
}

export function getSnapshot(): CartLine[] {
  load();
  return lines;
}

export function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

export function dispatchCart(action: CartAction) {
  load();
  const next = cartReducer(lines, action);
  if (next === lines) return;
  lines = next;
  save();
  emit();
}
