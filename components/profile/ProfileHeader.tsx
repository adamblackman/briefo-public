import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Settings, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ProfileHeader() {
  const { colors } = useTheme();
  const router = useRouter();

  const navigateToSettings = () => {
    router.push('/(tabs)/settings');
  };
  
  const navigateToFriends = () => {
    router.push({
      pathname: '/(tabs)/friends',
      params: { previousScreenPath: '/(tabs)/profile' },
    });
  };
  
  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
        <View>
          <Image 
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.iconsContainer}>
          <TouchableOpacity onPress={navigateToFriends} style={[styles.iconButton, { backgroundColor: colors.cardBackground, marginRight: 12 }]}>
            <Users color={colors.text} size={20} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={navigateToSettings} style={[styles.iconButton, { backgroundColor: colors.cardBackground }]}>
            <Settings color={colors.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
  },
  logo: {
    width: 100,
    height: 40,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    marginBottom: 0,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
  },
});