import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

// Type definitions based on PRD requirements
export interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  email?: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface Chat {
  id: string;
  members: string[]; // Array of user UIDs (always 2 for 1-to-1 chats in MVP)
  lastUpdated: FirebaseFirestoreTypes.Timestamp;
  streakCount: number;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  lastVideoId?: string; // Reference to the most recent video
}

export interface Video {
  id: string;
  chatId: string;
  senderId: string; // UID of user who sent the video
  recipientId: string; // UID of user who should receive the video
  videoUrl: string; // Firebase Storage URL
  thumbnailUrl?: string; // GIF thumbnail URL (Phase 2)
  duration: number; // Video duration in seconds
  isExpired: boolean; // Set to true after 7 days if no reply
  expiresAt: FirebaseFirestoreTypes.Timestamp; // 7 days from creation
  createdAt: FirebaseFirestoreTypes.Timestamp;
  transcription?: string; // For RAG features
  replyToVideoId?: string; // For threading replies
}

// Firestore service class
export class FirestoreService {
  private static instance: FirestoreService;
  
  static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  // User operations
  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = firestore.Timestamp.now();
    await firestore()
      .collection('users')
      .doc(user.uid)
      .set({
        ...user,
        createdAt: now,
        updatedAt: now,
      });
  }

  async getUser(uid: string): Promise<User | null> {
    const doc = await firestore().collection('users').doc(uid).get();
    return doc.exists ? (doc.data() as User) : null;
  }

  async updateUser(uid: string, updates: Partial<Omit<User, 'uid' | 'createdAt'>>): Promise<void> {
    await firestore()
      .collection('users')
      .doc(uid)
      .update({
        ...updates,
        updatedAt: firestore.Timestamp.now(),
      });
  }

  // Chat operations with Cloud Function integration
  async createChatViaCloudFunction(userId1: string, userId2: string): Promise<{ chatId: string; isNew: boolean }> {
    try {
      const createChatFunction = functions().httpsCallable('createChat');
      const result = await createChatFunction({ userId1, userId2 });
      
      return {
        chatId: result.data.chatId,
        isNew: result.data.isNew,
      };
    } catch (error) {
      console.error('🧇 Error calling createChat Cloud Function:', error);
      throw new Error('Failed to create chat via Cloud Function');
    }
  }

  // Fallback direct chat creation (for development/testing)
  async createChat(memberIds: [string, string]): Promise<string> {
    const now = firestore.Timestamp.now();
    const chatRef = firestore().collection('chats').doc();
    
    const chat: Omit<Chat, 'id'> = {
      members: memberIds,
      lastUpdated: now,
      streakCount: 0,
      createdAt: now,
    };

    await chatRef.set(chat);
    return chatRef.id;
  }

  // Enhanced find or create chat using Cloud Function
  async findOrCreateChatSecure(userId1: string, userId2: string): Promise<string> {
    try {
      const result = await this.createChatViaCloudFunction(userId1, userId2);
      return result.chatId;
    } catch (error) {
      console.error('🧇 Cloud Function failed, falling back to direct creation:', error);
      
      // Fallback to direct method
      const existingChats = await this.getUserChats(userId1);
      const existingChat = existingChats.find(chat => 
        chat.members.includes(userId2) && chat.members.length === 2
      );

      if (existingChat) {
        return existingChat.id;
      }

      return this.createChat([userId1, userId2]);
    }
  }

  async getChat(chatId: string): Promise<Chat | null> {
    const doc = await firestore().collection('chats').doc(chatId).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as Chat) : null;
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    const snapshot = await firestore()
      .collection('chats')
      .where('members', 'array-contains', userId)
      .orderBy('lastUpdated', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Chat[];
  }

  async updateChatStreak(chatId: string, increment: boolean = true): Promise<void> {
    const chatRef = firestore().collection('chats').doc(chatId);
    
    await firestore().runTransaction(async (transaction) => {
      const chatDoc = await transaction.get(chatRef);
      if (!chatDoc.exists) throw new Error('Chat not found');
      
      const currentStreak = chatDoc.data()?.streakCount || 0;
      const newStreak = increment ? currentStreak + 1 : 0;
      
      transaction.update(chatRef, {
        streakCount: newStreak,
        lastUpdated: firestore.Timestamp.now(),
      });
    });
  }

  // Video operations
  async createVideo(video: Omit<Video, 'id' | 'createdAt' | 'expiresAt' | 'isExpired'>): Promise<string> {
    const now = firestore.Timestamp.now();
    const expiresAt = firestore.Timestamp.fromMillis(now.toMillis() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    const videoRef = firestore()
      .collection('chats')
      .doc(video.chatId)
      .collection('videos')
      .doc();

    const fullVideo: Omit<Video, 'id'> = {
      ...video,
      isExpired: false,
      createdAt: now,
      expiresAt,
    };

    await videoRef.set(fullVideo);

    // Update chat's lastVideoId and lastUpdated
    await firestore()
      .collection('chats')
      .doc(video.chatId)
      .update({
        lastVideoId: videoRef.id,
        lastUpdated: now,
      });

    return videoRef.id;
  }

  async getVideo(chatId: string, videoId: string): Promise<Video | null> {
    const doc = await firestore()
      .collection('chats')
      .doc(chatId)
      .collection('videos')
      .doc(videoId)
      .get();

    return doc.exists ? ({ id: doc.id, ...doc.data() } as Video) : null;
  }

  async getChatVideos(chatId: string, limit: number = 20): Promise<Video[]> {
    const snapshot = await firestore()
      .collection('chats')
      .doc(chatId)
      .collection('videos')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Video[];
  }

  async markVideoExpired(chatId: string, videoId: string): Promise<void> {
    await firestore()
      .collection('chats')
      .doc(chatId)
      .collection('videos')
      .doc(videoId)
      .update({
        isExpired: true,
      });

    // Reset chat streak when video expires
    await this.updateChatStreak(chatId, false);
  }

  // Real-time subscriptions
  subscribeToUserChats(userId: string, callback: (chats: Chat[]) => void): () => void {
    return firestore()
      .collection('chats')
      .where('members', 'array-contains', userId)
      .orderBy('lastUpdated', 'desc')
      .onSnapshot((snapshot) => {
        const chats = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Chat[];
        callback(chats);
      });
  }

  subscribeToChatVideos(chatId: string, callback: (videos: Video[]) => void): () => void {
    return firestore()
      .collection('chats')
      .doc(chatId)
      .collection('videos')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const videos = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Video[];
        callback(videos);
      });
  }
}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();

// Helper functions for common operations
export const createUserProfile = async (user: Omit<User, 'createdAt' | 'updatedAt'>) => {
  return firestoreService.createUser(user);
};

export const findOrCreateChat = async (userId1: string, userId2: string): Promise<string> => {
  // Check if chat already exists between these users
  const existingChats = await firestoreService.getUserChats(userId1);
  const existingChat = existingChats.find(chat => 
    chat.members.includes(userId2) && chat.members.length === 2
  );

  if (existingChat) {
    return existingChat.id;
  }

  // Create new chat
  return firestoreService.createChat([userId1, userId2]);
}; 