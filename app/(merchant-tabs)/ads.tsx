import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

// This tab redirects to the main sponsored ads page
export default function AdsTab() {
  return <Redirect href="/merchant/sponsored-ads" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
