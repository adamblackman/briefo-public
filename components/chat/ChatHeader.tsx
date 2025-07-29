import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { CirclePlus as PlusCircle, Search, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface ChatHeaderProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export default function ChatHeader({ searchQuery, onSearchQueryChange }: ChatHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const navigateToFriends = () => {
    router.push({
      pathname: '/(tabs)/friends',
      params: { previousScreenPath: '/(tabs)/chat' },
    });
  };
  
  const clearSearch = () => {
    onSearchQueryChange('');
  };
  
  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={styles.headerContainer}> 
        <View>
          <Image 
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={[styles.searchInputContainer, { backgroundColor: colors.cardBackground }]}>
          <Search size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchQueryChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity onPress={navigateToFriends} style={[styles.newChatIcon, { backgroundColor: colors.cardBackground }]}>
          <PlusCircle color={colors.text} size={20} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: { 
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
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 40,
    marginLeft: 5,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatIcon: {
    padding: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
});