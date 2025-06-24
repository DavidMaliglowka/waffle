import React from 'react';
import { View, Text } from 'react-native';

export const options = { presentation: 'modal', headerShown: false };

export default function CameraModal() {
  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white' }}>Camera placeholder</Text>
    </View>
  );
}

CameraModal.options = options;
