import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ConversationDetail() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 18 }}>Chat ID: {chatId}</Text>
    </View>
  );
}
