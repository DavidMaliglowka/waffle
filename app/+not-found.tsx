import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import { authService } from '@/lib/auth';

export default function NotFoundScreen() {
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Auto-redirect based on auth state with proper delay
  useEffect(() => {
    console.log('🧇 Not-found screen loaded - checking auth state and redirecting...');
    
    // Prevent multiple redirects
    if (hasRedirected.current) {
      console.log('🧇 Already redirected, skipping...');
      return;
    }
    
    // Check auth state and redirect appropriately
    const timer = setTimeout(() => {
      if (!hasRedirected.current) {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          console.log('🧇 Auto-redirecting authenticated user from not-found to main app...');
          hasRedirected.current = true;
          router.replace('/(tabs)/chats');
        } else {
          console.log('🧇 Auto-redirecting unauthenticated user from not-found to auth...');
          hasRedirected.current = true;
          router.replace('/auth/phone');
        }
      }
    }, 1500); // 1.5 second delay to prevent immediate loops

    return () => clearTimeout(timer);
  }, [router]);

  const handleManualRedirect = () => {
    hasRedirected.current = true;
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      router.replace('/(tabs)/chats');
    } else {
      router.replace('/auth/phone');
    }
  };

  const handleOnboardingRedirect = () => {
    hasRedirected.current = true;
    router.replace('/onboarding');
  };

  return (
    <View className="flex-1 bg-waffle-cream">
      <Stack.Screen options={{ title: 'Oops!', headerShown: true, headerStyle: { backgroundColor: '#FAF7F2' } }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Text style={styles.subtitle}>Don't worry, we'll get you back on track!</Text>

        <TouchableOpacity 
          style={styles.button}
          onPress={handleManualRedirect}
        >
          <Text style={styles.buttonText}>Go to App</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.link}
          onPress={handleOnboardingRedirect}
        >
          <Text style={styles.linkText}>Or go to onboarding</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FAF7F2',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3A3A3A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#FDB833',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonText: {
    color: '#3A3A3A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#E57345',
  },
});
