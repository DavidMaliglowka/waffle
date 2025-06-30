import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { firebaseFunctions } from '@/lib/firebase';
import { cn } from '@/lib/utils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RAGSuggestion {
  id: string;
  text: string;
  confidence: number;
  source?: string;
  timestamp?: number;
}

interface RAGOverlayProps {
  chatId: string;
  isRecording: boolean;
  isVisible: boolean;
  onSuggestionSelect: (suggestion: RAGSuggestion) => void;
  onToggleVisibility: () => void;
  className?: string;
}

interface RAGQueryResult {
  response: string;
  sources: Array<{
    text: string;
    similarity: number;
    timestamp: number;
  }>;
  suggestions: RAGSuggestion[];
}

export const RAGOverlay: React.FC<RAGOverlayProps> = ({
  chatId,
  isRecording,
  isVisible,
  onSuggestionSelect,
  onToggleVisibility,
  className,
}) => {
  console.log('🧇 RAGOverlay render:', { chatId, isRecording, isVisible });
  const [suggestions, setSuggestions] = useState<RAGSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>('');
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  // Query timeout ref
  const queryTimeoutRef = useRef<number | null>(null);

  // Default conversation starters when no context is available
  const defaultSuggestions: RAGSuggestion[] = [
    {
      id: 'default_1',
      text: "Hey! How's your day going?",
      confidence: 0.8,
      source: 'default'
    },
    {
      id: 'default_2', 
      text: "I wanted to share something with you...",
      confidence: 0.7,
      source: 'default'
    },
    {
      id: 'default_3',
      text: "Quick update on what I've been up to",
      confidence: 0.6,
      source: 'default'
    }
  ];

  // Animate overlay visibility
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  // Query RAG system for suggestions
  const queryRAGSuggestions = async (query: string) => {
    if (!chatId || !query.trim()) {
      setSuggestions(defaultSuggestions);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const queryRAGFunction = firebaseFunctions.httpsCallable('queryRAG');
      const result = await queryRAGFunction({
        chatId,
        query,
        maxResults: 5,
      });

      const ragResult = result.data as RAGQueryResult;
      
      if (ragResult.suggestions && ragResult.suggestions.length > 0) {
        setSuggestions(ragResult.suggestions);
      } else {
        // Generate suggestions from RAG response
        const aiSuggestions = generateSuggestionsFromResponse(ragResult.response, ragResult.sources);
        setSuggestions(aiSuggestions);
      }
      
      setLastQuery(query);
    } catch (err: any) {
      console.error('🧇 RAG query error:', err);
      setError('Unable to get suggestions. Using default options.');
      setSuggestions(defaultSuggestions);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate suggestions from RAG response
  const generateSuggestionsFromResponse = (response: string, sources: any[]): RAGSuggestion[] => {
    const baseSuggestions = [
      `Based on our conversation: ${response.slice(0, 50)}...`,
      "Let me continue our discussion about this...",
      "I wanted to follow up on what we talked about",
    ];

    return baseSuggestions.map((text, index) => ({
      id: `generated_${index}`,
      text,
      confidence: 0.9 - (index * 0.1),
      source: 'rag_generated',
      timestamp: Date.now(),
    }));
  };

  // Debounced query function
  const debouncedQuery = (query: string) => {
    if (queryTimeoutRef.current) {
      clearTimeout(queryTimeoutRef.current);
    }
    
    queryTimeoutRef.current = setTimeout(() => {
      queryRAGSuggestions(query);
    }, 1000);
  };

  // Initial query when recording starts
  useEffect(() => {
    if (isRecording && isVisible) {
      // Query for context about this conversation
      const initialQuery = "What should I talk about? What were we discussing recently?";
      debouncedQuery(initialQuery);
    }
  }, [isRecording, isVisible, chatId]);

  // Refresh suggestions periodically during recording
  useEffect(() => {
    if (!isRecording || !isVisible) return;

    const refreshInterval = setInterval(() => {
      const contextQuery = `What's a good follow-up to our recent conversation? Current time: ${new Date().toLocaleTimeString()}`;
      debouncedQuery(contextQuery);
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(refreshInterval);
  }, [isRecording, isVisible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (queryTimeoutRef.current) {
        clearTimeout(queryTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
      className={cn(
        "absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-sm border-t border-gray-200/50",
        className
      )}
    >
      {/* Handle Bar */}
      <View className="flex-row justify-center py-3">
        <View className="w-12 h-1 bg-gray-300 rounded-full" />
      </View>

      {/* Header */}
      <View className="flex-row justify-between items-center px-6 pb-4">
        <View className="flex-1">
          <Text className="text-lg font-header text-darkCharcoal">
            💬 AI Reply Suggestions
          </Text>
          <Text className="text-sm font-body text-gray-600 mt-1">
            {isLoading ? 'Finding relevant context...' : 
             error ? 'Using default suggestions' :
             `Based on your conversation history`}
          </Text>
        </View>
        
        <Pressable
          onPress={onToggleVisibility}
          className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
        >
          <Text className="text-gray-600 font-body-bold">×</Text>
        </Pressable>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="px-6 py-4 flex-row items-center">
          <ActivityIndicator size="small" color="#FDB833" />
          <Text className="ml-3 text-gray-600 font-body">
            Analyzing conversation context...
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View className="px-6 py-2 bg-orange-50 border-l-4 border-orange-400 mx-6 rounded">
          <Text className="text-orange-700 font-body text-sm">{error}</Text>
        </View>
      )}

      {/* Suggestions List */}
      <ScrollView 
        className="max-h-60 px-6"
        showsVerticalScrollIndicator={false}
      >
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={suggestion.id}
            onPress={() => onSuggestionSelect(suggestion)}
            className={cn(
              "bg-white border border-gray-200/60 rounded-waffle p-4 mb-3 hover:border-gray-300",
              "active:bg-primary/10 active:border-primary transition-colors"
            )}
          >
            <View className="flex-row items-start">
              <View className="flex-1">
                <Text className="text-darkCharcoal font-body text-base leading-5">
                  {suggestion.text}
                </Text>
                
                {/* Confidence indicator */}
                <View className="flex-row items-center mt-2">
                  <View className="flex-row items-center mr-3">
                    <View className="w-2 h-2 rounded-full bg-primary mr-1" />
                    <Text className="text-xs text-gray-500 font-body">
                      {Math.round(suggestion.confidence * 100)}% match
                    </Text>
                  </View>
                  
                  {suggestion.source === 'rag_generated' && (
                    <View className="bg-primary/20 px-2 py-1 rounded-full">
                      <Text className="text-xs text-primary font-body-bold">
                        AI Generated
                      </Text>
                    </View>
                  )}
                  
                  {suggestion.source === 'default' && (
                    <View className="bg-gray-100 px-2 py-1 rounded-full">
                      <Text className="text-xs text-gray-600 font-body">
                        Starter
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Selection indicator */}
              <View className="ml-3 w-6 h-6 rounded-full border-2 border-primary items-center justify-center">
                <Text className="text-primary font-body-bold text-xs">→</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      <View className="px-6 py-4 border-t border-gray-100">
        <Text className="text-center text-xs text-gray-500 font-body">
          Tap a suggestion to guide your video message
        </Text>
      </View>
    </Animated.View>
  );
}; 