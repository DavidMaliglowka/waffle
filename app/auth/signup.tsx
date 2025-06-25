import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function SignupScreen() {
  return (
    <SafeAreaView className="flex-1 bg-waffle-cream">
      <View className="flex-1 justify-center items-center px-8">
        {/* Logo/Title */}
        <View className="items-center mb-12">
          <Text className="text-6xl mb-4">🧇</Text>
          <Text className="text-3xl font-bold text-waffle-charcoal mb-2">Join Waffle</Text>
          <Text className="text-base text-gray-600 text-center">
            Create your account to start sharing authentic moments
          </Text>
        </View>

        {/* Info */}
        <View className="bg-white rounded-lg p-6 mb-8 border border-gray-200">
          <Text className="text-base text-waffle-charcoal text-center mb-4">
            Sign up with the same methods available on the login screen:
          </Text>
          <Text className="text-sm text-gray-600 text-center mb-2">
            • Apple Sign-In
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            • Phone Number Verification
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={() => router.replace('/auth/login')}
          className="bg-waffle-yellow rounded-lg py-4 px-8 w-full mb-4"
        >
          <Text className="text-waffle-charcoal font-semibold text-lg text-center">
            Continue to Sign Up
          </Text>
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-waffle-orange font-medium">
            Back to Login
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 