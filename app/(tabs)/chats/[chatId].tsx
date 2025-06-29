import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useAuthState } from '@/lib/auth';
import { FirestoreService, Chat, Video, User } from '@/lib/firestore';

// Constants
const VIDEO_ITEM_HEIGHT = 80;

// Enhanced video type with additional UI data
interface EnhancedVideo extends Video {
  isFromCurrentUser: boolean;
  timeAgo: string;
  isFavorite?: boolean;
}

// Custom hook for chat data and real-time updates
const useChatThread = (chatId: string, userId: string) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [friend, setFriend] = useState<User | null>(null);
  const [videos, setVideos] = useState<EnhancedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const firestoreService = useMemo(() => FirestoreService.getInstance(), []);

  // Format time ago helper
  const formatTimeAgo = useCallback((date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return `${Math.floor(diffInDays / 7)}w ago`;
  }, []);

  // Process videos with enhanced data
  const processVideos = useCallback((rawVideos: Video[]): EnhancedVideo[] => {
    return rawVideos
      .map(video => ({
        ...video,
        isFromCurrentUser: video.senderId === userId,
        timeAgo: formatTimeAgo(video.createdAt.toDate()),
        isFavorite: false, // TODO: Add favorites feature
      }))
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [userId, formatTimeAgo]);

  // Load initial data
  const loadChatData = useCallback(async () => {
    try {
      setError(null);
      
      // Load chat data
      const chatData = await firestoreService.getChat(chatId);
      if (!chatData) {
        throw new Error('Chat not found');
      }
      setChat(chatData);

      // Find and load friend data
      const friendId = chatData.members.find(memberId => memberId !== userId);
      if (!friendId) {
        throw new Error('Friend not found in chat');
      }

      const friendData = await firestoreService.getUser(friendId);
      setFriend(friendData);

      // Load videos
      const videoData = await firestoreService.getChatVideos(chatId, 50);
      const enhancedVideos = processVideos(videoData);
      setVideos(enhancedVideos);

    } catch (err) {
      console.error('🧇 Error loading chat data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [chatId, userId, firestoreService, processVideos]);

  // Real-time video subscription
  useEffect(() => {
    if (!chatId) return;

    console.log('🧇 Setting up real-time video subscription for chat:', chatId);
    
    const unsubscribe = firestoreService.subscribeToChatVideos(chatId, (newVideos) => {
      console.log('🧇 Received video updates:', newVideos.length);
      const enhancedVideos = processVideos(newVideos);
      setVideos(enhancedVideos);
    });

    return () => {
      console.log('🧇 Cleaning up video subscription');
      unsubscribe();
    };
  }, [chatId, firestoreService, processVideos]);

  // Initial load
  useEffect(() => {
    if (chatId && userId) {
      setIsLoading(true);
      loadChatData();
    } else {
      // Clear data if no userId (during auth loading)
      setChat(null);
      setFriend(null);
      setVideos([]);
      setIsLoading(false);
    }
  }, [chatId, userId, loadChatData]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadChatData();
  }, [loadChatData]);

  return {
    chat,
    friend,
    videos,
    isLoading,
    error,
    isRefreshing,
    refresh,
  };
};

// Format duration helper
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Video timeline item component
interface VideoTimelineItemProps {
  video: EnhancedVideo;
  isActive: boolean;
  onPress: () => void;
}

const VideoTimelineItem: React.FC<VideoTimelineItemProps> = React.memo(({ 
  video, 
  isActive, 
  onPress 
}) => {
  return (
    <Pressable
      className={`w-20 h-20 rounded-waffle mr-3 relative min-h-[44px] min-w-[44px] bg-surface border-2 ${
        isActive ? 'border-primary' : 'border-gray-200'
      } ${video.isExpired ? 'opacity-50' : ''}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Video from ${video.isFromCurrentUser ? 'you' : 'friend'} - ${video.timeAgo}`}
    >
      {/* Video thumbnail placeholder */}
      <View className={`flex-1 rounded-[10px] justify-center items-center ${
        video.isFromCurrentUser ? 'bg-primary' : 'bg-secondary'
      }`}>
        <Text className="text-white text-xs font-bold">
          {video.isFromCurrentUser ? 'You' : 'Friend'}
        </Text>
        <Text className="text-white text-[10px] opacity-80">
          {formatDuration(video.duration)}
        </Text>
      </View>
      
      {/* Favorite indicator */}
      {video.isFavorite && (
        <View className="absolute top-1 right-1 bg-white/90 rounded-lg p-0.5">
          <Text className="text-red-500 text-xs">❤️</Text>
        </View>
      )}
      
      {/* Expired indicator */}
      {video.isExpired && (
        <View className="absolute bottom-1 right-1 bg-white/90 rounded-lg p-0.5">
          <Text className="text-red-500 text-xs">💔</Text>
        </View>
      )}
      
      {/* Border color indicator */}
      <View className={`absolute inset-0 rounded-[10px] border-2 ${
        video.isFromCurrentUser ? 'border-yellow-400' : 'border-orange-400'
      } ${video.isExpired ? 'opacity-30' : 'opacity-100'}`} />
    </Pressable>
  );
});

// Main chat thread component
export default function ChatThread() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthState();
  
  // State for video selection and UI
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'record' | 'playback'>('record');

  // Custom hook for chat data (only if auth is loaded and user exists)
  const {
    chat,
    friend,
    videos,
    isLoading,
    error,
    isRefreshing,
    refresh,
  } = useChatThread(
    chatId || '', 
    (!authLoading && authUser?.uid) ? authUser.uid : ''
  );

  // Validation
  useEffect(() => {
    if (!chatId) {
      Alert.alert(
        'Invalid Chat',
        'No chat ID provided.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    // Only check auth after loading is complete
    if (!authLoading && !authUser?.uid) {
      Alert.alert(
        'Authentication Required',
        'Please sign in to view chats.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }
  }, [chatId, authUser, authLoading, router]);

  // Set initial active video
  useEffect(() => {
    if (videos.length > 0 && !activeVideoId) {
      setActiveVideoId(videos[0].id);
    }
  }, [videos, activeVideoId]);

  // Handle video selection from timeline
  const handleVideoSelect = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
    setViewMode('playback');
  }, []);

  // Handle record button press
  const handleRecordPress = useCallback(() => {
    if (!chatId) return;
    router.push(`/chats/camera?chatId=${chatId}`);
  }, [chatId, router]);

  // Handle back navigation
  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  // Get current active video
  const currentVideo = useMemo(() => {
    return videos.find(v => v.id === activeVideoId) || videos[0] || null;
  }, [videos, activeVideoId]);

  // Loading state (auth loading or chat loading)
  if (authLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-gray-500 mt-4 font-body">
          {authLoading ? 'Authenticating...' : 'Loading chat...'}
        </Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center px-6">
        <Text className="text-red-500 text-6xl mb-4">⚠️</Text>
        <Text className="text-text font-header text-xl text-center mb-2">
          Failed to Load Chat
        </Text>
        <Text className="text-gray-600 font-body text-center mb-6">
          {error}
        </Text>
        <Button
          title="Try Again"
          variant="primary"
          onPress={refresh}
          className="mb-4"
        />
        <Button
          title="Go Back"
          variant="ghost"
          onPress={handleBackPress}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <Pressable
          onPress={handleBackPress}
          className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center"
          accessibilityRole="button"
          accessibilityLabel="Go back to chat list"
        >
          <Text className="text-gray-600 text-lg font-bold">←</Text>
        </Pressable>
        
        <View className="flex-1 items-center">
          <Text className="text-text font-header-bold text-xl">
            {friend?.displayName || 'Loading...'}
          </Text>
          <Text className="text-gray-500 text-sm">
            {chat?.streakCount || 0} 🧇
          </Text>
        </View>
        
        <View className="w-10" />
      </View>

      {/* Main Video Area (80% of screen) */}
      <View className="flex-[0.8] mx-4 bg-surface rounded-2xl p-4 relative">
        {viewMode === 'record' || !currentVideo ? (
          // Record Mode / Empty State
          <View className="flex-1 justify-center items-center">
            <Text className="text-text font-header-bold text-2xl text-center mb-2">
              {videos.length === 0 ? 'Start Your First Waffle!' : 'Record New Waffle'}
            </Text>
            <Text className="text-gray-600 font-body text-base text-center mb-6">
              {videos.length === 0 
                ? 'Send a video message to begin your conversation'
                : 'Tap the button below to record a new video'
              }
            </Text>
            
            {/* Camera Icon Placeholder */}
            <View className="w-32 h-32 rounded-waffle bg-gray-100 justify-center items-center mb-6">
              <Text className="text-gray-400 text-4xl">📹</Text>
            </View>
          </View>
        ) : (
          // Playback Mode
          <View className="flex-1 justify-center">
            <View className={`flex-1 rounded-waffle justify-center items-center p-6 ${
              currentVideo.isFromCurrentUser ? 'bg-primary' : 'bg-secondary'
            }`}>
              <Text className="text-white text-4xl text-center mb-4">📹</Text>
              <Text className="text-white font-body text-lg text-center mb-2">
                Video from {currentVideo.isFromCurrentUser ? 'You' : friend?.displayName}
              </Text>
              <Text className="text-white text-sm text-center">
                {formatDuration(currentVideo.duration)} • {currentVideo.timeAgo}
              </Text>
            </View>

            {/* Playback Controls */}
            <View className="flex-row justify-center items-center mt-4 space-x-3">
              <Button
                title="▶️ Play"
                variant="outline"
                size="small"
              />
              <Button
                title="2x"
                variant="ghost"
                size="small"
              />
              <Button
                title="📝"
                variant="ghost"
                size="small"
              />
            </View>
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

      {/* Video Timeline (20% of screen) */}
      <View className="flex-[0.2] px-4 py-3 border-t border-gray-200">
        {videos.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="py-2"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor="#6366f1"
              />
            }
          >
            {videos.map((video) => (
              <VideoTimelineItem
                key={video.id}
                video={video}
                isActive={video.id === activeVideoId}
                onPress={() => handleVideoSelect(video.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-400 font-body text-sm text-center">
              No videos yet. Send your first waffle to get started! 🧇
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
