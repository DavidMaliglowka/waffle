import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authService } from '@/lib/auth';
// Use fallback for expo-localization until native module is properly configured
let Localization: any = null;
try {
  Localization = require('expo-localization');
} catch (error) {
  console.log('🧇 expo-localization not available in phone screen, using fallback');
  Localization = null;
}

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [countryCode, setCountryCode] = useState('+1');

  useEffect(() => {
    // Auto-detect user's country code based on device locale
    detectCountryCode();
  }, []);

  const detectCountryCode = () => {
    try {
      // Fallback if expo-localization is not available
      if (!Localization) {
        console.log('🧇 expo-localization not available, using default +1');
        setCountryCode('+1');
        return;
      }
      
      const locale = Localization.getLocales()[0];
      const region = locale.regionCode || 'US';
      
      // Common country code mappings
      const countryCodeMap: { [key: string]: string } = {
        'US': '+1', 'CA': '+1',
        'GB': '+44', 'IE': '+353',
        'AU': '+61', 'NZ': '+64',
        'DE': '+49', 'FR': '+33', 'IT': '+39', 'ES': '+34',
        'JP': '+81', 'KR': '+82', 'CN': '+86',
        'IN': '+91', 'BR': '+55', 'MX': '+52',
        'RU': '+7', 'TR': '+90', 'SA': '+966',
        'AE': '+971', 'SG': '+65', 'MY': '+60',
        'TH': '+66', 'VN': '+84', 'PH': '+63',
        'ID': '+62', 'PK': '+92', 'BD': '+880',
        'LK': '+94', 'NP': '+977', 'AF': '+93',
        'ZA': '+27', 'EG': '+20', 'NG': '+234',
        'KE': '+254', 'GH': '+233', 'UG': '+256',
        'TZ': '+255', 'ZW': '+263', 'BW': '+267',
        'AR': '+54', 'CL': '+56', 'CO': '+57',
        'PE': '+51', 'VE': '+58', 'UY': '+598',
        'PY': '+595', 'BO': '+591', 'EC': '+593',
        'GY': '+592', 'SR': '+597', 'GF': '+594',
      };
      
      const detectedCode = countryCodeMap[region] || '+1';
      setCountryCode(detectedCode);
      console.log('🧇 Auto-detected country code:', detectedCode, 'for region:', region);
    } catch (error) {
      console.log('🧇 Could not detect country, using default +1');
      setCountryCode('+1');
    }
  };

  const formatDisplayNumber = (number: string) => {
    // Remove non-digits for display formatting
    const digits = number.replace(/\D/g, '');
    
    // Format based on country code
    if (countryCode === '+1' && digits.length >= 10) {
      // US/Canada format: (555) 123-4567
      const area = digits.slice(0, 3);
      const exchange = digits.slice(3, 6);
      const number = digits.slice(6, 10);
      return `(${area}) ${exchange}-${number}`;
    }
    
    // Default formatting with spaces every 3-4 digits
    return digits.replace(/(\d{3,4})(?=\d)/g, '$1 ');
  };

  const handlePhoneChange = (text: string) => {
    // Only allow digits, spaces, parentheses, and hyphens for display
    const cleaned = text.replace(/[^\d\s\(\)\-]/g, '');
    setPhoneNumber(cleaned);
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const result = await authService.signInWithApple();
      if (result.success) {
        console.log('🧇 Apple Sign-In successful');
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Sign In Failed', result.error || 'Apple Sign-In failed');
      }
    } catch (error) {
      console.error('🧇 Apple Sign-In error:', error);
      Alert.alert('Error', 'An unexpected error occurred during Apple Sign-In');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone Number Required', 'Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      // Create the full international number
      const cleanDigits = phoneNumber.replace(/\D/g, '');
      let fullNumber = '';
      
      // If user entered a number starting with the country code digits, use as-is
      if (countryCode === '+1' && cleanDigits.startsWith('1') && cleanDigits.length === 11) {
        fullNumber = '+' + cleanDigits;
      } else if (cleanDigits.startsWith(countryCode.slice(1))) {
        // User entered number with country code but no +
        fullNumber = '+' + cleanDigits;
      } else {
        // Local number, add country code
        fullNumber = countryCode + cleanDigits;
      }

      console.log('🧇 Sending SMS to:', fullNumber);
      
      // Store the phone number globally for the verification screen
      (global as any).__wafflePhone = fullNumber;
      
      const result = await authService.sendSMSVerification(fullNumber);
      if (result.success) {
        console.log('🧇 SMS sent successfully');
        router.push('/auth/code');
      } else {
        Alert.alert('Verification Failed', result.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('🧇 SMS send error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-waffle-cream">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Header */}
          <View className="items-center mb-12">
            <Text className="text-6xl mb-4">🧇</Text>
            <Text className="text-waffle-charcoal text-3xl font-bold text-center mb-2">
              Welcome to Waffle
            </Text>
            <Text className="text-gray-600 text-lg text-center">
              Enter your phone number to get started
            </Text>
          </View>

          {/* Phone Number Input */}
          <View className="mb-8">
            <Text className="text-waffle-charcoal text-base font-medium mb-3">
              Phone Number
            </Text>
            
            {/* Country Code Display */}
            <View className="flex-row items-center mb-3">
              <View className="bg-gray-100 px-4 py-3 rounded-l-xl border border-r-0 border-gray-200">
                <Text className="text-waffle-charcoal font-medium">{countryCode}</Text>
              </View>
              <TextInput
                className="flex-1 bg-white px-4 py-3 rounded-r-xl border border-gray-200 text-waffle-charcoal text-lg"
                placeholder="(555) 123-4567"
                placeholderTextColor="#9CA3AF"
                value={formatDisplayNumber(phoneNumber)}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                autoFocus
                maxLength={20}
              />
            </View>
            
            <Text className="text-gray-500 text-sm">
              We'll send you a verification code via SMS
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={loading || !phoneNumber.trim()}
            className={`py-4 px-6 rounded-xl mb-6 ${
              loading || !phoneNumber.trim()
                ? 'bg-gray-300'
                : 'bg-waffle-yellow'
            }`}
          >
            <Text className={`text-center font-semibold text-lg ${
              loading || !phoneNumber.trim()
                ? 'text-gray-500'
                : 'text-waffle-charcoal'
            }`}>
              {loading ? 'Sending Code...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-300" />
            <Text className="mx-4 text-gray-500 text-sm">or</Text>
            <View className="flex-1 h-px bg-gray-300" />
          </View>

          {/* Apple Sign-In Button */}
          <TouchableOpacity
            onPress={handleAppleSignIn}
            disabled={appleLoading}
            className="bg-black py-4 px-6 rounded-xl flex-row items-center justify-center"
          >
            <Text className="text-white font-semibold text-lg">
              {appleLoading ? 'Signing in...' : '🍎 Continue with Apple'}
            </Text>
          </TouchableOpacity>

          {/* Info Text */}
          <Text className="text-gray-500 text-sm text-center mt-8 leading-5">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
} 