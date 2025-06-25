import { initializeApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// Firebase is automatically initialized from GoogleService-Info.plist
// This file provides typed exports and configuration

export { auth };

// Firebase Auth instance
export const firebaseAuth = auth();

// Auth configuration
export const authConfig = {
  // Enable Apple Sign-In and Phone authentication
  supportedProviders: ['apple.com', 'phone'],
  
  // App-specific settings
  appDomain: 'waffle.app',
  
  // Development settings
  persistenceEnabled: true,
};

// Helper functions for authentication
export const authHelpers = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return firebaseAuth.currentUser !== null;
  },
  
  // Get current user
  getCurrentUser: () => {
    return firebaseAuth.currentUser;
  },
  
  // Sign out
  signOut: async () => {
    try {
      await firebaseAuth.signOut();
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },
};

export default firebaseAuth; 