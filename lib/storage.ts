import storage from '@react-native-firebase/storage';
import { firestoreService } from './firestore';
import { thumbnailService, ThumbnailGenerationResult } from './thumbnailGeneration';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number; // 0-100
}

export interface VideoUploadResult {
  downloadURL: string;
  videoId: string;
  thumbnailURL?: string;
}

export interface UploadVideoParams {
  chatId: string;
  senderId: string;
  recipientId: string;
  localVideoPath: string;
  duration: number;
  onProgress?: (progress: UploadProgress) => void;
}

export class StorageService {
  private static instance: StorageService;
  
  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Generate secure storage paths
  private generateVideoPath(chatId: string, videoId: string): string {
    return `chats/${chatId}/videos/${videoId}.mp4`;
  }

  private generateThumbnailPath(chatId: string, videoId: string): string {
    return `chats/${chatId}/thumbnails/${videoId}.gif`;
  }

  // Upload video with progress tracking and thumbnail generation
  async uploadVideo(params: UploadVideoParams): Promise<VideoUploadResult> {
    const { chatId, senderId, recipientId, localVideoPath, duration, onProgress } = params;
    
    try {
      // Generate unique video ID
      const videoId = this.generateVideoId();
      
      console.log('🧇 Starting video upload with thumbnail generation for video:', videoId);
      
      // Step 1: Generate thumbnail (30% of progress)
      let thumbnailResult: ThumbnailGenerationResult | null = null;
      try {
        console.log('🧇 Generating thumbnail...');
        onProgress?.({ bytesTransferred: 0, totalBytes: 100, progress: 10 });
        
        thumbnailResult = await thumbnailService.generateAndUploadThumbnail(
          localVideoPath,
          chatId,
          videoId,
          thumbnailService.getOptimizedOptions('timeline')
        );
        
        console.log('🧇 Thumbnail generated and uploaded:', thumbnailResult.downloadURL);
        onProgress?.({ bytesTransferred: 30, totalBytes: 100, progress: 30 });
      } catch (thumbnailError) {
        console.warn('🧇 Thumbnail generation failed, continuing without thumbnail:', thumbnailError);
        onProgress?.({ bytesTransferred: 30, totalBytes: 100, progress: 30 });
      }
      
      // Step 2: Upload video (70% of remaining progress)
      const videoPath = this.generateVideoPath(chatId, videoId);
      const videoRef = storage().ref(videoPath);
      
      console.log('🧇 Uploading video to:', videoPath);
      const uploadTask = videoRef.putFile(localVideoPath);
      
      // Track video upload progress (from 30% to 100%)
      if (onProgress) {
        uploadTask.on('state_changed', (snapshot) => {
          const videoProgress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          const totalProgress = 30 + Math.round(videoProgress * 0.7); // Scale to 30-100%
          
          const progress: UploadProgress = {
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress: totalProgress,
          };
          onProgress(progress);
        });
      }
      
      // Wait for video upload completion
      await uploadTask;
      
      // Get video download URL
      const downloadURL = await videoRef.getDownloadURL();
      
      console.log('🧇 Video uploaded successfully:', downloadURL);
      
      // Step 3: Create video document in Firestore with thumbnail URL
      await firestoreService.createVideo({
        chatId,
        senderId,
        recipientId,
        videoUrl: downloadURL,
        thumbnailUrl: thumbnailResult?.downloadURL,
        duration,
      });
      
      console.log('🧇 Video document created in Firestore with thumbnail URL');
      
      return {
        downloadURL,
        videoId,
        thumbnailURL: thumbnailResult?.downloadURL,
      };
      
    } catch (error) {
      console.error('🧇 Video upload failed:', error);
      throw new Error(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Upload thumbnail (for future GIF feature)
  async uploadThumbnail(chatId: string, videoId: string, thumbnailPath: string): Promise<string> {
    try {
      const thumbnailStoragePath = this.generateThumbnailPath(chatId, videoId);
      const thumbnailRef = storage().ref(thumbnailStoragePath);
      
      await thumbnailRef.putFile(thumbnailPath);
      return await thumbnailRef.getDownloadURL();
      
    } catch (error) {
      console.error('Thumbnail upload failed:', error);
      throw new Error(`Thumbnail upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Download video for offline viewing
  async downloadVideo(downloadURL: string, localPath: string, onProgress?: (progress: UploadProgress) => void): Promise<void> {
    try {
      const reference = storage().refFromURL(downloadURL);
      const downloadTask = reference.writeToFile(localPath);
      
      if (onProgress) {
        downloadTask.on('state_changed', (snapshot) => {
          const progress: UploadProgress = {
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          };
          onProgress(progress);
        });
      }
      
      await downloadTask;
      
    } catch (error) {
      console.error('Video download failed:', error);
      throw new Error(`Video download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete video (for expired videos cleanup)
  async deleteVideo(chatId: string, videoId: string): Promise<void> {
    try {
      const videoPath = this.generateVideoPath(chatId, videoId);
      const thumbnailPath = this.generateThumbnailPath(chatId, videoId);
      
      // Delete video file
      await storage().ref(videoPath).delete();
      
      // Delete thumbnail if exists (ignore errors if it doesn't exist)
      try {
        await storage().ref(thumbnailPath).delete();
      } catch {
        // Thumbnail might not exist, continue
      }
      
    } catch (error) {
      console.error('Video deletion failed:', error);
      throw new Error(`Video deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get video metadata
  async getVideoMetadata(downloadURL: string): Promise<any> {
    try {
      const reference = storage().refFromURL(downloadURL);
      return await reference.getMetadata();
    } catch (error) {
      console.error('Failed to get video metadata:', error);
      return null;
    }
  }

  // Helper to generate unique video IDs
  private generateVideoId(): string {
    return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Check storage quota and usage
  async getStorageUsage(): Promise<{ used: number; available: number } | null> {
    try {
      // This would require Firebase Admin SDK or Cloud Functions
      // For now, return null - implement in Cloud Functions if needed
      return null;
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return null;
    }
  }

  // Batch delete expired videos (to be called by Cloud Functions)
  async deleteExpiredVideos(chatId: string, expiredVideoIds: string[]): Promise<void> {
    try {
      const deletePromises = expiredVideoIds.map(videoId => 
        this.deleteVideo(chatId, videoId)
      );
      
      await Promise.allSettled(deletePromises);
      
    } catch (error) {
      console.error('Batch video deletion failed:', error);
      throw error;
    }
  }

  // Test Firebase Storage connection
  async testStorageConnection(): Promise<boolean> {
    try {
      // Simple test - try to get the root reference
      const rootRef = storage().ref();
      await rootRef.listAll();
      console.log('🧇 Firebase Storage connection test: SUCCESS');
      return true;
    } catch (error) {
      console.error('🧇 Firebase Storage connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();

// Helper functions for common operations
export const uploadVideoToChat = async (params: UploadVideoParams): Promise<VideoUploadResult> => {
  return storageService.uploadVideo(params);
};

export const downloadVideoFromURL = async (
  downloadURL: string, 
  localPath: string, 
  onProgress?: (progress: UploadProgress) => void
): Promise<void> => {
  return storageService.downloadVideo(downloadURL, localPath, onProgress);
};

// Storage path utilities
export const getVideoDirPath = (chatId: string): string => {
  return `chats/${chatId}/videos/`;
};

export const getThumbnailDirPath = (chatId: string): string => {
  return `chats/${chatId}/thumbnails/`;
}; 