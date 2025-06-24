import React from 'react';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

function TabIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabsLayout() {
  const scheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors[scheme ?? 'light'].tint,
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Waffles',
          tabBarIcon: ({ color }) => <TabIcon name="comments" color={color} />,
        }}
      />

      <Tabs.Screen
        name="invite"
        options={{
          title: 'Invites',
          tabBarIcon: ({ color }) => <TabIcon name="user-plus" color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}