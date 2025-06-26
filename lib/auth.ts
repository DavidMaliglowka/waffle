import React from 'react';
import auth from '@react-native-firebase/auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Alert, Platform } from 'react-native';

// Use fallback for expo-localization until native module is properly configured
let Localization: any = null;
try {
  Localization = require('expo-localization');
} catch (error) {
  console.log('🧇 expo-localization not available, using fallback');
  Localization = null;
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
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Get user's country code based on device locale
  private getUserCountryCode(): string {
    try {
      // Fallback if expo-localization is not available
      if (!Localization) {
        console.log('🧇 expo-localization not available, defaulting to +1');
        return '+1';
      }
      
      const locale = Localization.getLocales()[0];
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
      
      // Handle specific Apple Sign-In errors
      if (error.code === '1000') {
        return {
          success: false,
          error: 'Apple Sign-In requires a paid Apple Developer Program membership ($99/year). This feature will be available once we upgrade our developer account.'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Apple Sign-In failed',
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
      
      // Race between Firebase verification and timeout
      confirmationResult = await Promise.race([
        auth().signInWithPhoneNumber(formattedNumber),
        timeoutPromise
      ]);

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

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Code verification timed out')), 15000); // 15 second timeout
      });

      // Race between Firebase verification and timeout
      const userCredential = await Promise.race([
        confirmation.confirm(code),
        timeoutPromise
      ]);

      console.log('🔥 Firebase Phone Auth - Code verified successfully');

      // Clear the stored confirmation
      delete (global as any).__smsConfirmation;

      return {
        success: true,
        user: this.formatUser(userCredential.user),
      };
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
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      phoneNumber: firebaseUser.phoneNumber,
      photoURL: firebaseUser.photoURL,
      providerId: firebaseUser.providerData[0]?.providerId || 'phone',
    };
  }

  // Check if Apple Sign-In is available
  static isAppleSignInAvailable(): boolean {
    return appleAuth.isSupported;
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