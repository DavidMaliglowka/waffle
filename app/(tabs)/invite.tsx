import React, { useState } from 'react';
import { View, Text, SafeAreaView, Share, Alert, Pressable, ActivityIndicator } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Button } from '@/components/ui/Button';
import { useAuthState } from '@/lib/auth';

export default function InviteScreen() {
  const { user, loading } = useAuthState();
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate personalized invite link with user ID
  const generateInviteLink = () => {
    const baseUrl = 'https://letswaffle.app/invite';
    const inviteUrl = user?.uid ? `${baseUrl}?by=${user.uid}` : baseUrl;
    return inviteUrl;
  };

  const getInviteMessage = () => {
    const inviteLink = generateInviteLink();
    return `Hey! Join me on Waffle for meaningful weekly video check-ins 🧇\n\nDownload the app: ${inviteLink}`;
  };

  const handleShareLink = async () => {
    try {
      const inviteMessage = getInviteMessage();
      const result = await Share.share({
        message: inviteMessage,
        title: 'Join me on Waffle!',
      });

      if (result.action === Share.sharedAction) {
        console.log('🧇 Invite shared successfully');
      }
    } catch (error) {
      console.error('🧇 Share error:', error);
      Alert.alert('Error', 'Could not share the invite link');
    }
  };

  const handleCopyLink = async () => {
    try {
      const inviteLink = generateInviteLink();
      Clipboard.setString(inviteLink);
      setCopySuccess(true);
      
      // Reset copy success state after 2 seconds
      setTimeout(() => setCopySuccess(false), 2000);
      
      Alert.alert('Success', 'Invite link copied to clipboard!');
    } catch (error) {
      console.error('🧇 Copy error:', error);
      Alert.alert('Error', 'Could not copy the invite link');
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-gray-500 mt-4 font-body">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-8 pb-6 items-center">
        <Text className="text-text font-header-bold text-4xl text-center">
          Invite Friends
        </Text>
        <Text className="text-gray-600 font-body text-base text-center mt-2">
          Share the warmth of weekly check-ins
        </Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-6 justify-center">
        {/* Waffle Stack Illustration */}
        <View className="items-center mb-8">
          <View className="relative">
            {/* Waffle Stack */}
            <View className="bg-yellow-400 w-28 h-28 rounded-2xl justify-center items-center mb-2 shadow-lg">
              <Text className="text-yellow-900 text-5xl">🧇</Text>
            </View>
            <View className="bg-yellow-300 w-24 h-24 rounded-2xl justify-center items-center absolute -top-3 -right-2 shadow-md">
              <Text className="text-yellow-800 text-4xl">🧇</Text>
            </View>
            <View className="bg-yellow-500 w-20 h-20 rounded-2xl justify-center items-center absolute -top-6 -right-4 shadow-sm">
              <Text className="text-yellow-900 text-3xl">🧇</Text>
            </View>
          </View>
          
          <Text className="text-text font-header-bold text-3xl text-center mt-8 mb-2">
            Invite Friends to Waffle
          </Text>
          <Text className="text-gray-600 font-body text-base text-center">
            Build meaningful connections through weekly video check-ins
          </Text>
        </View>

        {/* Action Grid */}
        <View className="mb-8">
          <Text className="text-text font-header-bold text-lg text-center mb-6">
            Share Your Personal Invite Link
          </Text>
          
          <View className="flex-row space-x-4">
            {/* Share Link Button */}
            <Pressable
              onPress={handleShareLink}
              className="flex-1 bg-primary rounded-2xl p-6 items-center shadow-sm active:scale-95"
              style={{ transform: [{ scale: 1 }] }}
            >
              <View className="w-12 h-12 bg-white/20 rounded-xl justify-center items-center mb-3">
                <Text className="text-white text-2xl">📤</Text>
              </View>
              <Text className="text-white font-body-bold text-base mb-1">Share Link</Text>
              <Text className="text-white/80 font-body text-xs text-center">
                Send via messages, email, or social media
              </Text>
            </Pressable>

            {/* Copy Link Button */}
            <Pressable
              onPress={handleCopyLink}
              className="flex-1 bg-yellow-400 rounded-2xl p-6 items-center shadow-sm active:scale-95"
              style={{ transform: [{ scale: 1 }] }}
            >
              <View className="w-12 h-12 bg-yellow-900/20 rounded-xl justify-center items-center mb-3">
                <Text className="text-yellow-900 text-2xl">
                  {copySuccess ? '✅' : '📋'}
                </Text>
              </View>
              <Text className="text-yellow-900 font-body-bold text-base mb-1">
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </Text>
              <Text className="text-yellow-800 font-body text-xs text-center">
                {copySuccess ? 'Ready to paste anywhere' : 'Save to clipboard for later'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Benefits Preview */}
        <View className="bg-gray-50 rounded-2xl p-6 mb-4">
          <Text className="text-text font-body-bold text-base text-center mb-4">
            What your friends will love about Waffle:
          </Text>
          
          <View className="space-y-3">
            <View className="flex-row items-center">
              <Text className="text-2xl mr-3">📹</Text>
              <Text className="text-gray-700 font-body text-sm flex-1">
                <Text className="font-body-bold">Meaningful video conversations</Text> that strengthen relationships
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <Text className="text-2xl mr-3">🔥</Text>
              <Text className="text-gray-700 font-body text-sm flex-1">
                <Text className="font-body-bold">Build streaks together</Text> and celebrate consistency
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <Text className="text-2xl mr-3">⏰</Text>
              <Text className="text-gray-700 font-body text-sm flex-1">
                <Text className="font-body-bold">Weekly rhythm</Text> that fits naturally into busy lives
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View className="px-6 pb-6">
        <Text className="text-gray-400 font-body text-xs text-center">
          Building stronger friendships, one waffle at a time 🧇
        </Text>
      </View>
    </SafeAreaView>
  );
}
