import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';

export default function NotFoundScreen() {
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Auto-redirect for Firebase reCAPTCHA flows with proper delay
  useEffect(() => {
    console.log('🧇 Not-found screen loaded - checking for Firebase reCAPTCHA flow...');
    
    // Prevent multiple redirects
    if (hasRedirected.current) {
      console.log('🧇 Already redirected, skipping...');
      return;
    }
    
    // If this appears during auth flow, auto-navigate back after longer delay
    const timer = setTimeout(() => {
      if (!hasRedirected.current) {
        console.log('🧇 Auto-redirecting from not-found to auth...');
        hasRedirected.current = true;
        router.replace('/auth/phone');
      }
    }, 2000); // 2 second delay to prevent immediate loops

    return () => clearTimeout(timer);
  }, [router]);

  const handleManualRedirect = () => {
    hasRedirected.current = true;
    router.replace('/auth/phone');
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
          <Text style={styles.buttonText}>Back to Login</Text>
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
