import React, { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColorScheme } from '@/components/useColorScheme';
import { useAuthState, authService, type AuthUser } from '@/lib/auth';
import { WaffleThemeProvider } from '@/components/ThemeProvider';
import { inviteService } from '@/lib/inviteService';

// Import NativeWind CSS
import '../global.css';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Configure how notifications should be handled when the app is running
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show alerts for Firebase silent notifications
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

// Loading component
function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F2' }}>
      <ActivityIndicator size="large" color="#FDB833" />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#3A3A3A', fontFamily: 'SpaceMono' }}>Loading Waffle...</Text>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    // TODO: Add Poppins and Inter fonts when available
    // 'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    // 'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    // 'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    // 'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    // 'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    // 'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    // 'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) {
      console.error('🧇 Font loading error:', error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialize deferred deep linking on app launch
  useEffect(() => {
    const initializeDeferred = async () => {
      try {
        await inviteService.initializeDeferredDeepLinking();
      } catch (error) {
        console.error('🧇 Error initializing deferred deep linking:', error);
      }
    };

    initializeDeferred();
  }, []);

  // Register for push notifications (for Firebase APNs)
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      console.log('🧇 Waffle Auth State - Loading:', authLoading, 'User:', user ? 'authenticated' : 'not authenticated');
      setUser(user);
      setAuthLoading(false);
      console.log('🧇 Waffle: Auth state loaded. User authenticated:', !!user);
    });

    return unsubscribe;
  }, []);

  // Deep linking handler
  useEffect(() => {
    // Handle initial URL when app is launched via deep link (cold start)
    const handleInitialURL = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          console.log('🧇 Deep Link: App launched with URL:', initialUrl);
          await handleIncomingURL(initialUrl, true); // Mark as potentially deferred
        }
      } catch (error) {
        console.error('🧇 Deep Link: Error getting initial URL:', error);
      }
    };

    // Handle URL when app is opened via deep link (warm start)
    const handleURL = async (event: { url: string }) => {
      console.log('🧇 Deep Link: App opened with URL:', event.url);
      await handleIncomingURL(event.url, false); // Not deferred since app was already running
    };

    // Set up listeners
    handleInitialURL();
    const subscription = Linking.addEventListener('url', handleURL);

    return () => subscription?.remove();
  }, [user, authLoading]);

  // Process incoming deep links
  const handleIncomingURL = async (url: string, isPotentiallyDeferred: boolean = false) => {
    try {
      const parsed = Linking.parse(url);
      console.log('🧇 Deep Link: Parsed URL:', parsed, isPotentiallyDeferred ? '(potentially deferred)' : '(direct)');

      // Handle invite links: waffleapp.com/invite?by=userId
      if (parsed.path === '/invite' && parsed.queryParams) {
        const inviterUserId = parsed.queryParams.by as string;
        console.log('🧇 Deep Link: Invite link detected, inviter:', inviterUserId);
        
        // Store invite information for later processing
        if (inviterUserId) {
          // If this is a cold start (potentially deferred), check if app was recently installed
          const isDeferred = isPotentiallyDeferred && await inviteService.getAppLaunchCount() <= 3;
          await inviteService.storePendingInvite(inviterUserId, isDeferred);
        }

        // Navigate appropriately based on auth state
        if (!authLoading) {
          if (user) {
            // User is authenticated - go to main app and potentially show invite accepted message
            router.replace('/(tabs)/chats');
            
            // Process the invite immediately if user is already authenticated
            setTimeout(async () => {
              try {
                const processed = await inviteService.processPendingInvite(user.uid);
                if (processed) {
                  console.log('🧇 Deep Link: Invite processed immediately for authenticated user');
                }
              } catch (error) {
                console.error('🧇 Deep Link: Error processing immediate invite:', error);
              }
            }, 1000);
          } else {
            // User is not authenticated - go to onboarding/auth with invite context
            router.replace('/onboarding');
          }
        }
      }
    } catch (error) {
      console.error('🧇 Deep Link: Error processing URL:', error);
    }
  };

  if (!loaded) {
    return <LoadingScreen />;
  }

  return (
    <WaffleThemeProvider>
      <RootLayoutNav user={user} authLoading={authLoading} />
    </WaffleThemeProvider>
  );
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'ios') {
    try {
      // Request permission for notifications (required for APNs)
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: false,      // We don't need visible alerts
          allowBadge: false,      // We don't need badges
          allowSound: false,      // We don't need sounds
          allowCriticalAlerts: false,
          allowProvisional: false,
          allowDisplayInCarPlay: false,
        },
      });
      
      if (status !== 'granted') {
        console.log('🧇 Push notification permission not granted, but Firebase can still use silent notifications');
      } else {
        console.log('🧇 Push notification permission granted for Firebase APNs');
      }

      // Get the push notification token for Firebase
      const token = await Notifications.getExpoPushTokenAsync();
      console.log('🧇 Expo push token obtained for Firebase APNs:', token.data);
      
    } catch (error) {
      console.log('🧇 Error setting up push notifications for Firebase APNs:', error);
    }
  }
}

