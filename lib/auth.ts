import React from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Alert, Platform } from 'react-native';
import * as Localization from 'expo-localization';
import { FirestoreService } from './firestore';

// Use fallback for expo-localization until native module is properly configured
let LocalizationFallback: any = null;
try {
  LocalizationFallback = require('expo-localization');
} catch (error) {
  console.log('🧇 expo-localization not available, using fallback');
  LocalizationFallback = null;
}

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
  private firestoreService: FirestoreService;
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
  }

  // Get user's country code based on device locale
  private getUserCountryCode(): string {
    try {
      // Fallback if expo-localization is not available
      if (!LocalizationFallback) {
        console.log('🧇 expo-localization not available, defaulting to +1');
        return '+1';
      }
      
      const locale = LocalizationFallback.getLocales()[0];
      const region = locale.regionCode || 'US';
      
      // Common country code mappings
      const countryCodeMap: { [key: string]: string } = {
        'US': '+1', 'CA': '+1',
        'GB': '+44', 'IE': '+353',
        'AU': '+61', 'NZ': '+64',
        'DE': '+49', 'FR': '+33', 'IT': '+39', 'ES': '+34',
        'JP': '+81', 'KR': '+82', 'CN': '+86',
        'IN': '+91', 'BR': '+55', 'MX': '+52',
        'RU': '+7', 'TR': '+90', 'SA': '+966',
        'AE': '+971', 'SG': '+65', 'MY': '+60',
        'TH': '+66', 'VN': '+84', 'PH': '+63',
        'ID': '+62', 'PK': '+92', 'BD': '+880',
        'LK': '+94', 'NP': '+977', 'AF': '+93',
        'ZA': '+27', 'EG': '+20', 'NG': '+234',
        'KE': '+254', 'GH': '+233', 'UG': '+256',
        'TZ': '+255', 'ZW': '+263', 'BW': '+267',
        'AR': '+54', 'CL': '+56', 'CO': '+57',
        'PE': '+51', 'VE': '+58', 'UY': '+598',
        'PY': '+595', 'BO': '+591', 'EC': '+593',
        'GY': '+592', 'SR': '+597', 'GF': '+594',
      };
      
      return countryCodeMap[region] || '+1'; // Default to US
    } catch (error) {
      console.log('🧇 Could not detect country, defaulting to +1');
      return '+1'; // Default fallback
    }
  }

  // Format phone number with intelligent country code detection
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If already has country code (starts with +), return as-is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // If starts with country code digits but no +, add it
    if (cleaned.startsWith('1') && cleaned.length >= 10) {
      return '+' + cleaned;
    }
    
    // If it's a local number, add detected country code
    const countryCode = this.getUserCountryCode();
    
    // Handle US/CA special case - remove leading 1 if present for local numbers
    if (countryCode === '+1' && cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }
    
    return countryCode + cleaned;
  }

  // Validate phone number format for Firebase
  private validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
    const formatted = this.formatPhoneNumber(phoneNumber);
    
    // Check minimum length (country code + number, at least 8 digits total)
    if (formatted.length < 8) {
      return {
        isValid: false,
        error: 'Phone number too short. Please enter a valid phone number.'
      };
    }
    
    // Check maximum length (reasonable upper bound)
    if (formatted.length > 17) {
      return {
        isValid: false,
        error: 'Phone number too long. Please enter a valid phone number.'
      };
    }
    
    // Check if it's just a country code with no number
    if (formatted.replace('+', '').length < 6) {
      return {
        isValid: false,
        error: 'Please enter a complete phone number.'
      };
    }
    
    // Basic format check (+ followed by digits)
    if (!/^\+\d{6,15}$/.test(formatted)) {
      return {
        isValid: false,
        error: 'Invalid phone number format. Please enter a valid phone number.'
      };
    }
    
    return { isValid: true };
  }

  // Apple Sign-In implementation
  async signInWithApple(): Promise<AuthResult> {
    try {
      // Check if Apple Sign-In is available on this device
      if (!appleAuth.isSupported) {
        return {
          success: false,
          error: 'Apple Sign-In is not supported on this device.',
        };
      }

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
      
      // Create or update user profile in Firestore
      await this.createOrUpdateUserProfile(userCredential.user);
      
      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
    } catch (error: any) {
      console.error('Apple Sign-In error:', error);
      
      // Handle specific Apple Sign-In errors
      if (error.code === appleAuth.Error.CANCELED) {
        return {
          success: false,
          error: 'Apple Sign-In was canceled',
        };
      }
      
      if (error.code === appleAuth.Error.FAILED) {
        return {
          success: false,
          error: 'Apple Sign-In failed. Please try again.',
        };
      }
      
      if (error.code === appleAuth.Error.INVALID_RESPONSE) {
        return {
          success: false,
          error: 'Invalid response from Apple. Please try again.',
        };
      }
      
      if (error.code === appleAuth.Error.NOT_HANDLED) {
        return {
          success: false,
          error: 'Apple Sign-In not handled. Please try again.',
        };
      }
      
      if (error.code === appleAuth.Error.UNKNOWN) {
        return {
          success: false,
          error: 'An unknown error occurred with Apple Sign-In.',
        };
      }
      
      return {
        success: false,
        error: error.message || 'Apple Sign-In failed. Please try again.',
      };
    }
  }

  // Phone/SMS authentication - Step 1: Send verification code
  async sendSMSVerification(phoneNumber: string, forceResend: boolean = false): Promise<AuthResult> {
    try {
      // Validate phone number format first
      const validation = this.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Format phone number properly
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      console.log('🔥 Firebase Phone Auth - Starting SMS verification for:', formattedNumber);
      
      // Create a timeout promise to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('SMS verification timed out')), 30000); // 30 second timeout
      });

      let confirmationResult;
      
      // Add comprehensive validation before calling Firebase  
      console.log('🔥 Firebase Phone Auth - Attempting to send SMS to:', formattedNumber);
      console.log('🔥 Firebase App Config Check:', {
        appId: auth().app.options.appId ? '***PRESENT***' : 'MISSING',
        apiKey: auth().app.options.apiKey ? '***PRESENT***' : 'MISSING',
        projectId: auth().app.options.projectId || 'MISSING',
        bundleId: auth().app.options.bundleId || auth().app.options.iosAppId || 'MISSING',
      });
      
      // Enhanced validation to prevent assertion failures
      const options = auth().app.options;
      if (!options.projectId || options.projectId === 'your-firebase-project-id') {
        throw new Error('Firebase configuration is incomplete or contains placeholder values. Please check your environment setup.');
      }
      
      if (!options.appId || options.appId.includes('YOUR_GOOGLE_APP_ID')) {
        throw new Error('Firebase App ID is missing or contains placeholder values. Please verify your GoogleService-Info.plist configuration.');
      }
      
      // Check URL scheme configuration which is critical for reCAPTCHA
      console.log('🔥 URL Scheme Check - Bundle ID for phone auth:', options.bundleId || options.iosAppId);
      
      // Wrap Firebase call with enhanced error handling to catch assertion failures
      try {
        console.log('🔥 Calling Firebase signInWithPhoneNumber...');
        
        // Race between Firebase verification and timeout with specific error handling
        confirmationResult = await Promise.race([
          auth().signInWithPhoneNumber(formattedNumber).catch((firebaseError) => {
            console.error('🚨 Firebase signInWithPhoneNumber Error:', {
              code: firebaseError.code,
              message: firebaseError.message,
              nativeErrorCode: firebaseError.nativeErrorCode,
              nativeErrorMessage: firebaseError.nativeErrorMessage
            });
            
            // Handle specific errors that might cause assertion failures
            if (firebaseError.message?.includes('assertion') || firebaseError.message?.includes('Assertion')) {
              throw new Error('Firebase Phone Auth is not properly configured. Please check that URL schemes are correctly set up in your app configuration.');
            }
            
            if (firebaseError.code === 'auth/app-not-authorized') {
              throw new Error('This app is not authorized for Firebase Phone Auth. Please check your Firebase project settings and SHA certificates.');
            }
            
            if (firebaseError.code === 'auth/invalid-app-credential') {
              throw new Error('Invalid Firebase app credentials. Please verify your GoogleService-Info.plist file is correct and up to date.');
            }
            
            throw firebaseError;
          }),
          timeoutPromise
        ]);
        
        console.log('🔥 Firebase signInWithPhoneNumber succeeded');
        
      } catch (wrapperError: any) {
        console.error('🚨 Phone Auth Wrapper Error:', wrapperError);
        throw wrapperError;
      }

      console.log('🔥 Firebase Phone Auth - SMS sent successfully');

      // Store confirmation globally for the verification step
      (global as any).__smsConfirmation = confirmationResult;
      
      // Track send time for resend rate limiting
      (global as any).__lastSMSSendTime = Date.now();
      
      // Store the ForceResendingToken if available (for proper resends)
      if (confirmationResult.verificationId) {
        // Note: React Native Firebase doesn't expose ForceResendingToken directly
        // We'll implement a different strategy for resends
        console.log('🔥 Firebase Phone Auth - Verification ID stored for resends');
      }

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('🔥 Firebase Phone Auth Error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/invalid-phone-number') {
        return {
          success: false,
          error: 'Invalid phone number format. Please check your number and try again.'
        };
      } else if (error.code === 'auth/too-many-requests') {
        return {
          success: false,
          error: 'Too many SMS requests. Please wait a few minutes before trying again.'
        };
      } else if (error.code === 'auth/quota-exceeded') {
        return {
          success: false,
          error: 'SMS quota exceeded. Please try again later.'
        };
      } else if (error.message?.includes('timed out')) {
        return {
          success: false,
          error: 'Request timed out. Please check your connection and try again.'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to send verification code. Please try again.'
      };
    }
  }

  // Resend SMS code with rate limiting to avoid reCAPTCHA
  async resendSMSCode(): Promise<AuthResult> {
    try {
      const phoneNumber = (global as any).__wafflePhone;
      
      if (!phoneNumber) {
        return {
          success: false,
          error: 'No phone number found. Please start over.'
        };
      }

      // Check if enough time has passed since last send (prevent spam)
      const lastSendTime = (global as any).__lastSMSSendTime || 0;
      const currentTime = Date.now();
      const timeSinceLastSend = currentTime - lastSendTime;
      const minInterval = 60000; // 60 seconds minimum between resends
      
      if (timeSinceLastSend < minInterval) {
        const remainingSeconds = Math.ceil((minInterval - timeSinceLastSend) / 1000);
        return {
          success: false,
          error: `Please wait ${remainingSeconds} seconds before requesting another code.`
        };
      }

      console.log('🔥 Firebase Phone Auth - Resending SMS code');
      
      // Update last send time
      (global as any).__lastSMSSendTime = currentTime;
      
      // Clear existing confirmation to start fresh
      delete (global as any).__smsConfirmation;
      
      // Send new verification (this may trigger reCAPTCHA but less frequently)
      return await this.sendSMSVerification(phoneNumber, false);
    } catch (error: any) {
      console.error('🔥 Firebase Phone Auth Resend Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resend verification code. Please try again.'
      };
    }
  }

  // Phone/SMS authentication - Step 2: Verify the code
  async verifySMSCode(code: string): Promise<AuthResult> {
    try {
      const confirmation = (global as any).__smsConfirmation;
      
      if (!confirmation) {
        return {
          success: false,
          error: 'No SMS verification in progress. Please request a new code.'
        };
      }

      console.log('🔥 Firebase Phone Auth - Verifying code');

      // Check if user is already signed in with another provider (like Apple)
      const currentUser = auth().currentUser;
      const isAppleUser = currentUser && currentUser.providerData.some(p => p.providerId === 'apple.com');

      if (isAppleUser) {
        // User is signed in with Apple - we need to link the phone credential instead of signing in
        console.log('🔥 Firebase Phone Auth - Linking phone to existing Apple account');
        
        try {
          // Get phone credential without signing in
          const phoneCredential = auth.PhoneAuthProvider.credential(confirmation.verificationId, code);
          
          // Link phone credential to existing Apple account
          const linkResult = await currentUser.linkWithCredential(phoneCredential);
          console.log('🔥 Firebase Phone Auth - Phone number successfully linked to Apple account');

          // Update user profile in Firestore with linked phone number
          await this.createOrUpdateUserProfile(linkResult.user);

          // Clear the stored confirmation
          delete (global as any).__smsConfirmation;

          return {
            success: true,
            user: this.formatUser(linkResult.user),
          };
          
        } catch (linkError: any) {
          console.error('🔥 Firebase Phone Auth - Link Error:', linkError);
          
          if (linkError.code === 'auth/credential-already-in-use') {
            return {
              success: false,
              error: 'This phone number is already associated with another account.'
            };
          } else if (linkError.code === 'auth/invalid-verification-code') {
            return {
              success: false,
              error: 'Invalid verification code. Please check the code and try again.'
            };
          }
          
          return {
            success: false,
            error: linkError.message || 'Failed to link phone number to your account.'
          };
        }
      } else {
        // No existing user or phone-only authentication - proceed with normal sign-in
        console.log('🔥 Firebase Phone Auth - Normal phone sign-in');
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Code verification timed out')), 15000);
        });

        // Race between Firebase verification and timeout
        const userCredential = await Promise.race([
          confirmation.confirm(code),
          timeoutPromise
        ]);

        console.log('🔥 Firebase Phone Auth - Code verified successfully');

        // Create or update user profile in Firestore
        await this.createOrUpdateUserProfile(userCredential.user);

        // Clear the stored confirmation
        delete (global as any).__smsConfirmation;

        return {
          success: true,
          user: this.formatUser(userCredential.user),
        };
      }
    } catch (error: any) {
      console.error('🔥 Firebase Phone Auth Verification Error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/invalid-verification-code') {
        return {
          success: false,
          error: 'Invalid verification code. Please check the code and try again.'
        };
      } else if (error.code === 'auth/code-expired') {
        return {
          success: false,
          error: 'Verification code has expired. Please request a new code.'
        };
      } else if (error.message?.includes('timed out')) {
        return {
          success: false,
          error: 'Verification timed out. Please try again.'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to verify code. Please try again.'
      };
    }
  }

  // Sign out user
  async signOut(): Promise<AuthResult> {
    try {
      await auth().signOut();
      
      // Clear any stored SMS confirmation
      delete (global as any).__smsConfirmation;
      delete (global as any).__wafflePhone;
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to sign out',
      };
    }
  }

  // Get current authenticated user
  getCurrentUser(): AuthUser | null {
    const user = auth().currentUser;
    return user ? this.formatUser(user) : null;
  }

  // Listen to authentication state changes
  onAuthStateChanged(callback: (user: AuthUser | null) => void) {
    return auth().onAuthStateChanged((user) => {
      callback(user ? this.formatUser(user) : null);
    });
  }

  // Format Firebase user to our AuthUser type
  private formatUser(firebaseUser: any): AuthUser {
    // For linked accounts, prioritize Apple provider as primary
    const hasApple = firebaseUser.providerData.some((p: any) => p.providerId === 'apple.com');
    const primaryProviderId = hasApple ? 'apple.com' : (firebaseUser.providerData[0]?.providerId || 'phone');
    
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      phoneNumber: firebaseUser.phoneNumber,
      photoURL: firebaseUser.photoURL,
      providerId: primaryProviderId,
    };
  }

  // Check if user needs phone number collection (for Apple Sign-In users)
  needsPhoneCollection(): boolean {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) return false;
    
    // Check if user has Apple provider and no phone number
    const hasAppleProvider = firebaseUser.providerData.some(p => p.providerId === 'apple.com');
    const hasPhoneNumber = !!firebaseUser.phoneNumber;
    
    // Apple Sign-In users without phone numbers need collection
    return hasAppleProvider && !hasPhoneNumber;
  }

  // Check if Apple Sign-In is available
  static isAppleSignInAvailable(): boolean {
    return appleAuth.isSupported;
  }

  private async createOrUpdateUserProfile(firebaseUser: FirebaseAuthTypes.User): Promise<void> {
    try {
      // Check if user profile already exists
      const existingProfile = await this.firestoreService.getUser(firebaseUser.uid);
      
      if (!existingProfile) {
        // Create new user profile
        console.log('🧇 Creating new user profile in Firestore');
        
        // Build user data object, only including fields with actual values
        const userData: any = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Waffle User',
        };
        
        // Only add fields if they have actual values (not undefined or null)
        if (firebaseUser.email) {
          userData.email = firebaseUser.email;
        }
        if (firebaseUser.phoneNumber) {
          userData.phoneNumber = firebaseUser.phoneNumber;
        }
        if (firebaseUser.photoURL) {
          userData.photoURL = firebaseUser.photoURL;
        }
        
        await this.firestoreService.createUser(userData);
      } else {
        // Update existing profile with any new info from Firebase Auth
        const updates: any = {};
        
        // Only update fields that have actual values and are different from existing
        if (firebaseUser.displayName && firebaseUser.displayName !== existingProfile.displayName) {
          updates.displayName = firebaseUser.displayName;
        }
        if (firebaseUser.email && firebaseUser.email !== existingProfile.email) {
          updates.email = firebaseUser.email;
        }
        if (firebaseUser.phoneNumber && firebaseUser.phoneNumber !== existingProfile.phoneNumber) {
          updates.phoneNumber = firebaseUser.phoneNumber;
        }
        if (firebaseUser.photoURL && firebaseUser.photoURL !== existingProfile.photoURL) {
          updates.photoURL = firebaseUser.photoURL;
        }
        
        if (Object.keys(updates).length > 0) {
          console.log('🧇 Updating user profile in Firestore with:', Object.keys(updates));
          await this.firestoreService.updateUser(firebaseUser.uid, updates);
        } else {
          console.log('🧇 User profile in Firestore is already up to date');
        }
      }
    } catch (error) {
      console.error('🧇 Error creating/updating user profile:', error);
      // Don't throw - authentication should still succeed even if profile creation fails
    }
  }
}

// React hook for authentication state
export const useAuthState = () => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const authService = AuthService.getInstance();
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
};

// Export singleton instance
export const authService = AuthService.getInstance(); 