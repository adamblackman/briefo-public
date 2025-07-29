import { useEffect } from 'react';
import React from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NavigationFocusProvider } from '@/context/NavigationFocusContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, loading: authLoading, isNewUser, userCategories, userCompanies } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const currentRoute = segments.join('/') || 'index'; // Get current route path
    const isAuthRoute = currentRoute === 'auth';
    const isOnboardingRoute = currentRoute === 'select-categories' || currentRoute === 'select-companies';
    const isTabsRoute = segments[0] === '(tabs)';
    
    if (!session && !isAuthRoute) {
      router.replace('/auth');
      return;
    }
    
    if (session && isNewUser && !isOnboardingRoute && !isTabsRoute) {
      if (!userCategories) {
        router.replace('/select-categories');
      } else if (userCategories && !userCompanies) {
        router.replace('/select-companies');
      }
      return; 
    }
  }, [session, authLoading, isNewUser, userCategories, userCompanies, segments, router]);

  // While auth is loading, and fonts are also potentially loading (handled by RootLayout)
  // we can show a global loading indicator or rely on splash screen.
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // The Stack navigator decides which screen to show based on the URL.
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(chat)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="select-categories" options={{ headerShown: false }} />
        <Stack.Screen name="select-companies" options={{ headerShown: false }} />
        <Stack.Screen name="stockDetail" options={{ headerShown: false }} />
        <Stack.Screen name="stock-research" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
  });

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Return null to keep splash screen visible while fonts load
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationFocusProvider>
          <StatusBar hidden />
          <RootLayoutNav />
        </NavigationFocusProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}