import React, { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevices, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { Video, ResizeMode } from 'expo-av';
import { Button } from '@/components/ui/Button';
import { compressVideoForUpload, videoCompressionService } from '@/lib/videoCompression';
import { uploadVideoToChat, UploadProgress } from '@/lib/storage';

export const options = { presentation: 'modal', headerShown: false };

interface RecordingState {
  isRecording: boolean;
  duration: number;
  isPaused: boolean;
  isProcessing: boolean;
  compressionProgress: number;
  isUploading: boolean;
  uploadProgress: number;
  recordedVideoPath: string | null;
  showReplay: boolean;
}

export default function CameraModal() {
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  
  // Vision Camera hooks
  const devices = useCameraDevices();
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicrophonePermission, requestPermission: requestMicrophonePermission } = useMicrophonePermission();
  
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    isPaused: false,
    isProcessing: false,
    compressionProgress: 0,
    isUploading: false,
    uploadProgress: 0,
    recordedVideoPath: null,
    showReplay: false,
  });
  
  // Timer for recording duration
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Ref to track if we should process the video (to avoid stale closure issues)
  const shouldProcessVideoRef = useRef<boolean>(false);
  
  // Camera settings
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const [isActive, setIsActive] = useState(true);

  // Get the appropriate camera device
  const device = cameraPosition === 'front' 
    ? devices.find(d => d.position === 'front')
    : devices.find(d => d.position === 'back');

  // Constants
  const MAX_DURATION = 5 * 60; // 5 minutes in seconds

  useEffect(() => {
    // Cleanup timer and camera on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Deactivate camera to prevent session conflicts
      setIsActive(false);
    };
  }, []);

  // Check if we have a device
  if (!device) {
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        <Text className="text-white text-lg">Loading camera...</Text>
      </SafeAreaView>
    );
  }

  // Permission handling
  const hasAllPermissions = hasCameraPermission && hasMicrophonePermission;
  
  if (!hasAllPermissions) {
    // Camera or microphone permissions are not granted yet
    const handleRequestPermissions = async () => {
      try {
        if (!hasCameraPermission) {
          await requestCameraPermission();
        }
        if (!hasMicrophonePermission) {
          await requestMicrophonePermission();
        }
      } catch (error) {
        console.error('🧇 Permission request failed:', error);
        Alert.alert('Permission Error', 'Failed to request permissions. Please try again.');
      }
    };

    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center px-6">
        <View className="items-center">
          <Text className="text-white text-6xl mb-6">📹</Text>
          <Text className="text-white font-header text-2xl text-center mb-4">
            Camera & Microphone Access Needed
          </Text>
          <Text className="text-white/70 font-body text-base text-center mb-8">
            Waffle needs access to your camera and microphone to record video messages for your friends.
          </Text>
          <Button
            title="Grant Permissions"
            variant="primary"
            size="large"
            onPress={handleRequestPermissions}
          />
          <Pressable onPress={() => router.back()} className="mt-6">
            <Text className="text-white/50 font-body text-base">Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleClose = () => {
    if (recordingState.isRecording) {
      Alert.alert(
        'Stop Recording?',
        'Are you sure you want to stop recording and discard this video?',
        [
          { text: 'Continue Recording', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive', 
            onPress: () => {
              handleStopRecording(false);
              router.back();
            }
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current) {
      Alert.alert('Camera Error', 'Camera is not ready. Please try again.');
      return;
    }

    try {
      setRecordingState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        isProcessing: false,
        compressionProgress: 0,
        isUploading: false,
        uploadProgress: 0
      }));
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setRecordingState(prev => {
          const newDuration = prev.duration + 1;
          
          // Auto-stop at max duration
          if (newDuration >= MAX_DURATION) {
            handleStopRecording(true);
            return { ...prev, duration: MAX_DURATION };
          }
          
          return { ...prev, duration: newDuration };
        });
      }, 1000);

      // Start actual recording
      await cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: async (video) => {
          console.log('🧇 Video recorded:', video);
          
          // Store the video path for replay
          setRecordingState(prev => ({
            ...prev,
            recordedVideoPath: video.path
          }));
          
          // Process video if recording was saved (using ref to avoid stale closure)
          if (shouldProcessVideoRef.current) {
            const finalDuration = recordingState.duration;
            await handleVideoProcessing(video.path, finalDuration);
          } else {
            // Show replay option if video was not processed
            setRecordingState(prev => ({
              ...prev,
              showReplay: true
            }));
          }
        },
        onRecordingError: (error) => {
          console.error('🧇 Recording failed:', error);
          Alert.alert('Recording Failed', 'Failed to record video. Please try again.');
          setRecordingState(prev => ({ 
            ...prev, 
            isRecording: false, 
            isProcessing: false 
          }));
        },
      });
      
    } catch (error) {
      console.error('🧇 Recording failed:', error);
      Alert.alert('Recording Failed', 'Failed to start recording. Please try again.');
      setRecordingState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isProcessing: false 
      }));
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const handleStopRecording = async (saveVideo: boolean = true) => {
    if (!cameraRef.current || !recordingState.isRecording) return;

    try {
      // Stop timer first
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Set ref to track if we should process the video
      shouldProcessVideoRef.current = saveVideo;

      // Update state to indicate we're stopping
      setRecordingState(prev => ({ 
        ...prev, 
        isRecording: false,
        isProcessing: saveVideo,
        compressionProgress: 0
      }));

      // Temporarily deactivate camera to prevent session conflicts
      setIsActive(false);
      
      // Stop recording with a small delay to ensure proper session management
      await new Promise(resolve => setTimeout(resolve, 100));
      await cameraRef.current.stopRecording();
      
      // Reactivate camera after a brief pause
      setTimeout(() => {
        setIsActive(true);
      }, 500);

              if (!saveVideo) {
        // Reset state completely for cancel
        setRecordingState(prev => ({
          ...prev,
          duration: 0,
          isPaused: false,
          isProcessing: false,
          compressionProgress: 0,
          isUploading: false,
          uploadProgress: 0,
          recordedVideoPath: null,
          showReplay: false
        }));
      }

    } catch (error) {
      console.error('🧇 Stop recording failed:', error);
      Alert.alert('Error', 'Failed to stop recording properly.');
      
      // Ensure camera is reactivated even on error
      setIsActive(true);
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        duration: 0,
        compressionProgress: 0,
        isUploading: false,
        uploadProgress: 0,
        recordedVideoPath: null,
        showReplay: false
      }));
    }
  };

  const toggleCameraFacing = () => {
    setCameraPosition(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleSendVideo = async () => {
    if (!recordingState.recordedVideoPath) return;
    
    setRecordingState(prev => ({
      ...prev,
      showReplay: false,
      isProcessing: true,
      compressionProgress: 0
    }));

    await handleVideoProcessing(recordingState.recordedVideoPath, recordingState.duration);
  };

  const handleRetakeVideo = () => {
    setRecordingState(prev => ({
      ...prev,
      recordedVideoPath: null,
      showReplay: false,
      duration: 0
    }));
  };

  const handleVideoProcessing = async (videoPath: string, durationSeconds: number) => {
    try {
      console.log('🧇 Starting video processing...');
      
      // Update UI to show compression in progress
      setRecordingState(prev => ({ 
        ...prev, 
        isProcessing: true, 
        compressionProgress: 0 
      }));

      // Compress the video
      const compressionResult = await compressVideoForUpload(videoPath, durationSeconds);
      
      console.log('🧇 Video compression completed:', compressionResult);

      // Update compression progress to 100%
      setRecordingState(prev => ({ 
        ...prev, 
        compressionProgress: 100,
        isUploading: true,
        uploadProgress: 0
      }));

      console.log('🧇 Starting Firebase Storage upload...');

      // Upload to Firebase Storage with progress tracking
      // For now, we'll use dummy chat data - this will be replaced with real chat context
      const uploadResult = await uploadVideoToChat({
        chatId: 'demo-chat-id', // TODO: Get from chat context
        senderId: 'current-user-id', // TODO: Get from auth context
        recipientId: 'recipient-user-id', // TODO: Get from chat context
        localVideoPath: compressionResult.uri,
        duration: durationSeconds,
        onProgress: (progress: UploadProgress) => {
          setRecordingState(prev => ({
            ...prev,
            uploadProgress: progress.progress
          }));
          console.log('🧇 Upload progress:', progress.progress + '%');
        }
      });

      console.log('🧇 Upload completed:', uploadResult);

      // Update state to show completion
      setRecordingState(prev => ({ 
        ...prev, 
        isUploading: false,
        uploadProgress: 100
      }));

      // Show success message
      Alert.alert(
        'Waffle Sent! 🧇',
        `Your video has been compressed (${compressionResult.compressionRatio.toFixed(1)}x smaller) and uploaded successfully!`,
        [
          { text: 'Send Another', onPress: () => resetRecordingState() },
          { text: 'Back to Chat', onPress: () => router.back() }
        ]
      );

    } catch (error) {
      console.error('🧇 Video processing failed:', error);
      Alert.alert(
        'Processing Failed',
        'Failed to process your video. Please try recording again.',
        [
          { text: 'Try Again', onPress: () => resetRecordingState() }
        ]
      );
    }
  };

  const resetRecordingState = () => {
    setRecordingState({
      isRecording: false,
      duration: 0,
      isPaused: false,
      isProcessing: false,
      compressionProgress: 0,
      isUploading: false,
      uploadProgress: 0,
      recordedVideoPath: null,
      showReplay: false,
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    return MAX_DURATION - recordingState.duration;
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row justify-between items-center p-6 z-10">
        <Pressable
          className="w-10 h-10 rounded-full bg-white/20 justify-center items-center"
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <Text className="text-white text-lg font-bold">×</Text>
        </Pressable>
        
        <Text className="text-white font-header text-lg">
          Pour a Waffle 🧇
        </Text>
        
        <Pressable
          className="w-10 h-10 rounded-full bg-white/20 justify-center items-center"
          onPress={toggleCameraFacing}
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
        >
          <Text className="text-white text-sm">🔄</Text>
        </Pressable>
      </View>

      {/* Camera View */}
      <View className="flex-1 mx-4 mb-4 rounded-2xl overflow-hidden">
        {recordingState.showReplay && recordingState.recordedVideoPath ? (
          <Video
            source={{ uri: recordingState.recordedVideoPath }}
            style={{ flex: 1 }}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
          />
        ) : (
          <Camera
            ref={cameraRef}
            style={{ flex: 1 }}
            device={device}
            isActive={isActive && !recordingState.isProcessing && !recordingState.showReplay}
            video={true}
            audio={true}
          >
            {/* Recording Status Overlay */}
            {recordingState.isRecording && (
            <>
              {/* Recording indicator */}
              <View className="absolute top-4 left-4 right-4 justify-center items-center">
                <View className="bg-red-500 px-4 py-2 rounded-full flex-row items-center">
                  <View className="w-2 h-2 bg-white rounded-full mr-2" />
                  <Text className="text-white font-body-bold text-sm">
                    REC {formatTime(recordingState.duration)}
                  </Text>
                </View>
              </View>

              {/* Duration display in center */}
              <View className="absolute inset-0 justify-center items-center">
                <View className="bg-black/50 px-8 py-6 rounded-2xl">
                  <Text className="text-white font-header-bold text-4xl text-center">
                    {formatTime(recordingState.duration)}
                  </Text>
                  <Text className="text-white/70 font-body text-sm text-center mt-2">
                    {getRemainingTime() > 60 
                      ? `${Math.floor(getRemainingTime() / 60)}m ${getRemainingTime() % 60}s left`
                      : `${getRemainingTime()}s left`
                    }
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Processing Status Overlay */}
          {recordingState.isProcessing && (
            <View className="absolute inset-0 bg-black/70 justify-center items-center">
              <Text className="text-white text-6xl mb-4">🧇</Text>
              {!recordingState.isUploading ? (
                <>
                  <Text className="text-white font-header text-xl text-center mb-2">
                    Compressing your waffle...
                  </Text>
                  <Text className="text-white/70 font-body text-base text-center">
                    {recordingState.compressionProgress}% complete
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white font-header text-xl text-center mb-2">
                    Sending your waffle...
                  </Text>
                  <Text className="text-white/70 font-body text-base text-center">
                    {recordingState.uploadProgress}% uploaded
                  </Text>
                </>
              )}
            </View>
          )}
          </Camera>
        )}
      </View>

      {/* Bottom Controls */}
      <View className="px-6 pb-8">
        {recordingState.isRecording ? (
          <>
            {/* Recording Controls */}
            <View className="flex-row justify-center space-x-8">
              <Button
                title="Cancel"
                variant="outline"
                size="large"
                onPress={() => handleStopRecording(false)}
                className="border-white bg-white/10"
              />
              
              <Button
                title="Send Waffle 🧇"
                variant="primary"
                size="large"
                onPress={() => handleStopRecording(true)}
              />
            </View>

            <Text className="text-white/70 font-body text-sm text-center mt-4">
              Tap "Send Waffle" when you're done recording
            </Text>
          </>
        ) : recordingState.showReplay ? (
          <>
            {/* Replay Controls */}
            <View className="mb-6">
              <Text className="text-white font-header text-xl text-center mb-2">
                How does it look?
              </Text>
              <Text className="text-white/70 font-body text-base text-center">
                Review your waffle and decide if you want to send it or record again.
              </Text>
            </View>

            <View className="flex-row justify-center space-x-4">
              <Button
                title="Retake"
                variant="outline"
                size="large"
                onPress={handleRetakeVideo}
                className="border-white bg-white/10"
              />
              
              <Button
                title="Send Waffle 🧇"
                variant="primary"
                size="large"
                onPress={handleSendVideo}
              />
            </View>

            <Text className="text-white/70 font-body text-sm text-center mt-4">
              Duration: {formatTime(recordingState.duration)}
            </Text>
          </>
        ) : (
          <>
            {/* Recording Instructions */}
            <View className="mb-6">
              <Text className="text-white font-header text-xl text-center mb-2">
                Ready to share?
              </Text>
              <Text className="text-white/70 font-body text-base text-center">
                Record a video update for your friend. Keep it genuine and fun! 🧇
              </Text>
              <Text className="text-white/50 font-body text-sm text-center mt-2">
                Max duration: {Math.floor(MAX_DURATION / 60)} minutes
              </Text>
            </View>

            {/* Record Button */}
            <View className="items-center">
              <Pressable
                className="w-20 h-20 rounded-full justify-center items-center shadow-lg bg-primary active:scale-95"
                onPress={handleStartRecording}
                accessibilityRole="button"
                accessibilityLabel="Start recording"
              >
                <View className="w-16 h-16 bg-white rounded-full" />
              </Pressable>
              <Text className="text-white font-body text-sm mt-3">
                Tap to start recording
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

CameraModal.options = options;
