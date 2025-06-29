import { getThumbnailAsync, VideoThumbnailsOptions } from 'expo-video-thumbnails';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';

export interface ThumbnailGenerationResult {
  localUri: string;
  downloadURL: string;
  width: number;
  height: number;
  size: number; // file size in bytes
}

export interface ThumbnailOptions {
  quality?: number; // 0-1, default 0.7
  time?: number; // Time in seconds to extract thumbnail from, default 1
  width?: number; // Max width, default 200
  height?: number; // Max height, default 200
}

export class ThumbnailGenerationService {
  private static instance: ThumbnailGenerationService | null = null;

  static getInstance(): ThumbnailGenerationService {
    if (!ThumbnailGenerationService.instance) {
      ThumbnailGenerationService.instance = new ThumbnailGenerationService();
    }
    return ThumbnailGenerationService.instance;
  }

  /**
   * Generate a thumbnail for a video and upload it to Firebase Storage
   * @param videoUri Local video file URI
   * @param chatId Chat ID for storage path
   * @param videoId Unique video ID
   * @param options Thumbnail generation options
   * @returns ThumbnailGenerationResult with local and remote URIs
   */
  async generateAndUploadThumbnail(
    videoUri: string,
    chatId: string,
    videoId: string,
    options: ThumbnailOptions = {}
  ): Promise<ThumbnailGenerationResult> {
    try {
      console.log('🧇 Starting thumbnail generation for video:', videoId);

      // Generate thumbnail locally
      const thumbnailResult = await this.generateThumbnail(videoUri, options);
      
      console.log('🧇 Thumbnail generated locally:', thumbnailResult.uri);

      // Upload thumbnail to Firebase Storage
      const downloadURL = await this.uploadThumbnail(
        thumbnailResult.uri,
        chatId,
        videoId
      );

      console.log('🧇 Thumbnail uploaded to Firebase:', downloadURL);

      return {
        localUri: thumbnailResult.uri,
        downloadURL,
        width: thumbnailResult.width,
        height: thumbnailResult.height,
        size: 0, // We'll estimate this
      };

    } catch (error) {
      console.error('🧇 Thumbnail generation failed:', error);
      throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate thumbnail locally using expo-video-thumbnails
   */
  private async generateThumbnail(
    videoUri: string,
    options: ThumbnailOptions = {}
  ) {
    const thumbnailOptions: VideoThumbnailsOptions = {
      time: options.time || 1000, // 1 second by default (in milliseconds)
      quality: options.quality || 0.7,
      ...(Platform.OS === 'ios' && {
        // iOS specific options
        headers: {},
      }),
    };

    // Add size constraints if specified
    if (options.width || options.height) {
      thumbnailOptions.quality = options.quality || 0.8; // Higher quality for resized images
    }

    console.log('🧇 Generating thumbnail with options:', thumbnailOptions);

    const thumbnailResult = await getThumbnailAsync(videoUri, thumbnailOptions);

    return thumbnailResult;
  }

  /**
   * Upload thumbnail to Firebase Storage
   */
  private async uploadThumbnail(
    thumbnailUri: string,
    chatId: string,
    videoId: string
  ): Promise<string> {
    try {
      // Create storage reference for thumbnail
      const thumbnailPath = this.generateThumbnailPath(chatId, videoId);
      const thumbnailRef = storage().ref(thumbnailPath);

      console.log('🧇 Uploading thumbnail to path:', thumbnailPath);

      // Upload the thumbnail
      const uploadTask = thumbnailRef.putFile(thumbnailUri);
      
      // Wait for upload completion
      await uploadTask;

      // Get download URL
      const downloadURL = await thumbnailRef.getDownloadURL();
      
      return downloadURL;

    } catch (error) {
      console.error('🧇 Thumbnail upload failed:', error);
      throw new Error(`Thumbnail upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate storage path for thumbnail
   */
  private generateThumbnailPath(chatId: string, videoId: string): string {
    return `chats/${chatId}/thumbnails/${videoId}_thumbnail.jpg`;
  }

  /**
   * Download thumbnail for caching
   */
  async downloadThumbnail(downloadURL: string, localPath: string): Promise<void> {
    try {
      const reference = storage().refFromURL(downloadURL);
      await reference.writeToFile(localPath);
    } catch (error) {
      console.error('🧇 Thumbnail download failed:', error);
      throw new Error(`Thumbnail download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete thumbnail from Firebase Storage
   */
  async deleteThumbnail(chatId: string, videoId: string): Promise<void> {
    try {
      const thumbnailPath = this.generateThumbnailPath(chatId, videoId);
      const thumbnailRef = storage().ref(thumbnailPath);
      await thumbnailRef.delete();
      console.log('🧇 Thumbnail deleted:', thumbnailPath);
    } catch (error) {
      console.error('🧇 Thumbnail deletion failed:', error);
      // Don't throw error for deletion failures as it's not critical
    }
  }

  /**
   * Generate multiple thumbnails at different time points
   */
  async generateMultipleThumbnails(
    videoUri: string,
    chatId: string,
    videoId: string,
    timePoints: number[] = [1, 3, 5], // seconds
    options: Omit<ThumbnailOptions, 'time'> = {}
  ): Promise<ThumbnailGenerationResult[]> {
    const results: ThumbnailGenerationResult[] = [];

    for (let i = 0; i < timePoints.length; i++) {
      const timePoint = timePoints[i];
      try {
        const result = await this.generateAndUploadThumbnail(
          videoUri,
          chatId,
          `${videoId}_${i}`,
          { ...options, time: timePoint }
        );
        results.push(result);
      } catch (error) {
        console.warn(`🧇 Failed to generate thumbnail at ${timePoint}s:`, error);
        // Continue with other time points
      }
    }

    return results;
  }

  /**
   * Get optimized thumbnail options based on use case
   */
  getOptimizedOptions(useCase: 'timeline' | 'preview' | 'detail'): ThumbnailOptions {
    switch (useCase) {
      case 'timeline':
        return {
          width: 120,
          height: 150, // 4:5 aspect ratio to match our timeline design
          quality: 0.6,
          time: 1,
        };
      case 'preview':
        return {
          width: 300,
          height: 400,
          quality: 0.8,
          time: 2,
        };
      case 'detail':
        return {
          width: 600,
          height: 800,
          quality: 0.9,
          time: 1,
        };
      default:
        return {
          width: 200,
          height: 250,
          quality: 0.7,
          time: 1,
        };
    }
  }
}

// Export singleton instance
export const thumbnailService = ThumbnailGenerationService.getInstance();

// Export convenient functions
export const generateVideoThumbnail = async (
  videoUri: string,
  chatId: string,
  videoId: string,
  options?: ThumbnailOptions
): Promise<ThumbnailGenerationResult> => {
  return thumbnailService.generateAndUploadThumbnail(videoUri, chatId, videoId, options);
};

export const generateTimelineThumbnail = async (
  videoUri: string,
  chatId: string,
  videoId: string
): Promise<ThumbnailGenerationResult> => {
  const options = thumbnailService.getOptimizedOptions('timeline');
  return thumbnailService.generateAndUploadThumbnail(videoUri, chatId, videoId, options);
}; 