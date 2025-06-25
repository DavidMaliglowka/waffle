import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authService } from '@/lib/auth';

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'verification'>('phone');

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const result = await authService.signInWithApple();
      if (result.success) {
        router.replace('/(tabs)/chats');
      } else {
        Alert.alert('Sign In Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      setLoading(true);
      const result = await authService.sendSMSVerification(phoneNumber);
      if (result.success) {
        setStep('verification');
      } else {
        Alert.alert('Error', result.error || 'Failed to send verification code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    try {
      setLoading(true);
      const result = await authService.verifySMSCode(verificationCode);
      if (result.success) {
        router.replace('/(tabs)/chats');
      } else {
        Alert.alert('Error', result.error || 'Invalid verification code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setVerificationCode('');
    setConfirmationResult(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-waffle-cream">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Logo/Title */}
          <View className="items-center mb-12">
            <Text className="text-6xl mb-4">🧇</Text>
            <Text className="text-3xl font-bold text-waffle-charcoal mb-2">Welcome Back</Text>
            <Text className="text-base text-gray-600 text-center">
              Sign in to continue sharing authentic moments
            </Text>
          </View>

          {step === 'phone' ? (
            <>
              {/* Development Mode Info */}
              {__DEV__ && (
                <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <Text className="text-blue-800 text-xs text-center font-medium">
                    🔧 DEV MODE: Phone auth bypass enabled for iOS simulator
                  </Text>
                  <Text className="text-blue-600 text-xs text-center mt-1">
                    Enter any phone number, then use code "123456"
                  </Text>
                </View>
              )}

              {/* Phone Number Input */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-waffle-charcoal mb-2">Phone Number</Text>
                <TextInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+1 (555) 123-4567"
                  keyboardType="phone-pad"
                  className="bg-white rounded-lg px-4 py-4 text-base border border-gray-200 focus:border-waffle-yellow"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Phone Sign In Button */}
              <TouchableOpacity
                onPress={handlePhoneSignIn}
                disabled={loading}
                className={`rounded-lg py-4 px-6 mb-4 ${loading ? 'bg-gray-300' : 'bg-waffle-yellow'}`}
              >
                <Text className="text-waffle-charcoal font-semibold text-lg text-center">
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View className="flex-row items-center mb-4">
                <View className="flex-1 h-px bg-gray-300" />
                <Text className="mx-4 text-gray-500">or</Text>
                <View className="flex-1 h-px bg-gray-300" />
              </View>

              {/* Apple Sign In Button */}
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={loading}
                className={`bg-black rounded-lg py-4 px-6 mb-6 ${loading ? 'opacity-50' : ''}`}
              >
                <Text className="text-white font-semibold text-lg text-center">
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Verification Code Input */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-waffle-charcoal mb-2">Verification Code</Text>
                <Text className="text-sm text-gray-600 mb-2">
                  Enter the 6-digit code sent to {phoneNumber}
                </Text>
                
                {__DEV__ && (
                  <Text className="text-blue-600 text-xs text-center mb-4 font-medium">
                    💡 DEV MODE: Use code "123456"
                  </Text>
                )}
                
                <TextInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  className="bg-white rounded-lg px-4 py-4 text-base border border-gray-200 focus:border-waffle-yellow text-center tracking-widest"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerifyCode}
                disabled={loading}
                className={`rounded-lg py-4 px-6 mb-4 ${loading ? 'bg-gray-300' : 'bg-waffle-yellow'}`}
              >
                <Text className="text-waffle-charcoal font-semibold text-lg text-center">
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              {/* Back Button */}
              <TouchableOpacity
                onPress={handleBackToPhone}
                className="py-2"
              >
                <Text className="text-waffle-orange font-medium text-center">
                  Use Different Number
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Sign Up Link */}
          <View className="items-center mt-8">
            <Text className="text-gray-600">
              Don't have an account?{' '}
              <Text 
                className="text-waffle-orange font-medium"
                onPress={() => router.push('/auth/signup')}
              >
                Sign Up
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
} 