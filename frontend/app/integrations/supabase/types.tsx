
import React from 'react';
import { View, Text } from 'react-native';

// This file is not meant to be a route - it's a TypeScript types file
// Adding this default export to prevent Expo Router warnings
export default function TypesPlaceholder() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>This is not a valid route</Text>
    </View>
  );
}
