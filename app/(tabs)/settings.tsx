import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import ProfileSettings from '@/components/profile/ProfileSettings'; // Assuming this path is correct
import { ChevronLeft } from 'lucide-react-native'; // Added ChevronLeft
import { useRouter } from 'expo-router'; // Added useRouter

// Header for the Settings screen
function SettingsHeader() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          onPress={() => router.navigate({ pathname: '/(tabs)/profile', params: { refreshProfile: 'true' } })}
          style={styles.backButton}
        >
          <ChevronLeft color={colors.text} size={28} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>
    </SafeAreaView>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SettingsHeader />
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ProfileSettings />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8, // Adjusted padding for a cleaner look, similar to ProfileHeader's paddingTop
    minHeight: 50, // Ensure header has some minimum height
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    marginLeft: 6, // Reduced from 16 to 6 to move the text closer to the back button
  },
  backButton: {
    padding: 4, // Added padding for better touch area
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 40, // Match ProfileScreen's content padding
  },
}); 