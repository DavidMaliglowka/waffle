import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authService } from '@/lib/auth';

export default function CodeScreen() {
  const phoneParam = (global as any).__wafflePhone as string | undefined;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    const confirmation = (global as any).__smsConfirmation;
    if (!confirmation && !phoneParam) {
      // No verification in progress and no phone number – go back to phone screen
      console.log('🧇 No SMS confirmation or phone number found, redirecting to phone screen');
      router.replace('/auth/phone' as any);
    }
  }, [phoneParam]);

  // Countdown timer for resend functionality
  useEffect(() => {
    const updateCountdown = () => {
      const lastSendTime = (global as any).__lastSMSSendTime || 0;
      const currentTime = Date.now();
      const timeSinceLastSend = currentTime - lastSendTime;
      const minInterval = 60000; // 60 seconds
      const remaining = Math.max(0, Math.ceil((minInterval - timeSinceLastSend) / 1000));
      setResendCountdown(remaining);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code');
      return;
    }
    
    try {
      setLoading(true);
      const result = await authService.verifySMSCode(code.trim());
      if (result.success) {
        // Clear global state on successful verification
        delete (global as any).__smsConfirmation;
        delete (global as any).__wafflePhone;
        delete (global as any).__lastSMSSendTime;
        router.replace('/(tabs)/chats');
      } else {
        Alert.alert('Verification Failed', result.error || 'The verification code is incorrect. Please try again.');
        setCode(''); // Clear the code field for retry
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed. Please check your code and try again.');
      setCode(''); // Clear the code field for retry
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!phoneParam) {
      Alert.alert('Error', 'Phone number not found. Please start over.');
      router.replace('/auth/phone' as any);
      return;
    }

    if (resendCountdown > 0) {
      Alert.alert('Please Wait', `You can resend the code in ${resendCountdown} seconds.`);
      return;
    }

    try {
      setResendLoading(true);
      const result = await authService.resendSMSCode();
      if (result.success) {
        Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
        setCode(''); // Clear current code
      } else {
        Alert.alert('Error', result.error || 'Failed to resend verification code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend verification code');
    } finally {
      setResendLoading(false);
    }
  };

  const handleDifferentNumber = () => {
    // Clear all global state
    delete (global as any).__smsConfirmation;
    delete (global as any).__wafflePhone;
    delete (global as any).__lastSMSSendTime;
    router.replace('/auth/phone' as any);
  };

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return '';
    
    // If it's a US/CA number, format nicely
    if (phone.startsWith('+1') && phone.length === 12) {
      const digits = phone.slice(2); // Remove +1
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // For other countries, just add some spacing
    return phone.replace(/(\+\d{1,3})(\d{3,4})(\d+)/, '$1 $2 $3');
  };

  return (
    <SafeAreaView className="flex-1 bg-waffle-cream">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 justify-center px-8">
          <View className="items-center mb-12">
            <Text className="text-6xl mb-4">🧇</Text>
            <Text className="text-3xl font-bold text-waffle-charcoal mb-2">Verify Your Phone</Text>
            {phoneParam && (
              <Text className="text-base text-gray-600 text-center mb-2">
                Enter the 6-digit code sent to{'\n'}
                <Text className="font-semibold">{formatPhoneDisplay(phoneParam)}</Text>
              </Text>
            )}
            <Text className="text-sm text-gray-500 text-center">
              The code may take a minute to arrive
            </Text>
          </View>

          <View className="mb-6">
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^\d]/g, ''))} // Only allow digits
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              className="bg-white rounded-lg px-4 py-6 text-2xl border border-gray-200 focus:border-waffle-yellow text-center tracking-widest font-mono"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <Text className="text-xs text-gray-500 text-center mt-2">
              Enter the 6-digit verification code
            </Text>
          </View>

          <TouchableOpacity 
            onPress={handleVerify} 
            disabled={loading || code.length !== 6} 
            className={`rounded-lg py-4 px-6 mb-4 ${
              loading || code.length !== 6 ? 'bg-gray-300' : 'bg-waffle-yellow'
            }`}
          >
            <Text className="text-waffle-charcoal font-semibold text-lg text-center">
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-between">
            <TouchableOpacity 
              onPress={handleResendCode} 
              disabled={resendLoading || resendCountdown > 0}
              className="py-3 px-4"
            >
              <Text className={`font-medium text-center ${
                resendLoading || resendCountdown > 0 ? 'text-gray-400' : 'text-waffle-orange'
              }`}>
                {resendLoading 
                  ? 'Sending...' 
                  : resendCountdown > 0 
                    ? `Resend in ${resendCountdown}s`
                    : 'Resend Code'
                }
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDifferentNumber} className="py-3 px-4">
              <Text className="text-waffle-orange font-medium text-center">
                Use Different Number
              </Text>
            </TouchableOpacity>
          </View>

          {/* Helpful tip */}
          <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <Text className="text-blue-800 text-sm text-center">
              💡 Not receiving the code? Check your signal strength and try resending.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
} 