import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function ConversationsList() {
  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 20, marginBottom: 12 }}>Waffles</Text>
      <Link href="/chats/42" style={{ color: 'blue' }}>Open chat 42</Link>
    </View>
  );
}