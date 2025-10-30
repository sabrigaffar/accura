import React from 'react';
import { Stack } from 'expo-router';
import { ActiveStoreProvider } from '@/contexts/ActiveStoreContext';

export default function MerchantLayout() {
  return (
    <ActiveStoreProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ActiveStoreProvider>
  );
}
