import React, { useState } from 'react';
import { View, Text, SafeAreaView, Share, Alert, Pressable, ActivityIndicator, Image, ScrollView, TouchableOpacity } from 'react-native';
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

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-20 pb-8">
        {/* Custom Illustration */}
        <View className="items-center mb-12 mt-8">
          <Image 
            source={require('@/assets/images/invite-illustration.png')}
            style={{ width: 200, height: 200 }}
            resizeMode="contain"
          />
          
          <Text className="text-text font-header-bold text-3xl text-center mt-8 mb-2">
            Invite Friends to Waffle
          </Text>
          <Text className="text-gray-600 font-body text-base text-center">
            Build meaningful connections through weekly video check-ins
          </Text>
        </View>

        {/* Modern Share Section */}
        <View className="mb-8">
          <Text className="text-text font-header-bold text-lg text-center mb-6">
            Share Your Personal Invite Link
          </Text>
          
          {/* Share Button with Copy Icon */}
          <View className="flex-row items-center space-x-3">
            <Pressable
              onPress={handleShareLink}
              className="flex-1 bg-primary rounded-2xl p-4 items-center border border-primary/10 active:scale-95 shadow-lg"
              style={{ transform: [{ scale: 1 }] }}
            >
              <View className="flex-row items-center">
                <Text className="text-white text-xl mr-2">📤</Text>
                <Text className="text-white font-body-bold text-lg">Share Invite Link</Text>
              </View>
            </Pressable>

            {/* Copy Icon Button */}
            <TouchableOpacity
              onPress={handleCopyLink}
              className="w-14 h-14 bg-yellow-400 rounded-2xl items-center justify-center border border-yellow-500/20 active:scale-95 shadow-lg"
              style={{ transform: [{ scale: 1 }] }}
            >
              <Text className="text-yellow-900 text-xl">
                {copySuccess ? '✅' : '📋'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text className="text-gray-500 font-body text-sm text-center mt-3">
            Share via messages, email, or tap 📋 to copy
          </Text>
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
      </ScrollView>

      {/* Footer */}
      <View className="px-6 pb-6">
        <Text className="text-gray-400 font-body text-xs text-center">
          Building stronger friendships, one waffle at a time 🧇
        </Text>
      </View>
    </SafeAreaView>
  );
}
