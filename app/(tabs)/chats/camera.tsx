import React, { useState } from 'react';
import { View, Text, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';

export const options = { presentation: 'modal', headerShown: false };

export default function CameraModal() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const handleClose = () => {
    router.back();
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    // In a real app, this would start the camera recording
    console.log('Started recording');
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setRecordingTime(0);
    // In a real app, this would stop recording and process the video
    console.log('Stopped recording');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row justify-between items-center p-6">
        <Pressable
          className="w-10 h-10 rounded-full bg-white/20 justify-center items-center"
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <Text className="text-white text-lg font-bold">×</Text>
        </Pressable>
        
        <Text className="text-white font-header text-lg">
          Pour a Waffle 🧇
        </Text>
        
        <View className="w-10" />
      </View>

      {/* Camera Preview Area */}
      <View className="flex-1 justify-center items-center mx-6 mb-6 bg-gray-800 rounded-2xl relative">
        {/* Camera placeholder */}
        <View className="absolute inset-4 bg-gray-700 rounded-xl justify-center items-center">
          <Text className="text-white text-6xl mb-4">📹</Text>
          <Text className="text-white font-body text-lg text-center">
            Camera Preview
          </Text>
          <Text className="text-white/70 font-body text-sm text-center mt-2">
            In a real app, this would show the camera feed
          </Text>
        </View>

        {/* Recording overlay */}
        {isRecording && (
          <View className="absolute top-4 left-4 right-4 justify-center items-center">
            <View className="bg-red-500 px-4 py-2 rounded-full flex-row items-center">
              <View className="w-2 h-2 bg-white rounded-full mr-2" />
              <Text className="text-white font-body-bold text-sm">
                REC {formatTime(recordingTime)}
              </Text>
            </View>
          </View>
        )}

        {/* Recording timer in center during recording */}
        {isRecording && (
          <View className="absolute inset-0 justify-center items-center">
            <View className="bg-black/50 px-6 py-4 rounded-2xl">
              <Text className="text-white font-header-bold text-4xl text-center">
                {formatTime(recordingTime)}
              </Text>
              <Text className="text-white font-body text-sm text-center mt-2">
                Recording your waffle...
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View className="px-6 pb-8">
        {!isRecording ? (
          <>
            {/* Recording Instructions */}
            <View className="mb-6">
              <Text className="text-white font-header text-xl text-center mb-2">
                Ready to share?
              </Text>
              <Text className="text-white/70 font-body text-base text-center">
                Record a video update for your friend. Keep it genuine and fun! 🧇
              </Text>
            </View>

            {/* Record Button */}
            <View className="items-center">
              <Pressable
                className="w-20 h-20 bg-primary rounded-full justify-center items-center shadow-lg active:scale-95"
                onPress={handleStartRecording}
                accessibilityRole="button"
                accessibilityLabel="Start recording"
              >
                <View className="w-16 h-16 bg-white rounded-full" />
              </Pressable>
              <Text className="text-white font-body text-sm mt-3">
                Tap to start recording
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Recording Controls */}
            <View className="flex-row justify-center space-x-8">
              <Button
                title="Stop"
                variant="outline"
                size="large"
                onPress={handleStopRecording}
                className="border-white bg-white/10"
              />
              
              <Button
                title="Send Waffle 🧇"
                variant="primary"
                size="large"
                onPress={handleStopRecording}
              />
            </View>

            <Text className="text-white/70 font-body text-sm text-center mt-4">
              Tap "Send Waffle" when you're done recording
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

CameraModal.options = options;
