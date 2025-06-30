import React from 'react';
import { TouchableOpacity, Text, View, Animated } from 'react-native';
import { cn } from '@/lib/utils';

interface RAGToggleButtonProps {
  isVisible: boolean;
  isRecording: boolean;
  onToggle: () => void;
  hasNewSuggestions?: boolean;
  className?: string;
}

export const RAGToggleButton: React.FC<RAGToggleButtonProps> = ({
  isVisible,
  isRecording,
  onToggle,
  hasNewSuggestions = false,
  className,
}) => {
  console.log('🧇 RAGToggleButton render:', { isVisible, isRecording, hasNewSuggestions });
  
  if (!isRecording) {
    console.log('🧇 RAGToggleButton: Not recording, returning null');
    return null;
  }

  return (
    <TouchableOpacity
      onPress={onToggle}
      className={cn(
        "absolute top-16 right-4 w-14 h-14 rounded-full shadow-sm z-50",
        "items-center justify-center border-2 border-white/80",
        isVisible ? "bg-primary" : "bg-black/60",
        "active:scale-95",
        className
      )}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
      }}
    >
      {/* AI Icon */}
      <Text className={cn(
        "text-lg",
        isVisible ? "text-white" : "text-white"
      )}>
        🤖
      </Text>
      
      {/* Notification badge for new suggestions */}
      {hasNewSuggestions && !isVisible && (
        <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center border-2 border-white">
          <View className="w-2 h-2 bg-white rounded-full" />
        </View>
      )}
      
      {/* Subtle label */}
      <View className="absolute -bottom-6 items-center">
        <Text className={cn(
          "text-xs font-body-bold text-center",
          isVisible ? "text-primary" : "text-white/80"
        )}>
          AI
        </Text>
      </View>
    </TouchableOpacity>
  );
}; 