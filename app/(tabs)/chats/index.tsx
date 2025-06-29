import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, FlatList, SafeAreaView, Pressable, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useAuthState } from '@/lib/auth';
import { FirestoreService, Chat, User } from '@/lib/firestore';

// Simple debounce utility function with cancel method
const debounce = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const debouncedFn = (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  
  debouncedFn.cancel = () => {
    clearTimeout(timeoutId);
  };
  
  return debouncedFn;
};

// Constants for performance optimization
const CHAT_ITEM_HEIGHT = 80;

// Enhanced chat type with user info
interface EnhancedChat extends Chat {
  friendName: string;
  friendPhotoURL?: string;
  lastMessage?: string;
  hasUnread?: boolean;
  isOnline?: boolean;
}

// Custom hook for chat list management with real-time updates
const useChatList = (userId: string | undefined) => {
  const [chats, setChats] = useState<EnhancedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounced update function to prevent excessive re-renders
  const debouncedSetChats = useMemo(
    () => debounce((newChats: EnhancedChat[]) => {
      setChats(newChats);
      setLoading(false);
      setRefreshing(false);
    }, 150),
    []
  );

  const firestoreService = FirestoreService.getInstance();

  // Enhanced chat processing with user info
  const processChatsWithUserInfo = useCallback(async (rawChats: Chat[]): Promise<EnhancedChat[]> => {
    if (!userId) return [];

    const enhancedChats = await Promise.all(
      rawChats.map(async (chat) => {
        try {
          // Find the friend's ID (the other member that's not the current user)
          const friendId = chat.members.find(memberId => memberId !== userId);
          
          if (!friendId) {
            // Fallback for invalid chat data
            return {
              ...chat,
              friendName: 'Unknown User',
              lastMessage: 'No messages yet',
              hasUnread: false,
            };
          }

          // Get friend's user profile
          const friendProfile = await firestoreService.getUser(friendId);
          
          // Get last video for preview
          const lastVideo = chat.lastVideoId 
            ? await firestoreService.getVideo(chat.id, chat.lastVideoId).catch(() => null)
            : null;

          return {
            ...chat,
            friendName: friendProfile?.displayName || 'Waffle Friend',
            friendPhotoURL: friendProfile?.photoURL,
            lastMessage: lastVideo 
              ? `Video message • ${formatTimeAgo(lastVideo.createdAt.toDate())}`
              : 'Start your first waffle! 🧇',
            hasUnread: lastVideo ? !lastVideo.isExpired && lastVideo.senderId !== userId : false,
          };
        } catch (error) {
          console.error('🧇 Error processing chat:', chat.id, error);
          return {
            ...chat,
            friendName: 'Waffle Friend',
            lastMessage: 'Tap to start chatting',
            hasUnread: false,
          };
        }
      })
    );

    return enhancedChats;
  }, [userId, firestoreService]);

  // Real-time subscription setup
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = firestoreService.subscribeToUserChats(
        userId,
        async (updatedChats) => {
          try {
            const enhancedChats = await processChatsWithUserInfo(updatedChats);
            debouncedSetChats(enhancedChats);
          } catch (error) {
            console.error('🧇 Error processing chat updates:', error);
            setError('Failed to load chat updates');
            setLoading(false);
            setRefreshing(false);
          }
        }
      );
    } catch (err) {
      console.error('🧇 Error setting up chat subscription:', err);
      setError('Failed to load chats');
      setLoading(false);
      setRefreshing(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      debouncedSetChats.cancel();
    };
  }, [userId, debouncedSetChats, processChatsWithUserInfo, firestoreService]);

  // Manual refresh function
  const refreshChats = useCallback(async () => {
    if (!userId) return;

    setRefreshing(true);
    setError(null);

    try {
      const rawChats = await firestoreService.getUserChats(userId);
      const enhancedChats = await processChatsWithUserInfo(rawChats);
      setChats(enhancedChats);
    } catch (error) {
      console.error('🧇 Error refreshing chats:', error);
      setError('Failed to refresh chats');
    } finally {
      setRefreshing(false);
    }
  }, [userId, processChatsWithUserInfo, firestoreService]);

  return { chats, loading, error, refreshing, refreshChats };
};

// Helper function to format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return `${Math.floor(diffInSeconds / 604800)}w ago`;
};

// Optimized Avatar Component
const OptimizedAvatar = React.memo(({ 
  photoURL, 
  fallbackText, 
  size = 48 
}: {
  photoURL?: string;
  fallbackText: string;
  size?: number;
}) => {
  if (photoURL) {
    return (
      <View
        style={{ 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: '#E57345' // Burnt Orange fallback
        }}
        className="justify-center items-center"
      >
        {/* For now, using fallback until we implement proper image loading */}
        <Text className="text-white font-header-bold" style={{ fontSize: size * 0.3 }}>
          {fallbackText}
        </Text>
      </View>
    );
  }

  return (
    <View 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: '#E57345' // Burnt Orange from your theme
      }}
      className="justify-center items-center"
    >
      <Text className="text-white font-header-bold" style={{ fontSize: size * 0.3 }}>
        {fallbackText}
      </Text>
    </View>
  );
});

