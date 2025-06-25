import React from 'react';
import { View, Text, SafeAreaView, Share, Alert } from 'react-native';
import { Button } from '@/components/ui/Button';

export default function InviteScreen() {
  const handleShareLink = async () => {
    try {
      const result = await Share.share({
        message: 'Hey! Join me on Waffle for weekly video check-ins 🧇 Download: https://waffle.app/invite',
        title: 'Join me on Waffle!',
        url: 'https://waffle.app/invite', // This would be a real deep link in production
      });

      if (result.action === Share.sharedAction) {
        // Handle successful share
        console.log('Shared successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not share the invite link');
    }
  };

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
        {/* App Icon/Logo Placeholder */}
        <View className="bg-primary w-32 h-32 rounded-3xl justify-center items-center self-center mb-8">
          <Text className="text-white text-6xl">
            🧇
          </Text>
        </View>

        {/* Value Proposition */}
        <View className="mb-8">
          <Text className="text-text font-header-bold text-2xl text-center mb-4">
            Why Waffle?
          </Text>
          
          <View className="space-y-4">
            <View className="flex-row items-start">
              <Text className="text-primary text-xl mr-3">📹</Text>
              <View className="flex-1">
                <Text className="text-text font-body-bold text-lg">Video Check-ins</Text>
                <Text className="text-gray-600 font-body text-base">
                  Stay connected with meaningful video conversations
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-start">
              <Text className="text-primary text-xl mr-3">⏰</Text>
              <View className="flex-1">
                <Text className="text-text font-body-bold text-lg">Weekly Rhythm</Text>
                <Text className="text-gray-600 font-body text-base">
                  Build lasting habits with gentle reminders
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-start">
              <Text className="text-primary text-xl mr-3">🔥</Text>
              <View className="flex-1">
                <Text className="text-text font-body-bold text-lg">Streak Building</Text>
                <Text className="text-gray-600 font-body text-base">
                  Track your consistency and celebrate milestones
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Call to Action */}
        <View className="mb-4">
          <Button
            title="Share Invite Link"
            variant="primary"
            size="large"
            fullWidth
            onPress={handleShareLink}
            className="mb-4"
          />
          
          <Text className="text-gray-500 font-body text-sm text-center">
            Send your friends a personalized invitation to start building better connections together.
          </Text>
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