function RootLayoutNav({ user, authLoading }: { user: any; authLoading: boolean }) {
  const colorScheme = useColorScheme();
  const segments = useSegments();

  // Handle navigation based on auth state
  useEffect(() => {
    if (!authLoading) {
      const first = segments[0];
      
      if (!user) {
        // User not authenticated - redirect to auth flow if on protected routes
        const allowed = ['auth', 'onboarding', '__']; 
        if (first && !allowed.includes(first)) {
          console.log('🧇 Unauthenticated access to protected route – redirecting to login');
          router.replace('/auth/phone');
        } else if (!first) {
          // Handle case where segments might not be populated yet after logout
          console.log('🧇 User logged out, ensuring redirect to auth');
          router.replace('/auth/phone');
        }
              } else {
          // User is authenticated - process pending invites
          processPendingInvites(user.uid);
          
          // Check if they need phone collection
          const needsPhone = authService.needsPhoneCollection();
          const authRoutes = ['auth', 'onboarding'];
          const currentPath = segments.join('/');
          
          // Don't redirect if user is already in the auth flow (phone collection or code verification)
          const inAuthFlow = currentPath === 'auth/phone-collection' || currentPath === 'auth/code';
          
          if (needsPhone && !inAuthFlow && first !== 'auth') {
            // Apple Sign-In user without phone number - redirect to phone collection
            console.log('🧇 Apple Sign-In user needs phone collection');
            router.replace('/auth/phone-collection');
          } else if (!needsPhone && (!first || authRoutes.includes(first))) {
            // User has all required info - redirect to main app
            console.log('🧇 Authenticated user with complete profile – redirecting to main app');
            router.replace('/(tabs)/chats');
          }
        }
    }
  }, [user, authLoading, segments]);

  // Process pending invites when user is authenticated
  const processPendingInvites = async (userId: string) => {
    try {
      const processed = await inviteService.processPendingInvite(userId);
      if (processed) {
        console.log('🧇 Deep Link: Successfully processed pending invite');
        // Optionally show a success message or notification
      }
    } catch (error) {
      console.error('🧇 Deep Link: Error processing pending invites:', error);
    }
  };

  // Force navigation refresh when auth state changes - MUST be called before any early returns
  React.useEffect(() => {
    console.log('🧇 Waffle: Auth state changed, refreshing navigation...');
  }, [user]);

  // Debug auth state
  console.log('🧇 Waffle Auth State - Loading:', authLoading, 'User:', user ? 'authenticated' : 'not authenticated');

  // Show loading screen while checking auth state
  if (authLoading) {
    console.log('🧇 Waffle: Still loading auth state...');
    return <LoadingScreen />;
  }

  console.log('🧇 Waffle: Auth state loaded. User authenticated:', !!user);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {user ? (
          // User is authenticated - show main app
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </>
        ) : (
          // User is not authenticated - show auth flow
          <>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          </>
        )}
        {/* Fallback for not found */}
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
    </ThemeProvider>
  );
}
