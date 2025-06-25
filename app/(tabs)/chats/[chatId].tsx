import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';

// Mock data for development
const mockVideo = {
  id: '1',
  senderId: 'friend123',
  senderName: 'Alex Chen',
  duration: 142, // 2:22
  createdAt: '2 hours ago',
  isExpired: false,
};

const mockTimeline = [
  { id: '1', senderId: 'friend123', createdAt: '2 hours ago', isExpired: false },
  { id: '2', senderId: 'me', createdAt: '1 day ago', isExpired: false },
  { id: '3', senderId: 'friend123', createdAt: '3 days ago', isExpired: false },
  { id: '4', senderId: 'me', createdAt: '5 days ago', isExpired: true },
  { id: '5', senderId: 'friend123', createdAt: '1 week ago', isExpired: true },
];

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface TimelineItemProps {
  video: typeof mockTimeline[0];
  isActive: boolean;
  onPress: () => void;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ video, isActive, onPress }) => {
  const isMyVideo = video.senderId === 'me';
  
  return (
    <Pressable
      className={`w-20 h-20 rounded-waffle mr-3 relative min-h-[44px] min-w-[44px] bg-surface border-2 ${
        isActive ? 'border-primary' : 'border-gray-200'
      } ${video.isExpired ? 'opacity-50' : ''}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Video from ${isMyVideo ? 'you' : 'friend'} - ${video.createdAt}`}
    >
      {/* Placeholder thumbnail */}
      <View className={`flex-1 rounded-[10px] justify-center items-center ${
        isMyVideo ? 'bg-primary' : 'bg-secondary'
      }`}>
        <Text className="text-white text-xs">
          {isMyVideo ? 'You' : 'Friend'}
        </Text>
      </View>
      
      {/* Expired indicator */}
      {video.isExpired && (
        <View className="absolute top-1 right-1 bg-white/90 rounded-lg p-0.5">
          <Text className="text-red-500 text-xs">
            💔
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default function ChatThread() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const [activeVideoId, setActiveVideoId] = React.useState(mockTimeline[0]?.id || '1');

  const handleRecordPress = () => {
    router.push('/chats/camera');
  };

  const currentVideo = mockTimeline.find(v => v.id === activeVideoId) || mockTimeline[0];
  const isMyVideo = currentVideo?.senderId === 'me';

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 items-center">
        <Text className="text-text font-header-bold text-2xl">
          Stack with Alex
        </Text>
        <Text className="text-gray-500 text-xs">
          🔥 Streak: 5 days
        </Text>
      </View>

      {/* Main Video Player/Recorder Area (80% of screen) */}
      <View className="flex-[0.8] mx-4 bg-surface rounded-2xl p-4 relative">
        {currentVideo ? (
          <View className="flex-1 justify-center">
            {/* Video placeholder */}
            <View className={`flex-1 rounded-waffle justify-center items-center p-6 ${
              isMyVideo ? 'bg-primary' : 'bg-secondary'
            }`}>
              <Text className="text-white text-4xl text-center">
                📹
              </Text>
              <Text className="text-white font-body text-lg text-center">
                Video from {isMyVideo ? 'You' : mockVideo.senderName}
              </Text>
              <Text className="text-white text-sm text-center">
                {formatDuration(mockVideo.duration)} • {mockVideo.createdAt}
              </Text>
            </View>

            {/* Video controls */}
            <View className="flex-row justify-center items-center mt-4">
              <Button
                title="▶️ Play"
                variant="outline"
                size="small"
                className="mr-2"
              />
              <Button
                title="⏩ 1.5x"
                variant="ghost"
                size="small"
              />
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-text font-header-bold text-2xl text-center">
              No videos yet
            </Text>
            <Text className="text-gray-600 font-body text-base text-center">
              Start the conversation!
            </Text>
          </View>
        )}

        {/* Record Button */}
        <View className="absolute bottom-4 left-4 right-4">
          <Button
            title="Pour a Waffle 🧇"
            variant="primary"
            size="large"
            fullWidth
            onPress={handleRecordPress}
            className="rounded-2xl shadow-md"
          />
        </View>
      </View>

      {/* Timeline (20% of screen) */}
      <View className="flex-[0.2] px-4 py-3 border-t border-gray-200">
        <Text className="text-text font-header text-lg mb-2">
          Your Conversation
        </Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="py-2"
        >
          {mockTimeline.map((video) => (
            <TimelineItem
              key={video.id}
              video={video}
              isActive={video.id === activeVideoId}
              onPress={() => setActiveVideoId(video.id)}
            />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
