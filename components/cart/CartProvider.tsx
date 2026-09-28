'use client';

import { usePathname } from 'next/navigation';
import { createContext, use, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { dispatchCart, getServerSnapshot, getSnapshot, subscribe } from '@/lib/cart-store';
import type { CartLine } from '@/lib/cart';

type CartUi = {
  isOpen: boolean;
  lastAddedId: string | null;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (id: string, quantity?: number) => void;
};

const CartUiContext = createContext<CartUi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Le tiroir est lié à la page où il a été ouvert : changer de page le referme.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const value = useMemo<CartUi>(
    () => ({
      isOpen: openOn !== null && openOn === pathname,
      lastAddedId,
      openCart: () => {
        setLastAddedId(null);
        setOpenOn(pathname);
      },
      closeCart: () => setOpenOn(null),
      addToCart: (id, quantity = 1) => {
        dispatchCart({ type: 'add', id, quantity });
        setLastAddedId(id);
        setOpenOn(pathname);
      },
    }),
    [openOn, pathname, lastAddedId],
  );

  return <CartUiContext value={value}>{children}</CartUiContext>;
}

export function useCartUi(): CartUi {
  const context = use(CartUiContext);
  if (!context) throw new Error('useCartUi doit être utilisé dans <CartProvider>.');
  return context;
}

export function useCartLines(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** Vaut false au premier rendu (serveur et hydratation), puis true dans le navigateur. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
