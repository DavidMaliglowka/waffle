import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthState } from '@/lib/auth';

export default function IndexScreen() {
  const { user, loading } = useAuthState();

  console.log('🧇 Index Screen - Loading:', loading, 'User:', user ? 'authenticated' : 'not authenticated');

  // Show loading while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F2' }}>
        <ActivityIndicator size="large" color="#FDB833" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#3A3A3A', fontFamily: 'SpaceMono' }}>
          Loading Waffle...
        </Text>
      </View>
    );
  }

  // Redirect based on authentication state
  if (user) {
    console.log('🧇 Index: User authenticated, redirecting to tabs');
    return <Redirect href="/(tabs)/chats" />;
  } else {
    console.log('🧇 Index: User not authenticated, redirecting to onboarding');
    return <Redirect href="/onboarding" />;
  }
} 