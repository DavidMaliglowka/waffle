import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Button } from '@/components/ui/Button';
import { useAuthState } from '@/lib/auth';
import { FirestoreService, Chat, Video, User } from '@/lib/firestore';
import InlineCameraRecorder from '@/components/InlineCameraRecorder';

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
  const [thumbnailError, setThumbnailError] = useState(false);

  return (
    <Pressable
      className={`w-16 h-20 rounded-waffle mr-3 relative min-h-[44px] min-w-[44px] bg-surface border-2 ${
        isActive ? 'border-primary' : 'border-gray-200'
      } ${video.isExpired ? 'opacity-50' : ''}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Video from ${video.isFromCurrentUser ? 'you' : 'friend'} - ${video.timeAgo}`}
    >
      {/* Video thumbnail */}
      <View className="flex-1 rounded-[10px] overflow-hidden relative">
        {video.thumbnailUrl && !thumbnailError ? (
          // Real thumbnail image
          <Image
            source={{ uri: video.thumbnailUrl }}
            className="flex-1 w-full h-full"
            style={{ resizeMode: 'cover' }}
            onError={() => setThumbnailError(true)}
            onLoad={() => setThumbnailError(false)}
          />
        ) : (
          // Fallback placeholder
          <View className={`flex-1 justify-center items-center ${
            video.isFromCurrentUser ? 'bg-primary' : 'bg-secondary'
          }`}>
            <Text className="text-white text-xs font-bold">
              {video.isFromCurrentUser ? 'You' : 'Friend'}
            </Text>
            <Text className="text-white text-[10px] opacity-80">
              {formatDuration(video.duration)}
            </Text>
          </View>
        )}

        {/* Video duration overlay */}
        {video.thumbnailUrl && !thumbnailError && (
          <View className="absolute bottom-1 left-1 bg-black/70 rounded px-1">
            <Text className="text-white text-[8px] font-medium">
              {formatDuration(video.duration)}
            </Text>
          </View>
        )}

        {/* Sender indicator overlay */}
        <View className="absolute top-1 left-1 bg-black/70 rounded px-1">
          <Text className="text-white text-[8px] font-bold">
            {video.isFromCurrentUser ? 'You' : 'Friend'}
          </Text>
        </View>
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
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  
  // Video playback state
  const videoRef = useRef<ExpoVideo>(null);
  const [videoStatus, setVideoStatus] = useState<{
    isLoaded: boolean;
    isPlaying: boolean;
    positionMillis: number;
    durationMillis: number;
    isBuffering: boolean;
    error: string | null;
  }>({
    isLoaded: false,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
    isBuffering: false,
    error: null,
  });

  // Video controls state
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setShouldAutoPlay(false); // Don't auto-play initial video
    }
  }, [videos, activeVideoId]);

  // Reset video status when switching videos
  useEffect(() => {
    if (activeVideoId && videoRef.current) {
      setVideoStatus({
        isLoaded: false,
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0,
        isBuffering: false,
        error: null,
      });
      
      // Ensure video starts from beginning when switching videos
      const resetVideo = async () => {
        try {
          await videoRef.current?.pauseAsync();
          await videoRef.current?.setPositionAsync(0);
        } catch (error) {
          console.log('🧇 Video reset error (safe to ignore):', error);
        }
      };
      
      resetVideo();
    }
  }, [activeVideoId]);

  // Handle video selection from timeline
  const handleVideoSelect = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
    setViewMode('playback');
    setShouldAutoPlay(true); // Auto-play when video loads
  }, []);

  // Handle video sent from camera
  const handleVideoSent = useCallback(() => {
    console.log('🧇 Video sent successfully');
    // The real-time subscription will automatically update the video list
    // Optionally switch to playback mode of the latest video
    if (videos.length > 0) {
      setActiveVideoId(videos[0].id);
      setViewMode('playback');
      setShouldAutoPlay(false); // Don't auto-play after sending
    }
  }, [videos]);

  // Handle camera errors
  const handleCameraError = useCallback((error: string) => {
    console.error('🧇 Camera error:', error);
    Alert.alert('Camera Error', error);
  }, []);

  // Handle back navigation
  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  // Video playback handlers
  const handleVideoStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoStatus(prev => ({
        ...prev,
        isLoaded: true,
        isPlaying: status.isPlaying,
        positionMillis: status.positionMillis || 0,
        durationMillis: status.durationMillis || 0,
        isBuffering: status.isBuffering,
        error: null,
      }));
    } else if (status.error) {
      console.error('🧇 Video playback error:', status.error);
      setVideoStatus(prev => ({
        ...prev,
        isLoaded: false,
        error: status.error || 'Video playback failed',
      }));
    }
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current || !videoStatus.isLoaded) return;
    
    try {
      if (videoStatus.isPlaying) {
        await videoRef.current.pauseAsync();
        // Show controls when pausing
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = null;
        }
      } else {
        // Ensure video starts from beginning if at the end
        if (videoStatus.positionMillis >= videoStatus.durationMillis - 1000) {
          await videoRef.current.setPositionAsync(0);
        }
        await videoRef.current.playAsync();
        // Hide controls after 2 seconds when playing
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 2000);
      }
    } catch (error) {
      console.error('🧇 Play/pause error:', error);
      Alert.alert('Playback Error', 'Failed to control video playback');
    }
  }, [videoStatus.isPlaying, videoStatus.isLoaded, videoStatus.positionMillis, videoStatus.durationMillis]);

  const handleVideoSeek = useCallback(async (positionMillis: number) => {
    if (!videoRef.current) return;
    
    try {
      await videoRef.current.setPositionAsync(positionMillis);
    } catch (error) {
      console.error('🧇 Video seek error:', error);
    }
  }, []);

  const handleVideoTap = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // If video is playing, hide controls again after 2 seconds
    if (videoStatus.isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
  }, [videoStatus.isPlaying]);

  const handlePlaybackRateChange = useCallback(async () => {
    if (!videoRef.current) return;
    
    const rates = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    
    try {
      await videoRef.current.setRateAsync(nextRate, true);
      setPlaybackRate(nextRate);
    } catch (error) {
      console.error('🧇 Playback rate error:', error);
    }
  }, [playbackRate]);

  const handleVolumeToggle = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('🧇 Volume toggle error:', error);
    }
  }, [isMuted]);

  // Get current active video
  const currentVideo = useMemo(() => {
    return videos.find(v => v.id === activeVideoId) || videos[0] || null;
  }, [videos, activeVideoId]);

  // Reset video controls when current video changes
  useEffect(() => {
    setVideoStatus({
      isLoaded: false,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 0,
      isBuffering: false,
      error: null,
    });
    setShowControls(true);
    setPlaybackRate(1.0);
    setIsMuted(false);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, [currentVideo?.id]);

  // Auto-play video when loaded (if user selected from timeline)
  useEffect(() => {
    const autoPlayVideo = async () => {
      if (shouldAutoPlay && videoStatus.isLoaded && videoRef.current) {
        try {
          await videoRef.current.playAsync();
          setShouldAutoPlay(false); // Reset flag
          
          // Hide controls immediately when auto-playing from timeline
          setShowControls(false);
          if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
          }
        } catch (error) {
          console.error('🧇 Auto-play error:', error);
          setShouldAutoPlay(false); // Reset flag even on error
        }
      }
    };

    autoPlayVideo();
  }, [shouldAutoPlay, videoStatus.isLoaded]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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
        </View>
        
        <View className="items-center">
          <Text className="text-gray-500 text-sm font-medium">
            {chat?.streakCount || 0} 🧇
          </Text>
        </View>
      </View>

      {/* Main Video Area (85% of screen) */}
      <View className="flex-[0.85] mx-4 bg-surface rounded-2xl overflow-hidden relative">
        {viewMode === 'record' || !currentVideo ? (
          // Record Mode - Integrated Camera
          <InlineCameraRecorder
            chatId={chatId!}
            userId={authUser!.uid}
            onVideoSent={handleVideoSent}
            onError={handleCameraError}
            className="flex-1 rounded-2xl"
          />
        ) : (
          // Playback Mode - Fixed container structure
          <View className="flex-1">
            {currentVideo.videoUrl ? (
              <View 
                className="flex-1 bg-black relative"
                style={{ position: 'relative', width: '100%', height: '100%' }}
              >
                {/* Video Player with Tap Gesture */}
                <Pressable 
                  onPress={handleVideoTap}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  accessibilityRole="button"
                  accessibilityLabel="Video player controls"
                >
                  <ExpoVideo
                    ref={videoRef}
                    source={{ uri: currentVideo.videoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode={ResizeMode.COVER}
                    onPlaybackStatusUpdate={handleVideoStatusUpdate}
                    shouldPlay={false}
                    isLooping={false}
                    useNativeControls={false}
                  />
                </Pressable>

                {/* Loading Overlay */}
                {!videoStatus.isLoaded && !videoStatus.error && (
                  <View 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    className="bg-black/50 justify-center items-center"
                  >
                    <View className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 items-center">
                      <ActivityIndicator size="large" color="#ffffff" />
                      <Text className="text-white font-body mt-3 text-center">Loading video...</Text>
                    </View>
                  </View>
                )}

                {/* Error Overlay */}
                {videoStatus.error && (
                  <View 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    className="bg-black/80 justify-center items-center p-6"
                  >
                    <View className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 items-center max-w-sm">
                      <Text className="text-red-400 text-4xl text-center mb-4">⚠️</Text>
                      <Text className="text-white font-body text-center mb-2">
                        Video playback failed
                      </Text>
                      <Text className="text-gray-300 text-sm text-center">
                        {videoStatus.error}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Video Info Overlay with Close Button */}
                {videoStatus.isLoaded && (
                  <View style={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
                    <View className="bg-black/50 rounded-lg p-3 flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="text-white font-body text-sm">
                          From {currentVideo.isFromCurrentUser ? 'You' : friend?.displayName}
                        </Text>
                        <Text className="text-gray-300 text-xs">
                          {currentVideo.timeAgo}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setViewMode('record')}
                        className="w-8 h-8 rounded-full bg-white/20 justify-center items-center ml-3"
                        accessibilityRole="button"
                        accessibilityLabel="Close video player"
                      >
                        <Text className="text-white text-lg font-bold">×</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Playback Controls Overlay */}
                {videoStatus.isLoaded && showControls && (
                  <View 
                    style={{ position: 'absolute', top: 80, left: 0, right: 0, bottom: 0 }}
                    className="justify-between"
                  >
                    {/* Center Play/Pause Button */}
                    <View className="flex-1 justify-center items-center">
                      <Pressable
                        onPress={handlePlayPause}
                        className="w-20 h-20 rounded-full bg-black/70 justify-center items-center"
                        style={{ transform: [{ scale: videoStatus.isPlaying ? 0.9 : 1 }] }}
                        accessibilityRole="button"
                        accessibilityLabel={videoStatus.isPlaying ? 'Pause video' : 'Play video'}
                      >
                        <Text className="text-white text-3xl font-bold">
                          {videoStatus.isPlaying ? '⏸︎' : '▶︎'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Bottom Controls with Progress Bar */}
                    <View className="p-4">
                      <View className="bg-black/70 rounded-lg p-3">
                        {/* Progress Bar */}
                        <View className="mb-3">
                          <View className="flex-row justify-between mb-2">
                            <Text className="text-white text-xs font-medium">
                              {formatDuration(Math.floor(videoStatus.positionMillis / 1000))}
                            </Text>
                            <Text className="text-white text-xs font-medium">
                              {formatDuration(Math.floor(videoStatus.durationMillis / 1000))}
                            </Text>
                          </View>
                          <View className="h-1 bg-white/30 rounded-full">
                            <View 
                              className="h-1 bg-white rounded-full"
                              style={{ 
                                width: `${videoStatus.durationMillis > 0 
                                  ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 
                                  : 0}%` 
                              }}
                            />
                          </View>
                        </View>

                        {/* Control Buttons */}
                        <View className="flex-row justify-between items-center">
                          {/* Speed Control - Bottom Left */}
                          <Pressable
                            onPress={handlePlaybackRateChange}
                            className="bg-black/70 rounded-lg px-4 py-3"
                            accessibilityRole="button"
                            accessibilityLabel={`Playback speed: ${playbackRate}x`}
                          >
                            <Text className="text-white text-base font-medium">
                              {playbackRate}x
                            </Text>
                          </Pressable>

                          {/* Volume Control - Bottom Right */}
                          <Pressable
                            onPress={handleVolumeToggle}
                            className="bg-black/70 rounded-lg px-4 py-3"
                            accessibilityRole="button"
                            accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
                          >
                            <Text className="text-white text-base font-bold">
                              {isMuted ? '🔇' : '🔊'}
                            </Text>
                          </Pressable>
                                                </View>
                        </View>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // No video URL available
              <View className="flex-1 rounded-waffle bg-gray-100 justify-center items-center p-6">
                <Text className="text-gray-400 text-4xl text-center mb-4">📹</Text>
                <Text className="text-gray-600 font-body text-lg text-center mb-2">
                  Video not available
                </Text>
                <Text className="text-gray-500 text-sm text-center">
                  This video may have expired or failed to load
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Video Timeline (15% of screen) */}
      <View className="flex-[0.15] px-4 py-2 border-t border-gray-200">
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
