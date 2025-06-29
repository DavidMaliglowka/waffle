import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Switch, Alert, TextInput, TouchableOpacity } from 'react-native';
import { Button } from '@/components/ui/Button';
import { authService, useAuthState } from '@/lib/auth';
import { FirestoreService, User } from '@/lib/firestore';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { user: authUser, loading: authLoading } = useAuthState();
  const [userProfile, setUserProfile] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    displayName: '',
    email: '',
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [weeklyReminders, setWeeklyReminders] = React.useState(true);
  const [autoSave, setAutoSave] = React.useState(false);

  const firestoreService = FirestoreService.getInstance();

  // Load user profile from Firestore
  React.useEffect(() => {
    const loadUserProfile = async () => {
      if (!authUser?.uid) {
        setLoading(false);
        return;
      }

      try {
        const profile = await firestoreService.getUser(authUser.uid);
        
        if (!profile) {
          // Profile doesn't exist in Firestore - this can happen if:
          // 1. Account was deleted externally from Firebase Auth
          // 2. User data was manually deleted from Firestore
          // 3. Some other data inconsistency
          console.log('🚨 User profile not found in Firestore - signing out user');
          
          Alert.alert(
            'Account Not Found',
            'Your account data could not be found. You will be signed out automatically.',
            [
              {
                text: 'OK',
                onPress: async () => {
                  try {
                    await authService.signOut();
                    // Navigation will be handled automatically by RootLayoutNav
                  } catch (signOutError) {
                    console.error('Error signing out:', signOutError);
                    // Even if sign out fails, RootLayoutNav will handle navigation
                  }
                }
              }
            ],
            { cancelable: false }
          );
          return;
        }
        
        setUserProfile(profile);
        setEditForm({
          displayName: profile.displayName || '',
          email: profile.email || '',
        });
      } catch (error) {
        console.error('Error loading user profile:', error);
        
        // Check if this is a permission error or profile missing error
        if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as any;
          
          if (firebaseError.code === 'permission-denied' || firebaseError.code === 'not-found') {
            // Likely the user was deleted externally - sign them out
            console.log('🚨 Permission denied or profile not found - signing out user');
            
            Alert.alert(
              'Account Access Error',
              'Unable to access your account data. You will be signed out automatically.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    try {
                      await authService.signOut();
                      // Navigation will be handled automatically by RootLayoutNav
                    } catch (signOutError) {
                      console.error('Error signing out:', signOutError);
                      // Even if sign out fails, RootLayoutNav will handle navigation
                    }
                  }
                }
              ],
              { cancelable: false }
            );
            return;
          }
        }
        
        // For other errors, show generic error message
        Alert.alert('Error', 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadUserProfile();
    }
  }, [authUser, authLoading]);

  const handleSaveProfile = async () => {
    if (!authUser?.uid || !userProfile) return;

    try {
      setLoading(true);
      
      // Update profile in Firestore
      await firestoreService.updateUser(authUser.uid, {
        displayName: editForm.displayName.trim(),
        email: editForm.email.trim() || undefined,
      });

      // Reload profile to get updated data
      const updatedProfile = await firestoreService.getUser(authUser.uid);
      setUserProfile(updatedProfile);
      
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (userProfile) {
      setEditForm({
        displayName: userProfile.displayName || '',
        email: userProfile.email || '',
      });
    }
    setEditing(false);
  };

  const formatPhoneNumber = (phoneNumber: string | undefined) => {
    if (!phoneNumber) return 'Not provided';
    
    // Format US/CA numbers nicely
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      const digits = phoneNumber.slice(2); // Remove +1
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    return phoneNumber;
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getProviderDisplayName = () => {
    if (!authUser) return 'Unknown';
    
    switch (authUser.providerId) {
      case 'apple.com':
        return 'Apple Sign-In';
      case 'phone':
        return 'Phone Authentication';
      default:
        return 'Email/Password';
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => {
          try {
            const result = await authService.signOut();
            if (result.success) {
              console.log('Signed out successfully');
              // Navigation will be handled automatically by RootLayoutNav when auth state changes
            } else {
              Alert.alert('Error', result.error || 'Failed to sign out');
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out');
          }
        }},
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          // TODO: Implement account deletion logic
          console.log('Deleting account...');
        }},
      ]
    );
  };

  const SettingsRow = ({ 
    title, 
    subtitle, 
    hasSwitch = false, 
    switchValue = false, 
    onSwitchChange, 
    onPress 
  }: {
    title: string;
    subtitle?: string;
    hasSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
    onPress?: () => void;
  }) => (
    <View className="flex-row items-center justify-between py-4 px-6 bg-surface border-b border-gray-100">
      <View className="flex-1 mr-4">
        <Text className="text-text font-body-medium text-base">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-gray-500 font-body text-sm mt-1">
            {subtitle}
          </Text>
        )}
      </View>
      
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#767577', true: '#FDB833' }}
          thumbColor={switchValue ? '#f4f3f4' : '#f4f3f4'}
        />
      ) : (
        <Text className="text-gray-400 text-lg">
          →
        </Text>
      )}
    </View>
  );

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <Text className="text-6xl mb-4">🧇</Text>
        <Text className="text-text font-body text-lg">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!authUser) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <Text className="text-6xl mb-4">🧇</Text>
        <Text className="text-text font-body text-lg">Not authenticated</Text>
        <Button
          title="Sign In"
          onPress={() => router.replace('/auth/phone')}
          className="mt-4"
        />
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    // This state should be rare now since we handle missing profiles above
    // But keeping as a safety fallback
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <Text className="text-6xl mb-4">🧇</Text>
        <Text className="text-text font-body text-lg">Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-8 pb-6">
          <Text className="text-text font-header-bold text-4xl">
            Settings
          </Text>
          <Text className="text-gray-600 font-body text-base mt-2">
            Customize your Waffle experience
          </Text>
        </View>

        {/* Profile Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center px-6 mb-3">
            <Text className="text-text font-header-bold text-lg">
              Profile
            </Text>
            {editing && (
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  className="px-3 py-1 rounded-md bg-gray-200"
                >
                  <Text className="text-gray-700 font-body-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  className="px-3 py-1 rounded-md bg-primary"
                >
                  <Text className="text-white font-body-medium">Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <View className="bg-surface">
            {/* Profile Info */}
            <View className="p-6 border-b border-gray-100">
              <View className="flex-row items-center mb-4">
                <View className="w-16 h-16 bg-primary rounded-full justify-center items-center mr-4">
                  <Text className="text-white font-header-bold text-xl">
                    {getInitials(userProfile.displayName)}
                  </Text>
                </View>
                <View className="flex-1">
                  {editing ? (
                    <View>
                      <Text className="text-gray-600 font-body text-sm mb-1">Display Name</Text>
                      <TextInput
                        value={editForm.displayName}
                        onChangeText={(text) => setEditForm(prev => ({ ...prev, displayName: text }))}
                        placeholder="Enter your name"
                        className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-text font-body text-base"
                      />
                    </View>
                  ) : (
                    <>
                      <Text className="text-text font-body-bold text-lg">
                        {userProfile.displayName}
                      </Text>
                      <Text className="text-gray-500 font-body text-base">
                        {userProfile.email || 'No email provided'}
                      </Text>
                    </>
                  )}
                </View>
              </View>
              
              {editing && (
                <View className="mb-4">
                  <Text className="text-gray-600 font-body text-sm mb-1">Email (Optional)</Text>
                  <TextInput
                    value={editForm.email}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-text font-body text-base"
                  />
                </View>
              )}
            </View>
            
            {!editing && (
              <>
                <SettingsRow
                  title="Phone Number"
                  subtitle={formatPhoneNumber(userProfile.phoneNumber)}
                />
                
                <SettingsRow
                  title="Sign-In Method"
                  subtitle={getProviderDisplayName()}
                />
                
                <SettingsRow
                  title="Edit Profile"
                  subtitle="Update your name and email"
                  onPress={() => setEditing(true)}
                />
              </>
            )}
          </View>
        </View>

        {/* Notifications Section */}
        <View className="mb-6">
          <Text className="text-text font-header-bold text-lg px-6 mb-3">
            Notifications
          </Text>
          <View className="bg-surface">
            <SettingsRow
              title="Push Notifications"
              subtitle="Receive notifications for new waffles"
              hasSwitch
              switchValue={notificationsEnabled}
              onSwitchChange={setNotificationsEnabled}
            />
            
            <SettingsRow
              title="Weekly Reminders"
              subtitle="Get reminded to share your weekly update"
              hasSwitch
              switchValue={weeklyReminders}
              onSwitchChange={setWeeklyReminders}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View className="mb-6">
          <Text className="text-text font-header-bold text-lg px-6 mb-3">
            Privacy & Storage
          </Text>
          <View className="bg-surface">
            <SettingsRow
              title="Auto-save to Photos"
              subtitle="Automatically save your waffles to your photo library"
              hasSwitch
              switchValue={autoSave}
              onSwitchChange={setAutoSave}
            />
            
            <SettingsRow
              title="Clear Cache"
              subtitle="Free up storage space"
              onPress={() => console.log('Clear cache')}
            />
          </View>
        </View>

        {/* About Section */}
        <View className="mb-6">
          <Text className="text-text font-header-bold text-lg px-6 mb-3">
            About
          </Text>
          <View className="bg-surface">
            <SettingsRow
              title="Version"
              subtitle="1.0.0"
            />
            
            <SettingsRow
              title="Terms of Service"
              onPress={() => console.log('Terms of service')}
            />
            
            <SettingsRow
              title="Privacy Policy"
              onPress={() => console.log('Privacy policy')}
            />
          </View>
        </View>

        {/* Account Actions */}
        <View className="px-6 mb-8">
          <Button
            title="Sign Out"
            variant="outline"
            size="large"
            fullWidth
            onPress={handleSignOut}
            className="mb-3"
          />
          
          <Button
            title="Delete Account"
            variant="ghost"
            size="medium"
            fullWidth
            onPress={handleDeleteAccount}
            className="border border-red-300"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
