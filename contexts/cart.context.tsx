import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type CartItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  priceLabel?: string;
  badge?: string;
  status?: string;
  quantity: number;
};

type AddCartItemInput = Omit<CartItem, 'quantity'>;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  addItem: (item: AddCartItemInput) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  incrementItem: (itemId: string) => void;
  decrementItem: (itemId: string) => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((incomingItem: AddCartItemInput) => {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === incomingItem.id);

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === incomingItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...currentItems, { ...incomingItem, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const incrementItem = useCallback((itemId: string) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }, []);

  const decrementItem = useCallback((itemId: string) => {
    setItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.id !== itemId) return [item];
        if (item.quantity <= 1) return [];

        return [{ ...item, quantity: item.quantity - 1 }];
      }),
    );
  }, []);

  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      addItem,
      removeItem,
      clearCart,
      incrementItem,
      decrementItem,
    }),
    [items, itemCount, addItem, removeItem, clearCart, incrementItem, decrementItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }

  return context;
}
