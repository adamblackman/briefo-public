import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        animation: 'slide_from_right', // Or your preferred animation
        headerShown: false,
        // Aggressively hide header elements
        headerTransparent: true,
        headerTitle: '', // Still useful to ensure no title text appears if header isn't fully gone
        headerShadowVisible: false, // Explicitly hide shadow (good for iOS)
      }}
    />
  );
} 