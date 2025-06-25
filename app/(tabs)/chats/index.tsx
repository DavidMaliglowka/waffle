import React from 'react';
import { View, Text, FlatList, SafeAreaView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Button } from '@/components/ui/Button';

// Mock data for development
const mockChats = [
  {
    id: '1',
    friendName: 'Alex Chen',
    lastMessage: 'Hey! Just finished that project...',
    lastUpdated: '2 hours ago',
    streakCount: 5,
    hasUnread: true,
  },
  {
    id: '2', 
    friendName: 'Sarah Williams',
    lastMessage: 'The concert was amazing!',
    lastUpdated: '1 day ago',
    streakCount: 12,
    hasUnread: false,
  },
  {
    id: '3',
    friendName: 'Mike Rodriguez',
    lastMessage: 'Thanks for the advice about...',
    lastUpdated: '3 days ago',
    streakCount: 0,
    hasUnread: false,
  },
];

interface ChatListItemProps {
  chat: typeof mockChats[0];
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat }) => {
  return (
    <Link href={`/chats/${chat.id}`} asChild>
      <Pressable className="flex-row items-center p-4 my-1.5 bg-surface border border-gray-200 rounded-waffle relative min-h-[44px] shadow-sm">
        {/* Unread indicator */}
        {chat.hasUnread && (
          <View className="absolute left-2 top-1/2 w-2 h-2 bg-primary rounded-full -mt-1" />
        )}
        
        {/* Avatar placeholder */}
        <View className="w-12 h-12 bg-secondary rounded-full justify-center items-center mr-3">
          <Text className="text-white font-header-bold text-lg">
            {chat.friendName.split(' ').map(n => n[0]).join('')}
          </Text>
        </View>
        
        {/* Chat content */}
        <View className="flex-1">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-text font-header text-lg">
              {chat.friendName}
            </Text>
            <Text className="text-gray-500 text-xs">
              {chat.lastUpdated}
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
                🔥 {chat.streakCount}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
};

export default function WafflesList() {
  const renderChatItem = ({ item }: { item: typeof mockChats[0] }) => (
    <ChatListItem chat={item} />
  );

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

      {/* Chat List */}
      {mockChats.length > 0 ? (
        <FlatList
          data={mockChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          className="px-4 pb-4"
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
        />
      ) : (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-text font-header-bold text-2xl text-center">
            No Waffles yet! 🧇
          </Text>
          <Text className="text-gray-600 font-body text-base text-center mt-2 mb-8">
            Start by inviting a friend to share your first weekly video update.
          </Text>
          <Button
            title="Invite a Friend"
            variant="primary"
            onPress={() => {
              // Navigation will be handled by tab navigation
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}