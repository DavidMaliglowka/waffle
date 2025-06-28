// Network info will be added later when package compatibility is resolved
// import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  COMPRESSION_ERROR = 'COMPRESSION_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  QUOTA_ERROR = 'QUOTA_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface VideoUploadError {
  type: ErrorType;
  message: string;
  originalError?: any;
  isRetryable: boolean;
  suggestedAction: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
}

export interface NetworkInfo {
  isConnected: boolean;
  type: string | null;
  isWifiEnabled: boolean;
  strength?: number;
}

export class VideoUploadErrorHandler {
  private static instance: VideoUploadErrorHandler;
  private retryCount: Map<string, number> = new Map();
  
  static getInstance(): VideoUploadErrorHandler {
    if (!VideoUploadErrorHandler.instance) {
      VideoUploadErrorHandler.instance = new VideoUploadErrorHandler();
    }
    return VideoUploadErrorHandler.instance;
  }

  // Default retry configuration
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffFactor: 2
  };

  // Check network connectivity
  async checkNetworkConnectivity(): Promise<NetworkInfo> {
    try {
      // TODO: Re-implement with compatible network detection library
      // const netInfo = await NetInfo.fetch();
      return {
        isConnected: true, // Assume connected until network detection is re-implemented
        type: 'unknown',
        isWifiEnabled: false,
        strength: undefined
      };
    } catch (error) {
      console.error('🧇 Network check failed:', error);
      return {
        isConnected: false,
        type: null,
        isWifiEnabled: false
      };
    }
  }

  // Categorize and format error
  categorizeError(error: any): VideoUploadError {
    console.log('🧇 Categorizing error:', error);

    // Network-related errors
    if (error?.code === 'storage/network-error' || error?.message?.includes('network')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network connection issue detected',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Check your internet connection and try again'
      };
    }

    // Firebase Storage specific errors
    if (error?.code === 'storage/unauthorized') {
      return {
        type: ErrorType.PERMISSION_ERROR,
        message: 'Upload permission denied',
        originalError: error,
        isRetryable: false,
        suggestedAction: 'Sign out and sign back in to refresh permissions'
      };
    }

    if (error?.code === 'storage/quota-exceeded') {
      return {
        type: ErrorType.QUOTA_ERROR,
        message: 'Storage quota exceeded',
        originalError: error,
        isRetryable: false,
        suggestedAction: 'Storage space is full. Contact support for assistance'
      };
    }

    if (error?.code === 'storage/retry-limit-exceeded') {
      return {
        type: ErrorType.UPLOAD_ERROR,
        message: 'Upload failed after multiple attempts',
        originalError: error,
        isRetryable: false,
        suggestedAction: 'Try again later or use a different network connection'
      };
    }

    if (error?.code === 'storage/canceled') {
      return {
        type: ErrorType.UPLOAD_ERROR,
        message: 'Upload was canceled',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Try uploading again'
      };
    }

    // File-related errors
    if (error?.message?.includes('file') || error?.message?.includes('compress')) {
      return {
        type: ErrorType.FILE_ERROR,
        message: 'Video file processing failed',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Try recording the video again'
      };
    }

    // Timeout errors
    if (error?.message?.includes('timeout') || error?.code === 'TIMEOUT') {
      return {
        type: ErrorType.TIMEOUT_ERROR,
        message: 'Upload timed out',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Check your internet speed and try again'
      };
    }

    // Compression errors
    if (error?.message?.includes('compression')) {
      return {
        type: ErrorType.COMPRESSION_ERROR,
        message: 'Video compression failed',
        originalError: error,
        isRetryable: true,
        suggestedAction: 'Try recording a shorter video'
      };
    }

    // Default unknown error
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error?.message || 'An unexpected error occurred',
      originalError: error,
      isRetryable: true,
      suggestedAction: 'Try again or restart the app'
    };
  }

  // Calculate retry delay with exponential backoff
  calculateRetryDelay(attemptNumber: number, config: RetryConfig = this.defaultRetryConfig): number {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffFactor, attemptNumber - 1),
      config.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.round(delay + jitter);
  }

  // Execute function with retry logic
  async withRetry<T>(
    operation: () => Promise<T>,
    operationId: string,
    config: RetryConfig = this.defaultRetryConfig,
    onRetry?: (attempt: number, error: VideoUploadError) => void
  ): Promise<T> {
    let lastError: VideoUploadError | null = null;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Reset retry count on success
        if (attempt > 1) {
          this.retryCount.delete(operationId);
        }
        
        return await operation();
        
      } catch (error) {
        lastError = this.categorizeError(error);
        
        console.log(`🧇 Attempt ${attempt}/${config.maxAttempts} failed:`, lastError.message);
        
        // Don't retry if error is not retryable or we've exhausted attempts
        if (!lastError.isRetryable || attempt >= config.maxAttempts) {
          break;
        }
        
        // Update retry count
        this.retryCount.set(operationId, attempt);
        
        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        // Wait before retrying
        const delay = this.calculateRetryDelay(attempt, config);
        console.log(`🧇 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All attempts failed
    throw lastError || new Error('Operation failed after all retry attempts');
  }

  // Check if file size is reasonable for upload
  validateFileSize(fileSizeBytes: number, maxSizeMB: number = 100): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSizeBytes <= maxSizeBytes;
  }

  // Check available storage space (approximate)
  async checkStorageSpace(requiredBytes: number): Promise<boolean> {
    try {
      // This is a simplified check - in production you might want to use
      // react-native-fs or similar to get actual device storage info
      return true; // For now, assume storage is available
    } catch (error) {
      console.warn('🧇 Storage space check failed:', error);
      return true; // Default to allowing upload
    }
  }

  // Show user-friendly error dialog with action options
  showErrorDialog(
    error: VideoUploadError,
    onRetry?: () => void,
    onCancel?: () => void,
    onAlternativeAction?: () => void
  ): void {
    const buttons: any[] = [];
    
    // Add retry button if error is retryable
    if (error.isRetryable && onRetry) {
      buttons.push({
        text: 'Try Again',
        onPress: onRetry,
        style: 'default'
      });
    }
    
    // Add alternative action if available
    if (onAlternativeAction) {
      let actionText = 'Alternative';
      
      switch (error.type) {
        case ErrorType.NETWORK_ERROR:
          actionText = 'Check Network';
          break;
        case ErrorType.FILE_ERROR:
          actionText = 'Record Again';
          break;
        case ErrorType.COMPRESSION_ERROR:
          actionText = 'Skip Compression';
          break;
        default:
          actionText = 'More Options';
      }
      
      buttons.push({
        text: actionText,
        onPress: onAlternativeAction
      });
    }
    
    // Add cancel button
    buttons.push({
      text: 'Cancel',
      onPress: onCancel,
      style: 'cancel'
    });

    Alert.alert(
      this.getErrorTitle(error.type),
      `${error.message}\n\n${error.suggestedAction}`,
      buttons
    );
  }

  // Get user-friendly error title
  private getErrorTitle(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return 'Connection Issue';
      case ErrorType.STORAGE_ERROR:
        return 'Storage Error';
      case ErrorType.PERMISSION_ERROR:
        return 'Permission Required';
      case ErrorType.FILE_ERROR:
        return 'Video File Issue';
      case ErrorType.COMPRESSION_ERROR:
        return 'Compression Failed';
      case ErrorType.UPLOAD_ERROR:
        return 'Upload Failed';
      case ErrorType.TIMEOUT_ERROR:
        return 'Upload Timed Out';
      case ErrorType.QUOTA_ERROR:
        return 'Storage Full';
      default:
        return 'Upload Error';
    }
  }

  // Get current retry count for an operation
  getRetryCount(operationId: string): number {
    return this.retryCount.get(operationId) || 0;
  }

  // Reset retry count for an operation
  resetRetryCount(operationId: string): void {
    this.retryCount.delete(operationId);
  }

  // Check if we should show network warning
  shouldShowNetworkWarning(networkInfo: NetworkInfo): boolean {
    return !networkInfo.isConnected || 
           (networkInfo.type === 'cellular' && !networkInfo.isWifiEnabled);
  }

  // Get network warning message
  getNetworkWarningMessage(networkInfo: NetworkInfo): string {
    if (!networkInfo.isConnected) {
      return 'No internet connection detected. Videos require internet to upload.';
    }
    
    if (networkInfo.type === 'cellular') {
      return 'You\'re using cellular data. Video uploads may use significant data and take longer.';
    }
    
    return '';
  }
}

// Export singleton instance
export const videoUploadErrorHandler = VideoUploadErrorHandler.getInstance(); 