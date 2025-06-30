import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Camera, useCameraDevices, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { Video, ResizeMode } from 'expo-av';
import { Button } from '@/components/ui/Button';
import { compressVideoForUpload } from '@/lib/videoCompression';
import { uploadVideoToChat, UploadProgress } from '@/lib/storage';
import { videoUploadErrorHandler, ErrorType, VideoUploadError } from '@/lib/videoUploadErrorHandler';
interface RecordingState {
  isRecording: boolean;
  duration: number;
  isProcessing: boolean;
  compressionProgress: number;
  isUploading: boolean;
  uploadProgress: number;
  recordedVideoPath: string | null;
  showReplay: boolean;
}

interface InlineCameraRecorderProps {
  chatId: string;
  userId: string; // Pass authenticated user ID from parent
  onVideoSent?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

const InlineCameraRecorder: React.FC<InlineCameraRecorderProps> = ({
  chatId,
  userId,
  onVideoSent,
  onError,
  className = ''
}) => {
  const cameraRef = useRef<Camera>(null);
  
  // Vision Camera hooks
  const devices = useCameraDevices();
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicrophonePermission, requestPermission: requestMicrophonePermission } = useMicrophonePermission();
  
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    isProcessing: false,
    compressionProgress: 0,
    isUploading: false,
    uploadProgress: 0,
    recordedVideoPath: null,
    showReplay: false,
  });
  
  // Timer and camera settings
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldProcessVideoRef = useRef<boolean>(false);
  const currentDurationRef = useRef<number>(0);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const [isActive, setIsActive] = useState(true);

  // Get camera device
  const device = cameraPosition === 'front' 
    ? devices.find(d => d.position === 'front')
    : devices.find(d => d.position === 'back');

  const MAX_DURATION = 5 * 60; // 5 minutes

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Permission handling
  const hasAllPermissions = hasCameraPermission && hasMicrophonePermission;
  
  const handleRequestPermissions = useCallback(async () => {
    try {
      if (!hasCameraPermission) {
        await requestCameraPermission();
      }
      if (!hasMicrophonePermission) {
        await requestMicrophonePermission();
      }
    } catch (error) {
      console.error('🧇 Permission request failed:', error);
      onError?.('Failed to request camera permissions');
    }
  }, [hasCameraPermission, hasMicrophonePermission, requestCameraPermission, requestMicrophonePermission, onError]);

  const resetRecordingState = useCallback(() => {
    setRecordingState({
      isRecording: false,
      duration: 0,
      isProcessing: false,
      compressionProgress: 0,
      isUploading: false,
      uploadProgress: 0,
      recordedVideoPath: null,
      showReplay: false,
    });
    shouldProcessVideoRef.current = false;
    currentDurationRef.current = 0;
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current) {
      onError?.('Camera is not ready. Please try again.');
      return;
    }

    try {
      setRecordingState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        isProcessing: false,
        recordedVideoPath: null,
        showReplay: false
      }));
      
      shouldProcessVideoRef.current = true;
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingState(prev => {
          const newDuration = prev.duration + 1;
          currentDurationRef.current = newDuration; // Update ref with current duration
          if (newDuration >= MAX_DURATION) {
            handleStopRecording(true);
            return { ...prev, duration: MAX_DURATION };
          }
          return { ...prev, duration: newDuration };
        });
      }, 1000);

      // Start recording
      await cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: async (video) => {
          console.log('🧇 Video recorded:', video);
          if (shouldProcessVideoRef.current) {
            const finalDuration = currentDurationRef.current; // Use ref instead of state
            setRecordingState(prev => ({ 
              ...prev, 
              recordedVideoPath: video.path,
              showReplay: true 
            }));
            await handleVideoProcessing(video.path, finalDuration);
          }
        },
        onRecordingError: (error) => {
          console.error('🧇 Recording error:', error);
          handleStopRecording(false);
          onError?.('Recording failed. Please try again.');
        },
      });
    } catch (error) {
      console.error('🧇 Start recording error:', error);
      onError?.('Failed to start recording. Please try again.');
      setRecordingState(prev => ({ ...prev, isRecording: false }));
    }
  }, [recordingState.duration, onError]);

  const handleStopRecording = useCallback(async (saveVideo: boolean = true) => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      shouldProcessVideoRef.current = saveVideo;

      if (cameraRef.current) {
        await cameraRef.current.stopRecording();
      }

      setRecordingState(prev => ({ 
        ...prev, 
        isRecording: false,
        isProcessing: saveVideo
      }));

      if (!saveVideo) {
        resetRecordingState();
      }
    } catch (error) {
      console.error('🧇 Stop recording error:', error);
      setRecordingState(prev => ({ ...prev, isRecording: false }));
      onError?.('Failed to stop recording');
    }
  }, [resetRecordingState, onError]);

  const handleVideoProcessing = useCallback(async (videoPath: string, durationSeconds: number) => {
    if (!userId) {
      onError?.('User not authenticated');
      return;
    }

    try {
      console.log('🧇 Processing video for upload:', videoPath);
      setRecordingState(prev => ({ 
        ...prev, 
        isProcessing: true, 
        compressionProgress: 0,
        isUploading: false,
        uploadProgress: 0
      }));

      // Compress video
      const compressionResult = await compressVideoForUpload(videoPath, durationSeconds);

      // Get recipient ID from chat
      const { FirestoreService } = await import('@/lib/firestore');
      const firestoreService = FirestoreService.getInstance();
      const chat = await firestoreService.getChat(chatId);
      
      if (!chat) {
        throw new Error('Chat not found');
      }

      const recipientId = chat.members.find(id => id !== userId);
      if (!recipientId) {
        throw new Error('Recipient not found in chat');
      }

      // Upload video
      await videoUploadErrorHandler.withRetry(
        () => uploadVideoToChat({
          chatId: chatId,
          senderId: userId,
          recipientId: recipientId,
          localVideoPath: compressionResult.uri,
          duration: durationSeconds,
          onProgress: (progress: UploadProgress) => {
            setRecordingState(prev => ({
              ...prev,
              uploadProgress: progress.progress
            }));
          }
        }),
        'video-upload',
        { maxAttempts: 3, baseDelay: 1000, maxDelay: 10000, backoffFactor: 2 }
      );

      console.log('🧇 Video uploaded successfully');
      resetRecordingState();
      onVideoSent?.();

    } catch (error) {
      console.error('🧇 Video processing/upload error:', error);
      
      let errorMessage = 'Failed to send video. Please try again.';
      if (error && typeof error === 'object' && 'type' in error) {
        const uploadError = error as { type: ErrorType };
        switch (uploadError.type) {
          case ErrorType.NETWORK_ERROR:
            errorMessage = 'Network error. Check your connection and try again.';
            break;
          case ErrorType.STORAGE_ERROR:
            errorMessage = 'Storage error. Please try again later.';
            break;
          case ErrorType.COMPRESSION_ERROR:
            errorMessage = 'Video processing failed. Please try again.';
            break;
          case ErrorType.FILE_ERROR:
            errorMessage = 'Video file is too large. Try recording a shorter video.';
            break;
          case ErrorType.PERMISSION_ERROR:
            errorMessage = 'Permission denied. Please check your settings.';
            break;
        }
      }
      
      onError?.(errorMessage);
      setRecordingState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isUploading: false,
        showReplay: false
      }));
    }
  }, [userId, chatId, onVideoSent, onError, resetRecordingState]);

  const toggleCameraFacing = useCallback(() => {
    setCameraPosition(prev => prev === 'front' ? 'back' : 'front');
  }, []);

  const handleRetakeVideo = useCallback(() => {
    resetRecordingState();
  }, [resetRecordingState]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getRemainingTime = useCallback(() => {
    return MAX_DURATION - recordingState.duration;
  }, [recordingState.duration]);

  // Loading state
  if (!device) {
    return (
      <View className={`justify-center items-center ${className}`}>
        <Text className="text-gray-500 text-lg">Loading camera...</Text>
      </View>
    );
  }

  // Permission handling UI
  if (!hasAllPermissions) {
    return (
      <View className={`justify-center items-center p-6 ${className}`}>
        <View className="items-center">
          <Text className="text-gray-400 text-4xl mb-4">📹</Text>
          <Text className="text-text font-header text-lg text-center mb-2">
            Camera Access Needed
          </Text>
          <Text className="text-gray-600 font-body text-sm text-center mb-6">
            Waffle needs camera and microphone access to record videos.
          </Text>
          <Button
            title="Grant Permissions"
            variant="primary"
            size="small"
            onPress={handleRequestPermissions}
          />
        </View>
      </View>
    );
  }

  // Show replay/processing state
  if (recordingState.showReplay && recordingState.recordedVideoPath) {
    return (
      <View className={`relative ${className}`}>
        <Video
          source={{ uri: recordingState.recordedVideoPath }}
          style={{ flex: 1 }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          isLooping={false}
          useNativeControls={false}
        />
        
        {/* Processing Overlay */}
        {(recordingState.isProcessing || recordingState.isUploading) && (
          <View 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            className="bg-black/70 justify-center items-center px-6"
          >
            <View className="bg-white rounded-2xl p-6 items-center w-full max-w-sm">
              <Text className="text-text font-header-bold text-lg mb-4 text-center">
                {recordingState.isUploading ? 'Sending Waffle...' : 'Processing Video...'}
              </Text>
              
              {/* Progress bar */}
              <View className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <View 
                  className="bg-primary h-3 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${recordingState.isUploading 
                      ? recordingState.uploadProgress 
                      : recordingState.compressionProgress
                    }%` 
                  }}
                />
              </View>
              
              <Text className="text-gray-600 font-body text-sm text-center">
                {recordingState.isUploading 
                  ? `${Math.round(recordingState.uploadProgress)}% uploaded` 
                  : `${Math.round(recordingState.compressionProgress)}% compressed`
                }
              </Text>
            </View>
          </View>
        )}
        
        {/* Replay Controls */}
        {!recordingState.isProcessing && !recordingState.isUploading && (
          <View className="absolute bottom-4 left-4 right-4 flex-row justify-center space-x-4">
            <Button
              title="Retake"
              variant="outline"
              size="small"
              onPress={handleRetakeVideo}
            />
            <Button
              title="Send Waffle 🧇"
              variant="primary"
              size="small"
              onPress={() => {
                const currentDuration = currentDurationRef.current; // Use ref for consistency
                handleVideoProcessing(recordingState.recordedVideoPath!, currentDuration);
              }}
            />
          </View>
        )}
      </View>
    );
  }

  // Main camera view
  return (
    <View className={`relative ${className}`}>
      <Camera
        ref={cameraRef}
        style={{ flex: 1 }}
        device={device}
        isActive={isActive && !recordingState.showReplay}
        video={true}
        audio={true}
        enableZoomGesture
      />
      
      {/* Recording timer */}
      {recordingState.isRecording && (
        <View className="absolute top-4 left-4 right-4 flex-row justify-between items-center">
          <View className="bg-black/50 rounded-full px-3 py-1">
            <Text className="text-white font-mono text-sm">
              {formatTime(recordingState.duration)}
            </Text>
          </View>
          <View className="bg-black/50 rounded-full px-3 py-1">
            <Text className="text-white font-mono text-sm">
              {formatTime(getRemainingTime())} left
            </Text>
          </View>
        </View>
      )}
      
      {/* Recording indicator */}
      {recordingState.isRecording && (
        <View className="absolute top-4 right-4">
          <View className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        </View>
      )}
      
      {/* Camera controls */}
      <View className="absolute bottom-4 left-4 right-4">
        <View className="flex-row justify-between items-center">
          {/* Flip camera button */}
          <Pressable
            onPress={toggleCameraFacing}
            className="w-12 h-12 bg-black/50 rounded-full justify-center items-center"
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
          >
            <Text className="text-white text-lg">🔄</Text>
          </Pressable>
          
          {/* Record button */}
          <Pressable
            onPress={recordingState.isRecording ? () => handleStopRecording(true) : handleStartRecording}
            className={`w-20 h-20 rounded-full justify-center items-center border-4 border-white ${
              recordingState.isRecording ? 'bg-red-500' : 'bg-white/20'
            }`}
            accessibilityRole="button"
            accessibilityLabel={recordingState.isRecording ? 'Stop recording' : 'Start recording'}
          >
            {recordingState.isRecording ? (
              <View className="w-6 h-6 bg-white rounded-sm" />
            ) : (
              <View className="w-16 h-16 bg-red-500 rounded-full" />
            )}
          </Pressable>
          
          {/* Spacer */}
          <View className="w-12" />
        </View>
      </View>
    </View>
  );
};

export default InlineCameraRecorder; 