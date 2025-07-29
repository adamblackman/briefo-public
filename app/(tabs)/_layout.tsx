import { Tabs } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { Newspaper, BarChart3, MessageSquare, CircleUser as UserCircle, Bell } from 'lucide-react-native';
// import { Platform } from 'react-native'; // Assuming Platform is not used for specific styling here

export default function TabLayout() {
  const { colors } = useTheme();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingTop: 6,
          paddingBottom: 20,
          height: 75,
          paddingHorizontal: 15, // Reduced from 30 to 15 to spread icons more
          alignItems: 'center',
        },
        tabBarItemStyle: {
          width: 95,            // Increased from 80 to 95
          maxWidth: 95,         // Increased from 80 to 95
        },
        // tabBarLabelStyle: { // Original style, commented out
        //   fontFamily: 'Inter-Medium',
        //   fontSize: 12,
        //   marginBottom: 12
        // },
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'News', // Keep title for accessibility, even if not shown on tab
          tabBarIcon: ({ color, size }) => (
            <Newspaper color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio', // Keep title for accessibility
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat', // Keep title for accessibility
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile', // Keep title for accessibility
          tabBarIcon: ({ color, size }) => (
            <UserCircle color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings', // Keep title for accessibility/devtools
          headerShown: false,
          href: null, // This will properly hide it from tab layout
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends', // Keep title for accessibility/devtools
          headerShown: false,
          href: null, // This will properly hide it from tab layout
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <Bell color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}