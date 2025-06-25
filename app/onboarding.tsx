import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const onboardingData = [
  {
    id: 1,
    title: "Welcome to Waffle",
    subtitle: "Share authentic moments with friends",
    description: "Capture and share spontaneous video reactions to your friends' content in real-time.",
    emoji: "🧇"
  },
  {
    id: 2,
    title: "React & Respond",
    subtitle: "See genuine reactions instantly",
    description: "Record your authentic reactions to friends' posts and discover how they really feel about yours.",
    emoji: "📱"
  },
  {
    id: 3,
    title: "Build Real Connections",
    subtitle: "Deeper friendships through video",
    description: "Move beyond likes and comments to build meaningful connections through authentic video responses.",
    emoji: "👥"
  }
];

export default function OnboardingScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);

  const handleNext = () => {
    if (currentPage < onboardingData.length - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      scrollViewRef.current?.scrollTo({ x: nextPage * width, animated: true });
    } else {
      router.push('/auth/login');
    }
  };

  const handleSkip = () => {
    router.push('/auth/login');
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    scrollX.value = contentOffsetX;
    const page = Math.round(contentOffsetX / width);
    setCurrentPage(page);
  };

  const renderDots = () => {
    return (
      <View className="flex-row justify-center items-center space-x-2 mb-8">
        {onboardingData.map((_, index) => {
          const animatedStyle = useAnimatedStyle(() => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const dotWidth = interpolate(
              scrollX.value,
              inputRange,
              [8, 24, 8],
              Extrapolate.CLAMP
            );
            const opacity = interpolate(
              scrollX.value,
              inputRange,
              [0.3, 1, 0.3],
              Extrapolate.CLAMP
            );
            return {
              width: dotWidth,
              opacity,
            };
          });

          return (
            <Animated.View
              key={index}
              className="h-2 bg-waffle-yellow rounded-full"
              style={animatedStyle}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-waffle-cream">
      {/* Skip Button */}
      <View className="absolute top-16 right-6 z-10">
        <TouchableOpacity onPress={handleSkip} className="px-4 py-2">
          <Text className="text-waffle-charcoal font-medium">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {onboardingData.map((item, index) => (
          <View key={item.id} className="justify-center items-center px-8" style={{ width }}>
            {/* Emoji */}
            <Text className="text-8xl mb-8">{item.emoji}</Text>

            {/* Title */}
            <Text className="text-3xl font-bold text-waffle-charcoal text-center mb-4">
              {item.title}
            </Text>

            {/* Subtitle */}
            <Text className="text-xl font-semibold text-waffle-orange text-center mb-6">
              {item.subtitle}
            </Text>

            {/* Description */}
            <Text className="text-base text-gray-600 text-center leading-6 px-4">
              {item.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Section */}
      <View className="px-8 pb-8">
        {renderDots()}
        
        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleNext}
          className="bg-waffle-yellow rounded-full py-4 px-8 shadow-sm"
        >
          <Text className="text-waffle-charcoal font-semibold text-lg text-center">
            {currentPage === onboardingData.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 