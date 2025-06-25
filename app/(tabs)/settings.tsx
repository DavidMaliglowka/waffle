import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Switch, Alert } from 'react-native';
import { Button } from '@/components/ui/Button';
import { authService } from '@/lib/auth';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [weeklyReminders, setWeeklyReminders] = React.useState(true);
  const [autoSave, setAutoSave] = React.useState(false);

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
              // User will automatically be redirected to auth flow by _layout.tsx
              console.log('Signed out successfully');
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
          // Handle account deletion logic here
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
          <Text className="text-text font-header-bold text-lg px-6 mb-3">
            Profile
          </Text>
          <View className="bg-surface">
            {/* Profile Info */}
            <View className="flex-row items-center p-6 border-b border-gray-100">
              <View className="w-16 h-16 bg-primary rounded-full justify-center items-center mr-4">
                <Text className="text-white font-header-bold text-xl">
                  JD
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-text font-body-bold text-lg">
                  John Doe
                </Text>
                <Text className="text-gray-500 font-body text-base">
                  john.doe@example.com
                </Text>
              </View>
            </View>
            
            <SettingsRow
              title="Edit Profile"
              subtitle="Update your name and profile picture"
              onPress={() => console.log('Edit profile')}
            />
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
