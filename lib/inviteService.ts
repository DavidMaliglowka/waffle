import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestoreService } from './firestore';
import * as Linking from 'expo-linking';

export interface PendingInvite {
  inviterUserId: string;
  timestamp: number;
  processed: boolean;
  deferred?: boolean; // Track if this was a deferred invite
}

export interface DeferredInviteData {
  inviterUserId: string;
  timestamp: number;
  source: 'universal_link' | 'web_fallback' | 'pasteboard' | 'first_launch';
}

export class InviteService {
  private static instance: InviteService | null = null;
  private static readonly PENDING_INVITE_KEY = 'waffle_pending_invite';
  private static readonly PROCESSED_INVITES_KEY = 'waffle_processed_invites';
  private static readonly APP_LAUNCH_COUNT_KEY = 'waffle_app_launch_count';
  private static readonly FIRST_LAUNCH_DATE_KEY = 'waffle_first_launch_date';
  private static readonly DEFERRED_INVITE_CHECK_KEY = 'waffle_deferred_invite_checked';

  static getInstance(): InviteService {
    if (!InviteService.instance) {
      InviteService.instance = new InviteService();
    }
    return InviteService.instance;
  }

  /**
   * Initialize deferred deep linking - call this on app launch
   */
  async initializeDeferredDeepLinking(): Promise<void> {
    try {
      // Track app launches
      await this.trackAppLaunch();
      
      // Check for deferred invites on first few launches
      const launchCount = await this.getAppLaunchCount();
      if (launchCount <= 3) { // Check on first 3 launches to catch deferred cases
        await this.checkForDeferredInvites();
      }
    } catch (error) {
      console.error('🧇 Invite Service: Error initializing deferred deep linking:', error);
    }
  }

  /**
   * Track app launch count for deferred invite detection
   */
  private async trackAppLaunch(): Promise<void> {
    try {
      const currentCount = await this.getAppLaunchCount();
      const newCount = currentCount + 1;
      
      await AsyncStorage.setItem(InviteService.APP_LAUNCH_COUNT_KEY, newCount.toString());
      
      // Store first launch date
      if (currentCount === 0) {
        await AsyncStorage.setItem(InviteService.FIRST_LAUNCH_DATE_KEY, Date.now().toString());
        console.log('🧇 Invite Service: First app launch detected');
      }
      
      console.log('🧇 Invite Service: App launch count:', newCount);
    } catch (error) {
      console.error('🧇 Invite Service: Error tracking app launch:', error);
    }
  }

