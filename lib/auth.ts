import React from 'react';
import auth from '@react-native-firebase/auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Alert, Platform } from 'react-native';

export type AuthUser = {
  uid: string;
  email?: string;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  providerId: string;
};

export type AuthResult = {
  success: boolean;
  user?: AuthUser;
  error?: string;
};

export class AuthService {
  private static instance: AuthService;
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Format phone number to ensure proper format
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add + if not present
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    
    return formatted;
  }

  // Apple Sign-In implementation
  async signInWithApple(): Promise<AuthResult> {
    try {
      // Start the sign-in request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // Ensure Apple returned a user identityToken
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identify token returned');
      }

      // Create a Firebase credential from the response
      const { identityToken, nonce } = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

      // Sign the user in with the credential
      const userCredential = await auth().signInWithCredential(appleCredential);
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error: any) {
      console.error('Apple Sign-In error:', error);
      return {
        success: false,
        error: error.message || 'Apple Sign-In failed',
      };
    }
  }

  // Phone/SMS authentication - Step 1: Send verification code
  async sendSMSVerification(phoneNumber: string): Promise<AuthResult> {
    try {
      // Format phone number properly
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      console.log('🔥 Firebase Phone Auth Debug - Starting SMS verification for:', formattedNumber);
      
      // For development/simulator: Implement a bypass for known issues
      if (__DEV__ && Platform.OS === 'ios') {
        console.log('🚨 DEV MODE: Implementing phone auth bypass for iOS simulator');
        
        // Create a mock confirmation that simulates Firebase behavior
        const mockConfirmation = {
          confirm: async (code: string) => {
            console.log('🔥 Mock confirmation with code:', code);
            
            // Simulate Firebase user creation for development
            const mockUserCredential = {
              user: {
                uid: 'dev-phone-user-' + Date.now(),
                phoneNumber: formattedNumber,
                email: null,
                displayName: null,
                photoURL: null,
                providerData: [{ providerId: 'phone' }]
              }
            };
            
            return mockUserCredential;
          }
        };
        
        // Store mock confirmation for later use
        (global as any).__smsConfirmation = mockConfirmation;
        
        return {
          success: true,
          user: undefined, // No user yet, waiting for verification
        };
      }
      
      // Production Firebase call
      console.log('🔥 Calling Firebase signInWithPhoneNumber...');
      const confirmation = await auth().signInWithPhoneNumber(formattedNumber);
      console.log('🔥 Firebase confirmation received:', !!confirmation);
      
      // Store confirmation for later use
      (global as any).__smsConfirmation = confirmation;
      
      return {
        success: true,
        user: undefined, // No user yet, waiting for verification
      };
    } catch (error: any) {
      console.error('🔥 SMS verification error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // More helpful error messages for common issues
      let errorMessage = error.message || 'Failed to send SMS verification';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Please enter a valid phone number with country code (e.g., +1 650-123-1234)';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later.';
      } else if (__DEV__) {
        errorMessage = `Development Error: ${error.code || 'unknown'} - ${error.message}. Try Apple Sign-In instead.`;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Phone/SMS authentication - Step 2: Verify code
  async verifySMSCode(code: string): Promise<AuthResult> {
    try {
      const confirmation = (global as any).__smsConfirmation;
      
      if (!confirmation) {
        throw new Error('No SMS verification in progress');
      }

      console.log('🔥 Verifying SMS code:', code);
      const userCredential = await confirmation.confirm(code);
      console.log('🔥 SMS verification successful:', !!userCredential.user);
      
      // Clear stored confirmation
      delete (global as any).__smsConfirmation;
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error: any) {
      console.error('🔥 SMS code verification error:', {
        code: error.code,
        message: error.message
      });
      
      // Better error messages for common verification issues
      let errorMessage = error.message || 'Invalid verification code';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code expired. Please request a new code.';
      } else if (__DEV__) {
        errorMessage = `Development: For mock phone auth, use code "123456"`;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Sign out
  async signOut(): Promise<AuthResult> {
    try {
      await auth().signOut();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sign out failed',
      };
    }
  }

  // Get current user
  getCurrentUser(): AuthUser | null {
    const user = auth().currentUser;
    return user ? this.formatUser(user) : null;
  }

  // Check authentication state
  onAuthStateChanged(callback: (user: AuthUser | null) => void) {
    return auth().onAuthStateChanged((user) => {
      callback(user ? this.formatUser(user) : null);
    });
  }

  // Helper to format Firebase user for app consumption
  private formatUser(firebaseUser: any): AuthUser {
    const providerId = firebaseUser.providerData[0]?.providerId || 'unknown';
    
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      phoneNumber: firebaseUser.phoneNumber,
      photoURL: firebaseUser.photoURL,
      providerId,
    };
  }

  // Check if Apple Sign-In is available
  static isAppleSignInAvailable(): boolean {
    return appleAuth.isSupported;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();

// Export auth state hook for React components
export const useAuthState = () => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}; 