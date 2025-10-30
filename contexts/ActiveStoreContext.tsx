import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface Store {
  id: string;
  name_ar: string;
  category: string;
  is_active: boolean;
}

interface ActiveStoreContextType {
  activeStore: Store | null;
  stores: Store[];
  setActiveStore: (store: Store | null) => void;
  loading: boolean;
  refreshStores: () => Promise<void>;
  isAllStoresSelected: boolean;
  setAllStoresSelected: (value: boolean) => void;
}

const ActiveStoreContext = createContext<ActiveStoreContextType | undefined>(undefined);

export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const { profile, userType } = useAuth();
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAllStoresSelected, setIsAllStoresSelected] = useState(false);

  const fetchStores = async () => {
    if (!profile?.id || userType !== 'merchant') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name_ar, category, is_active')
        .eq('owner_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const storesList = (data || []) as Store[];
      setStores(storesList);

      // Set "All" as default if multiple stores, or first store if only one
      if (storesList.length > 1 && !activeStore && !isAllStoresSelected) {
        setIsAllStoresSelected(true);
        setActiveStore(null);
      } else if (storesList.length === 1 && !activeStore) {
        setActiveStore(storesList[0]);
        setIsAllStoresSelected(false);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStores = async () => {
    await fetchStores();
  };

  useEffect(() => {
    fetchStores();
  }, [profile?.id, userType]);

  const handleSetActiveStore = (store: Store | null) => {
    setActiveStore(store);
    setIsAllStoresSelected(store === null);
  };

  const handleSetAllStoresSelected = (value: boolean) => {
    setIsAllStoresSelected(value);
    if (value) {
      setActiveStore(null);
    } else if (stores.length > 0) {
      setActiveStore(stores[0]);
    }
  };

  return (
    <ActiveStoreContext.Provider
      value={{
        activeStore,
        stores,
        setActiveStore: handleSetActiveStore,
        loading,
        refreshStores,
        isAllStoresSelected,
        setAllStoresSelected: handleSetAllStoresSelected,
      }}
    >
      {children}
    </ActiveStoreContext.Provider>
  );
}

export function useActiveStore() {
  const context = useContext(ActiveStoreContext);
  if (context === undefined) {
    throw new Error('useActiveStore must be used within an ActiveStoreProvider');
  }
  return context;
}