// Optimized Chat List Item with proper memoization
interface ChatListItemProps {
  chat: EnhancedChat;
}

const ChatListItem = React.memo<ChatListItemProps>(({ chat }) => {
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push(`/chats/${chat.id}`);
  }, [chat.id, router]);

  return (
    <Pressable 
      onPress={handlePress}
      className="flex-row items-center p-4 my-1.5 bg-surface border border-gray-200 rounded-waffle relative shadow-sm"
      style={{ height: CHAT_ITEM_HEIGHT }}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${chat.friendName}`}
    >
      {/* Unread indicator */}
      {chat.hasUnread && (
        <View className="absolute left-2 top-1/2 w-2 h-2 bg-primary rounded-full -mt-1" />
      )}
      
      {/* Avatar */}
      <OptimizedAvatar 
        photoURL={chat.friendPhotoURL}
        fallbackText={chat.friendName.split(' ').map(n => n[0]).join('')}
        size={48}
      />
      
      {/* Chat content */}
      <View className="flex-1 ml-3">
        <View className="flex-row justify-between items-center mb-1">
          <Text 
            className="text-text font-header text-lg"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {chat.friendName}
          </Text>
          <Text className="text-gray-500 text-xs ml-2">
            {formatTimeAgo(chat.lastUpdated.toDate())}
          </Text>
        </View>
        
        <Text 
          className="text-gray-600 text-base"
          numberOfLines={1}
        >
          {chat.lastMessage}
        </Text>
        
        {/* Streak indicator */}
        {chat.streakCount > 0 && (
          <View className="self-start bg-primary px-2 py-0.5 rounded-full mt-1">
            <Text className="text-white text-xs">
              🧇 {chat.streakCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.lastUpdated?.isEqual(nextProps.chat.lastUpdated) &&
    prevProps.chat.hasUnread === nextProps.chat.hasUnread &&
    prevProps.chat.streakCount === nextProps.chat.streakCount &&
    prevProps.chat.friendName === nextProps.chat.friendName &&
    prevProps.chat.lastMessage === nextProps.chat.lastMessage
  );
});

// Loading Component
const LoadingComponent = () => (
  <View className="flex-1 justify-center items-center">
    <ActivityIndicator size="large" color="#E57345" />
    <Text className="text-gray-600 font-body text-base mt-4">
      Loading your waffles...
    </Text>
  </View>
);

// Error Component
const ErrorComponent = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <View className="flex-1 justify-center items-center px-8">
    <Text className="text-text font-header-bold text-2xl text-center mb-2">
      Oops! 🙈
    </Text>
    <Text className="text-gray-600 font-body text-base text-center mb-6">
      {error}
    </Text>
    <Button
      title="Try Again"
      variant="primary"
      onPress={onRetry}
    />
  </View>
);

// Empty State Component
const EmptyStateComponent = ({ onInviteFriend }: { onInviteFriend: () => void }) => (
  <View className="flex-1 justify-center items-center px-8">
    <Text className="text-text font-header-bold text-2xl text-center mb-2">
      No Waffles yet! 🧇
    </Text>
    <Text className="text-gray-600 font-body text-base text-center mb-8">
      Start by inviting a friend to share your first weekly video update.
    </Text>
    <Button
      title="Invite a Friend"
      variant="primary"
      onPress={onInviteFriend}
    />
  </View>
);

// Main Chat List Component
export default function WafflesList() {
  const { user, loading: authLoading } = useAuthState();
  const { chats, loading, error, refreshing, refreshChats } = useChatList(user?.uid);
  const router = useRouter();

  // Optimized callback functions
  const renderChatItem = useCallback(({ item }: { item: EnhancedChat }) => (
    <ChatListItem chat={item} />
  ), []);

  const keyExtractor = useCallback((item: EnhancedChat) => item.id, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: CHAT_ITEM_HEIGHT,
    offset: CHAT_ITEM_HEIGHT * index,
    index,
  }), []);

  const handleInviteFriend = useCallback(() => {
    router.push('/invite');
  }, [router]);

  const handleRetry = useCallback(() => {
    refreshChats();
  }, [refreshChats]);

  // Show loading while authenticating
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingComponent />
      </SafeAreaView>
    );
  }

  // Show error if not authenticated
  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorComponent 
          error="You need to be signed in to view your waffles." 
          onRetry={() => {}} 
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <Text className="text-text font-header-bold text-4xl">
          Waffles
        </Text>
        <Text className="text-gray-600 font-body text-base">
          Your weekly video conversations
        </Text>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <LoadingComponent />
      ) : error ? (
        <ErrorComponent error={error} onRetry={handleRetry} />
      ) : chats.length > 0 ? (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={100}
          windowSize={5}
          initialNumToRender={10}
          // Pull to refresh
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshChats}
              tintColor="#E57345"
              colors={['#E57345']}
            />
          }
        />
      ) : (
        <EmptyStateComponent onInviteFriend={handleInviteFriend} />
      )}
    </SafeAreaView>
  );
}