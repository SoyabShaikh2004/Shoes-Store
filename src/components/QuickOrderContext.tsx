'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Product } from '@/lib/data';
import QuickOrderDrawer from '@/components/QuickOrderDrawer';

interface QuickOrderContextValue {
  openQuickOrder: (product: Product) => void;
  closeQuickOrder: () => void;
}

const QuickOrderContext = createContext<QuickOrderContextValue | null>(null);

export function QuickOrderProvider({ children }: { children: ReactNode }) {
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const openQuickOrder = useCallback((product: Product) => {
    setActiveProduct(product);
  }, []);

  const closeQuickOrder = useCallback(() => {
    setActiveProduct(null);
  }, []);

  return (
    <QuickOrderContext.Provider value={{ openQuickOrder, closeQuickOrder }}>
      {children}
      <QuickOrderDrawer product={activeProduct} onClose={closeQuickOrder} />
    </QuickOrderContext.Provider>
  );
}

export function useQuickOrder(): QuickOrderContextValue {
  const ctx = useContext(QuickOrderContext);
  if (!ctx) {
    return {
      openQuickOrder: () => {},
      closeQuickOrder: () => {},
    };
  }
  return ctx;
}
