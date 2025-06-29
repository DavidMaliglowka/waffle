// Firebase is automatically initialized from GoogleService-Info.plist on iOS
// and google-services.json on Android with React Native Firebase
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Simple Firebase initialization logging
console.log('🔥 Firebase initialized');

// Basic configuration check (non-blocking)
const validateFirebaseConfig = () => {
  try {
    const app = auth().app;
    const options = app.options;
    
    if (options.projectId && options.projectId !== 'your-firebase-project-id') {
      console.log('✅ Firebase configuration looks good');
    } else {
      console.warn('⚠️ Firebase configuration might need attention');
    }
      } catch (error: any) {
      console.warn('⚠️ Firebase validation error:', error.message);
    }
};

// Run non-blocking validation
validateFirebaseConfig();

// Export Firebase services
export { auth, firestore, storage };

// Firebase Auth instance
export const firebaseAuth = auth();

// Firestore instance
export const firebaseFirestore = firestore();

// Storage instance
export const firebaseStorage = storage();

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