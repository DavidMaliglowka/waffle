import { Stack } from 'expo-router';

export default function ChatsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[chatId]" options={{ title: 'Waffles' }} />
    </Stack>
  );
}