  /**
   * Get app launch count
   */
  async getAppLaunchCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(InviteService.APP_LAUNCH_COUNT_KEY);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('🧇 Invite Service: Error getting app launch count:', error);
      return 0;
    }
  }

  /**
   * Check for deferred invites using multiple detection methods
   */
  private async checkForDeferredInvites(): Promise<void> {
    try {
      // Skip if we've already checked for deferred invites
      const alreadyChecked = await AsyncStorage.getItem(InviteService.DEFERRED_INVITE_CHECK_KEY);
      if (alreadyChecked) {
        return;
      }

      console.log('🧇 Invite Service: Checking for deferred invites...');
      
      // Method 1: Check if we have a pending invite without a recent URL event
      // This could indicate a deferred invite that was stored during app install process
      await this.detectStoredDeferredInvite();
      
      // Method 2: Check initial URL for invite parameters (in case of attribution)
      await this.checkInitialUrlForInvite();
      
      // Mark as checked
      await AsyncStorage.setItem(InviteService.DEFERRED_INVITE_CHECK_KEY, 'true');
      
    } catch (error) {
      console.error('🧇 Invite Service: Error checking for deferred invites:', error);
    }
  }

  /**
   * Detect if we have a stored deferred invite
   */
  private async detectStoredDeferredInvite(): Promise<void> {
    try {
      const pending = await this.getPendingInvite();
      const launchCount = await this.getAppLaunchCount();
      
      // If we have a pending invite and this is one of the first launches,
      // it might be a deferred invite
      if (pending && launchCount <= 3) {
        const ageInMinutes = (Date.now() - pending.timestamp) / (1000 * 60);
        
        // If the invite is relatively fresh (within 24 hours) and we haven't processed it,
        // it could be deferred
        if (ageInMinutes < 1440 && !pending.processed) {
          console.log('🧇 Invite Service: Potential deferred invite detected:', {
            inviterUserId: pending.inviterUserId,
            ageInMinutes: Math.round(ageInMinutes),
            launchCount
          });
          
          // Mark as deferred for tracking
          const deferredPending: PendingInvite = {
            ...pending,
            deferred: true
          };
          
          await AsyncStorage.setItem(InviteService.PENDING_INVITE_KEY, JSON.stringify(deferredPending));
        }
      }
    } catch (error) {
      console.error('🧇 Invite Service: Error detecting stored deferred invite:', error);
    }
  }

  /**
   * Check initial URL for invite parameters
   */
  private async checkInitialUrlForInvite(): Promise<void> {
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const parsed = Linking.parse(initialUrl);
        
        // Check if this is an invite URL
        if (parsed.path === '/invite' && parsed.queryParams?.by) {
          const inviterUserId = parsed.queryParams.by as string;
          console.log('🧇 Invite Service: Deferred invite detected from initial URL:', inviterUserId);
          
          // Store as deferred invite
          const deferredInvite: PendingInvite = {
            inviterUserId,
            timestamp: Date.now(),
            processed: false,
            deferred: true
          };
          
          await AsyncStorage.setItem(InviteService.PENDING_INVITE_KEY, JSON.stringify(deferredInvite));
        }
      }
    } catch (error) {
      console.error('🧇 Invite Service: Error checking initial URL for invite:', error);
    }
  }

  /**
   * Store a pending invite from a deep link
   */
  async storePendingInvite(inviterUserId: string, isDeferred: boolean = false): Promise<void> {
    try {
      const inviteData: PendingInvite = {
        inviterUserId,
        timestamp: Date.now(),
        processed: false,
        deferred: isDeferred,
      };
      
      await AsyncStorage.setItem(InviteService.PENDING_INVITE_KEY, JSON.stringify(inviteData));
      console.log('🧇 Invite Service: Stored pending invite:', {
        ...inviteData,
        type: isDeferred ? 'deferred' : 'direct'
      });
    } catch (error) {
      console.error('🧇 Invite Service: Error storing pending invite:', error);
      throw error;
    }
  }

  /**
   * Get pending invite if exists
   */
  async getPendingInvite(): Promise<PendingInvite | null> {
    try {
      const stored = await AsyncStorage.getItem(InviteService.PENDING_INVITE_KEY);
      if (!stored) return null;
      
      const invite = JSON.parse(stored) as PendingInvite;
      
      // Check if invite is still valid (within 7 days)
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - invite.timestamp > weekInMs) {
        await this.clearPendingInvite();
        return null;
      }
      
      return invite;
    } catch (error) {
      console.error('🧇 Invite Service: Error getting pending invite:', error);
      return null;
    }
  }

  /**
   * Process pending invite for authenticated user
   */
  async processPendingInvite(currentUserId: string): Promise<boolean> {
    try {
      const pendingInvite = await this.getPendingInvite();
      if (!pendingInvite || pendingInvite.processed) {
        return false;
      }

      // Don't process if user invited themselves
      if (pendingInvite.inviterUserId === currentUserId) {
        console.log('🧇 Invite Service: Self-invite detected, clearing');
        await this.clearPendingInvite();
        return false;
      }

      // Check if already friends or invitation already processed
      const existingFriendship = await this.checkExistingConnection(
        currentUserId, 
        pendingInvite.inviterUserId
      );
      
      if (existingFriendship) {
        console.log('🧇 Invite Service: Already connected to inviter');
        await this.clearPendingInvite();
        return false;
      }

      // Create friend connection
      const success = await this.createFriendConnection(
        currentUserId, 
        pendingInvite.inviterUserId
      );

      if (success) {
        // Mark as processed and store in processed invites
        await this.markInviteAsProcessed(pendingInvite);
        await this.clearPendingInvite();
        
        const inviteType = pendingInvite.deferred ? 'deferred' : 'direct';
        console.log(`🧇 Invite Service: Successfully processed ${inviteType} invite`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('🧇 Invite Service: Error processing pending invite:', error);
      return false;
    }
  }

  /**
   * Check if users are already connected
   */
  private async checkExistingConnection(userId1: string, userId2: string): Promise<boolean> {
    try {
      // Check if there's already a chat between these users
      const existingChats = await firestoreService.getUserChats(userId1);
      return existingChats.some(chat => 
        chat.members.includes(userId2)
      );
    } catch (error) {
      console.error('🧇 Invite Service: Error checking existing connection:', error);
      return false;
    }
  }

  /**
   * Create a friend connection (via chat creation)
   */
  private async createFriendConnection(currentUserId: string, inviterUserId: string): Promise<boolean> {
    try {
      // Create a chat between the users to establish the connection
      const chatId = await firestoreService.createChat([currentUserId, inviterUserId]);
      
      if (chatId) {
        console.log('🧇 Invite Service: Created chat connection:', chatId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('🧇 Invite Service: Error creating friend connection:', error);
      return false;
    }
  }

  /**
   * Mark invite as processed and store in history
   */
  private async markInviteAsProcessed(invite: PendingInvite): Promise<void> {
    try {
      const processedInvite = {
        ...invite,
        processed: true,
        processedAt: Date.now(),
      };

      // Store in processed invites history
      const existingProcessed = await AsyncStorage.getItem(InviteService.PROCESSED_INVITES_KEY);
      const processedList = existingProcessed ? JSON.parse(existingProcessed) : [];
      processedList.push(processedInvite);

      // Keep only last 10 processed invites
      if (processedList.length > 10) {
        processedList.splice(0, processedList.length - 10);
      }

      await AsyncStorage.setItem(InviteService.PROCESSED_INVITES_KEY, JSON.stringify(processedList));
    } catch (error) {
      console.error('🧇 Invite Service: Error marking invite as processed:', error);
    }
  }

  /**
   * Clear pending invite
   */
  async clearPendingInvite(): Promise<void> {
    try {
      await AsyncStorage.removeItem(InviteService.PENDING_INVITE_KEY);
      console.log('🧇 Invite Service: Cleared pending invite');
    } catch (error) {
      console.error('🧇 Invite Service: Error clearing pending invite:', error);
    }
  }

  /**
   * Get invite statistics for analytics
   */
  async getInviteStats(): Promise<{ pendingCount: number; processedCount: number }> {
    try {
      const pending = await this.getPendingInvite();
      const processed = await AsyncStorage.getItem(InviteService.PROCESSED_INVITES_KEY);
      const processedList = processed ? JSON.parse(processed) : [];

      return {
        pendingCount: pending ? 1 : 0,
        processedCount: processedList.length,
      };
    } catch (error) {
      console.error('🧇 Invite Service: Error getting invite stats:', error);
      return { pendingCount: 0, processedCount: 0 };
    }
  }
}

// Export singleton instance
export const inviteService = InviteService.getInstance(); 