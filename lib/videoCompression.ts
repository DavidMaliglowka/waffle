import { Video } from 'react-native-compressor';

export interface CompressionOptions {
  compressionMethod?: 'auto' | 'manual';
  quality?: 'low' | 'medium' | 'high';
  bitrate?: number;
  fps?: number;
  minimumFileSizeForCompress?: number; // in bytes
}

export interface CompressionResult {
  uri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number; // compression time in ms
}

export class VideoCompressionService {
  private static instance: VideoCompressionService;
  
  static getInstance(): VideoCompressionService {
    if (!VideoCompressionService.instance) {
      VideoCompressionService.instance = new VideoCompressionService();
    }
    return VideoCompressionService.instance;
  }

  /**
   * Compress a video file using react-native-compressor
   * Optimized for Waffle's requirements: 720p quality, targeting 10-15MB per 5-minute video
   */
  async compressVideo(
    videoUri: string, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🧇 Starting video compression:', videoUri);
      
      // Get original file size
      const originalSize = await this.getFileSize(videoUri);
      console.log('🧇 Original file size:', this.formatFileSize(originalSize));
      
      // Check if compression is needed
      const minSizeForCompression = options.minimumFileSizeForCompress || 5 * 1024 * 1024; // 5MB default
      if (originalSize < minSizeForCompression) {
        console.log('🧇 File size below compression threshold, skipping compression');
        return {
          uri: videoUri,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          duration: Date.now() - startTime,
        };
      }

      // Configure compression options for Waffle's requirements
      const compressionConfig = {
        compressionMethod: options.compressionMethod || 'auto',
        quality: options.quality || 'medium',
        // Additional options for better control
        ...(options.bitrate && { bitrate: options.bitrate }),
        ...(options.fps && { fps: options.fps }),
      };

      console.log('🧇 Compression config:', compressionConfig);

      // Perform compression
      const compressedVideoUri = await Video.compress(videoUri, compressionConfig);
      
      // Get compressed file size
      const compressedSize = await this.getFileSize(compressedVideoUri);
      const compressionRatio = originalSize / compressedSize;
      const duration = Date.now() - startTime;

      console.log('🧇 Compression complete!');
      console.log('🧇 Original size:', this.formatFileSize(originalSize));
      console.log('🧇 Compressed size:', this.formatFileSize(compressedSize));
      console.log('🧇 Compression ratio:', compressionRatio.toFixed(2) + 'x');
      console.log('🧇 Compression time:', duration + 'ms');

      return {
        uri: compressedVideoUri,
        originalSize,
        compressedSize,
        compressionRatio,
        duration,
      };

    } catch (error) {
      console.error('🧇 Video compression failed:', error);
      throw new Error(`Video compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get optimized compression settings based on video duration
   * Targets 10-15MB for 5-minute videos (2-3MB per minute)
   */
  getOptimizedSettings(estimatedDurationSeconds: number): CompressionOptions {
    const targetMBPerMinute = 2.5; // Sweet spot for quality vs size
    const durationMinutes = estimatedDurationSeconds / 60;
    const targetTotalMB = targetMBPerMinute * durationMinutes;
    
    // Calculate target bitrate (rough estimation)
    const targetBitrate = Math.round((targetTotalMB * 8 * 1024) / (estimatedDurationSeconds / 1000)); // kbps
    
    // Adjust quality based on duration
    let quality: 'low' | 'medium' | 'high' = 'medium';
    if (estimatedDurationSeconds > 240) { // > 4 minutes
      quality = 'medium'; // Prioritize smaller file size
    } else if (estimatedDurationSeconds < 60) { // < 1 minute
      quality = 'high'; // Can afford higher quality for short videos
    }

    return {
      compressionMethod: 'auto',
      quality,
      bitrate: Math.min(Math.max(targetBitrate, 500), 2500), // Clamp between 500kbps and 2.5Mbps
      fps: 30, // Standard frame rate
      minimumFileSizeForCompress: 3 * 1024 * 1024, // 3MB threshold
    };
  }

  /**
   * Quick compression for immediate feedback
   * Uses aggressive settings for fastest processing
   */
  async quickCompress(videoUri: string): Promise<CompressionResult> {
    return this.compressVideo(videoUri, {
      compressionMethod: 'auto',
      quality: 'low',
      fps: 24, // Slightly lower fps for faster processing
      minimumFileSizeForCompress: 1 * 1024 * 1024, // 1MB threshold
    });
  }

  /**
   * High-quality compression for final upload
   * Balances quality and file size for optimal user experience
   */
  async highQualityCompress(videoUri: string, durationSeconds: number): Promise<CompressionResult> {
    const optimizedSettings = this.getOptimizedSettings(durationSeconds);
    return this.compressVideo(videoUri, optimizedSettings);
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(uri: string): Promise<number> {
    try {
      // For React Native, we'll use a simple approach
      // In a real implementation, you might use react-native-fs or similar
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      console.warn('🧇 Could not determine file size:', error);
      return 0;
    }
  }

  /**
   * Format file size for human-readable display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Estimate compression time based on file size
   * Useful for showing progress indicators
   */
  estimateCompressionTime(fileSizeBytes: number): number {
    // Rough estimation: ~1 second per MB on modern mobile devices
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    return Math.max(fileSizeMB * 1000, 2000); // Minimum 2 seconds
  }

  /**
   * Check if compression is beneficial for the given file
   */
  shouldCompress(fileSizeBytes: number, durationSeconds: number): boolean {
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    const durationMinutes = durationSeconds / 60;
    const mbPerMinute = fileSizeMB / durationMinutes;
    
    // Compress if file is larger than 3MB per minute
    return mbPerMinute > 3;
  }
}

// Export singleton instance
export const videoCompressionService = VideoCompressionService.getInstance();

// Export convenient functions
export const compressVideoForUpload = async (
  videoUri: string, 
  durationSeconds: number
): Promise<CompressionResult> => {
  return videoCompressionService.highQualityCompress(videoUri, durationSeconds);
};

export const quickCompressVideo = async (videoUri: string): Promise<CompressionResult> => {
  return videoCompressionService.quickCompress(videoUri);
}; 