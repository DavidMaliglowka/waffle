import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';

// This screen handles Firebase Phone Auth deep links after reCAPTCHA completion
// It exists to catch Firebase deep links like: yourScheme://__/auth/handler?apiKey=...
export default function FirebaseAuthCallback() {
  useEffect(() => {
    console.log('🧇 Firebase deep link received after reCAPTCHA – checking state');
    
    // Check if we have the necessary verification state
    const phoneNumber = (global as any).__wafflePhone;
    const smsConfirmation = (global as any).__smsConfirmation;
    
    console.log('🧇 Handler state check - Phone:', !!phoneNumber, 'SMS Confirmation:', !!smsConfirmation);
    
    // Small delay to ensure Firebase has completed the reCAPTCHA flow
    setTimeout(() => {
      if (phoneNumber) {
        // We have a phone number, go to code verification screen
        console.log('🧇 Redirecting to code verification screen');
        router.replace('/auth/code' as any);
      } else {
        // No phone number stored, go back to phone entry
        console.log('🧇 No phone number found, redirecting to phone screen');
        router.replace('/auth/phone' as any);
      }
    }, 500); // Small delay to ensure Firebase state is ready
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F2' }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>🧇</Text>
      <ActivityIndicator size="large" color="#FDB833" />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#3A3A3A', textAlign: 'center' }}>
        Completing verification...
      </Text>
    </View>
  );
} 