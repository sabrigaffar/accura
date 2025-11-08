import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CartItem = {
  productId: string;
  storeId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  quantity: number;
};

export type CartState = {
  storeId: string | null;
  items: CartItem[];
};

const STORAGE_KEY = 'cart_v1';

type CartContextValue = {
  storeId: string | null;
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  updateQuantity: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  canAddToStore: (newStoreId: string) => boolean;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ storeId: null, items: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: CartState = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.items)) {
            setState({ storeId: parsed.storeId ?? null, items: parsed.items });
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [loaded, state]);

  const addItem: CartContextValue['addItem'] = (item, qty = 1) => {
    setState(prev => {
      // إذا كانت السلة لمتجر مختلف، لا نضيف تلقائياً (سيتم طلب التأكيد من الواجهة)
      if (prev.items.length > 0 && prev.storeId && prev.storeId !== item.storeId) {
        return prev;
      }
      const storeId = prev.storeId || item.storeId;
      let items = prev.items;
      const idx = items.findIndex(i => i.productId === item.productId);
      if (idx >= 0) {
        const copy = [...items];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return { storeId, items: copy };
      }
      return { storeId, items: [...items, { ...item, quantity: qty }] };
    });
  };

  const updateQuantity: CartContextValue['updateQuantity'] = (productId, qty) => {
    setState(prev => {
      const copy = prev.items.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, qty) } : i)
        .filter(i => i.quantity > 0);
      return { storeId: copy.length > 0 ? (prev.storeId || null) : null, items: copy };
    });
  };

  const removeItem: CartContextValue['removeItem'] = (productId) => {
    setState(prev => {
      const copy = prev.items.filter(i => i.productId !== productId);
      return { storeId: copy.length > 0 ? (prev.storeId || null) : null, items: copy };
    });
  };

  const clearCart: CartContextValue['clearCart'] = () => {
    setState({ storeId: null, items: [] });
  };

  const getTotalItems = () => state.items.reduce((s, i) => s + i.quantity, 0);
  const getTotalPrice = () => state.items.reduce((s, i) => s + i.quantity * (Number(i.price) || 0), 0);

  const value: CartContextValue = useMemo(() => ({
    storeId: state.storeId,
    items: state.items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    getTotalItems,
    getTotalPrice,
    canAddToStore: (newStoreId: string) => {
      return !state.storeId || state.storeId === newStoreId || state.items.length === 0;
    },
  }), [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
