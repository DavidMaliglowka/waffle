import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { firebaseFunctions } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface RAGMilestoneProps {
  chatId: string;
  lastVideo?: {
    id: string;
    videoUrl: string;
    createdAt: any;
    senderId: string;
    isFromCurrentUser: boolean;
  };
  isActive: boolean;
  onPress: () => void;
  onSummaryReady?: (summary: VideoSummary) => void;
  className?: string;
}

interface VideoSummary {
  summary: string;
  keyPoints: string[];
  confidence: number;
}

export const RAGMilestone: React.FC<RAGMilestoneProps> = ({
  chatId,
  lastVideo,
  isActive,
  onPress,
  onSummaryReady,
  className,
}) => {
  const [summary, setSummary] = useState<VideoSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate summary when component mounts or last video changes
  useEffect(() => {
    if (lastVideo && chatId) {
      // Debug: Check auth state immediately
      const { auth } = require('@/lib/firebase');
      const currentUser = auth().currentUser;
      console.log('🔍 RAGMilestone mounted - Auth state:', {
        isAuthenticated: !!currentUser,
        userId: currentUser?.uid,
        email: currentUser?.email,
      });
      
      generateSummary();
    }
  }, [lastVideo?.id, chatId]);

  // Reset state when becoming inactive
  useEffect(() => {
    if (!isActive && summary) {
      // Keep the summary but ensure the component can be tapped again
      console.log('🔄 RAGMilestone became inactive, ready for next tap');
    }
  }, [isActive, summary]);

  const generateSummary = async () => {
    if (!lastVideo || !chatId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Debug: Check user authentication
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth().currentUser;
      console.log('🔐 Current user:', currentUser?.uid || 'NOT AUTHENTICATED');
      
      if (!currentUser) {
        console.error('❌ User not authenticated - cannot call Firebase Function');
        throw new Error('User not authenticated');
      }

      // Debug: Log function call details
      console.log('📞 Calling queryRAG function with:', {
        chatId,
        userId: currentUser.uid,
        userEmail: currentUser.email,
      });

      // Query RAG system for video summary
      const queryRAGFunction = firebaseFunctions.httpsCallable('queryRAG');
      const result = await queryRAGFunction({
        chatId,
        query: `Summarize the most recent video conversation. What were the main topics discussed? What was the overall tone and key takeaways?`,
        maxResults: 3,
        videoId: lastVideo.id, // Optional: specify which video to focus on
      });

      console.log('✅ Firebase Function result:', result.data);

      const ragResult = result.data as {
        response?: string;
        sources?: any[];
      };
      
      // Parse the response to extract summary information
      const summaryData: VideoSummary = {
        summary: ragResult.response || 'Recent conversation covered various topics.',
        keyPoints: extractKeyPoints(ragResult.response || ''),
        confidence: Math.min((ragResult.sources?.length || 0) * 0.3 + 0.5, 0.9),
      };

      setSummary(summaryData);
      
      // Notify parent component that summary is ready
      if (onSummaryReady) {
        onSummaryReady(summaryData);
      }
    } catch (err: any) {
      console.error('🧇 RAG milestone error:', err);
      console.error('🧇 Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        stack: err.stack,
      });
      setError(`Unable to generate summary: ${err.message || err.code || 'Unknown error'}`);
      
      // Fallback summary
      setSummary({
        summary: 'Your latest video conversation',
        keyPoints: ['Recent update shared', 'Connection maintained'],
        confidence: 0.3,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const extractKeyPoints = (text: string): string[] => {
    // Extract meaningful points from the summary text
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    // Look for sentences that contain key information
    const keyPoints = sentences
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 4) // Limit to 4 points max
      .map(point => {
        // Clean up the point - remove leading conjunctions
        point = point.replace(/^(and|but|so|then|also|additionally)\s+/i, '');
        // Capitalize first letter
        point = point.charAt(0).toUpperCase() + point.slice(1);
        // Ensure it doesn't end with a period (we'll add bullets)
        point = point.replace(/\.$/, '');
        return point;
      });
    
    return keyPoints.length > 0 ? keyPoints : ['Recent conversation shared'];
  };

  if (!lastVideo) return null;

  const handlePress = () => {
    console.log('🎯 RAGMilestone pressed:', { 
      isActive, 
      hasSummary: !!summary, 
      isLoading,
      error: !!error 
    });
    onPress();
  };

  return (
    <Pressable
      className={cn(
        "w-16 h-20 rounded-waffle mr-3 relative min-h-[44px] min-w-[44px] border-2",
        isActive ? "border-orange-500" : "border-orange-300",
        "bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm",
        className
      )}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Video summary milestone"
      disabled={false}
    >
      {/* Content Container */}
      <View className="flex-1 rounded-[10px] overflow-hidden relative p-2 justify-center items-center">
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : error ? (
          <View className="items-center">
            <Text className="text-white text-xs font-bold">⚠️</Text>
            <Text className="text-white text-[8px] text-center">Error</Text>
          </View>
        ) : (
          <View className="items-center justify-center flex-1">
            {/* Main Icon */}
            <Text className="text-white text-xl">📝</Text>
          </View>
        )}



        {/* Active Border Indicator */}
        <View className={cn(
          "absolute inset-0 rounded-[10px] border-2",
          isActive ? "border-orange-200" : "border-orange-400/50"
        )} />
      </View>

      {/* Milestone Label */}
      <View className="absolute -bottom-1 left-0 right-0">
        <View className="bg-orange-500 rounded-full px-1 py-0.5">
          <Text className="text-white text-[6px] font-bold text-center">
            MILESTONE
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

// Summary display component for the video area
interface SummaryDisplayProps {
  summary: VideoSummary;
  lastVideo: {
    isFromCurrentUser: boolean;
    timeAgo: string;
  };
  friendName?: string;
  onClose: () => void;
}

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  summary,
  lastVideo,
  friendName,
  onClose,
}) => {
  return (
    <View className="flex-1 bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <View className="flex-row justify-between items-center p-6 pb-4">
        <View className="flex-1">
          <Text className="text-orange-900 font-header-bold text-xl">
            📝 Conversation Summary
          </Text>
          <Text className="text-orange-700 font-body text-sm mt-1">
            Based on {lastVideo.isFromCurrentUser ? 'your' : `${friendName}'s`} latest video
          </Text>
        </View>
        
        <Pressable
          onPress={onClose}
          className="w-8 h-8 rounded-full bg-orange-200 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Close summary"
        >
          <Text className="text-orange-800 font-bold">×</Text>
        </Pressable>
      </View>

      {/* Scrollable Key Points Area */}
      <View className="flex-1 px-6 pb-8">
        <View className="bg-white rounded-2xl p-6 border border-orange-200 flex-1">
          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {summary.keyPoints.map((point, index) => (
              <View key={index} className="flex-row items-start mb-5">
                <Text className="text-orange-600 font-bold mr-3 text-lg">•</Text>
                <Text className="text-orange-900 font-body text-base flex-1 leading-6">
                  {point}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>


    </View>
  );
}; 