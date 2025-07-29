import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import FriendsListComponent from '@/components/friends/FriendsList';
import RequestsListComponent from '@/components/friends/RequestsList';
import SearchList from '@/components/friends/SearchList';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type ActiveView = 'friends' | 'requests';

// Header for the Friends screen
interface FriendsHeaderProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isSearchActive: boolean;
  setIsSearchActive: (isActive: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function FriendsHeader({ activeView, setActiveView, isSearchActive, setIsSearchActive, searchQuery, setSearchQuery }: FriendsHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ previousScreenPath?: string }>();

  const handleBack = () => {
    if (isSearchActive) {
      setIsSearchActive(false);
      setSearchQuery('');
      return;
    }
    if (params.previousScreenPath) {
      router.replace(params.previousScreenPath as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to a default screen if no info and cannot go back
      router.replace('/(tabs)/' as any);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }}>
      <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          {isSearchActive ? <X color={colors.text} size={28} /> : <ChevronLeft color={colors.text} size={28} />}
        </TouchableOpacity>
        {isSearchActive ? (
          <TextInput
            style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        ) : (
          <View style={styles.titleContainer}>
            <TouchableOpacity onPress={() => setActiveView('friends')}>
              <Text 
                style={[
                  styles.headerTitle, 
                  {
                    color: activeView === 'friends' ? colors.text : colors.textSecondary,
                    borderBottomColor: activeView === 'friends' ? colors.accent : 'transparent'
                  }
                ]}
              >
                Friends
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveView('requests')} style={styles.requestsButtonContainer}>
              <Text 
                style={[
                  styles.headerSubtitle, 
                  {
                    color: activeView === 'requests' ? colors.text : colors.textSecondary,
                    borderBottomColor: activeView === 'requests' ? colors.accent : 'transparent'
                  }
                ]}
              >
                Requests
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {!isSearchActive && (
          <TouchableOpacity onPress={() => setIsSearchActive(true)} style={styles.searchIconContainer}>
            <Search color={colors.text} size={24} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function FriendsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('friends');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [currentUserAuthId, setCurrentUserAuthId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchCurrentUserData = useCallback(async (): Promise<{ profileId: string; authId: string } | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id') // Fetch both profile PK ('id') and auth UUID ('user_id')
        .eq('user_id', user.id) // user.id from useAuth() is the auth.users.id
        .single();
      if (error) throw error;
      return data ? { profileId: data.id, authId: data.user_id } : null;
    } catch (err: any) {
      console.error("Error fetching current user's data:", err);
      setProfileError("Could not load your profile information.");
      return null;
    }
  }, [user]);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      const userData = await fetchCurrentUserData();
      setCurrentUserProfileId(userData?.profileId || null);
      setCurrentUserAuthId(userData?.authId || null);
      setProfileLoading(false);
    };
    if (user) {
      loadProfile();
    } else {
      setCurrentUserProfileId(null);
      setCurrentUserAuthId(null);
      setProfileLoading(false);
    }
  }, [user, fetchCurrentUserData]);

  // Callback for SearchList to trigger refresh of other lists if needed
  const handleSearchUpdate = () => {
    // This could re-fetch friends or requests list if an action in search results affects them
    // For now, this is a placeholder. You might need to add refs to FriendsList/RequestsList
    // and call a refresh method, or manage their data fetching in a way that it can be triggered.
    console.log("Search component reported an update.");
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FriendsHeader 
        activeView={activeView} 
        setActiveView={setActiveView} 
        isSearchActive={isSearchActive}
        setIsSearchActive={setIsSearchActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      
      <View style={styles.content}>
        {isSearchActive ? (
          currentUserProfileId && currentUserAuthId ? (
            <SearchList 
              searchQuery={searchQuery} 
              currentUserProfileId={currentUserProfileId}
              currentUserAuthId={currentUserAuthId}
              onUpdateNeeded={handleSearchUpdate}
            />
          ) : profileLoading ? (
            <Text style={{color: colors.textSecondary, textAlign: 'center', marginTop: 20}}>Loading profile...</Text>
          ) : profileError ? (
            <Text style={{color: colors.error, textAlign: 'center', marginTop: 20}}>{profileError}</Text>
          ) : (
            <Text style={{color: colors.textSecondary, textAlign: 'center', marginTop: 20}}>Could not load profile to search.</Text>
          )
        ) : activeView === 'friends' ? (
          <FriendsListComponent /> 
        ) : (
          <RequestsListComponent />
        )}
      </View>
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
    paddingVertical: 8,
    minHeight: 50,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    zIndex: 1, // Ensure back button is clickable when search is active
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    paddingBottom: 5, 
    borderBottomWidth: 3,
  },
  headerSubtitle: { 
    fontFamily: 'Inter-SemiBold', 
    fontSize: 20, 
    paddingBottom: 7, 
    borderBottomWidth: 3,
  },
  content: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    paddingHorizontal: 10,
    marginLeft: 10,
    marginRight: 10, // Space before potential close icon if search icon remains
    borderWidth: 1,
    borderRadius: 8,
  },
  searchIconContainer: {
    padding: 4,
  },
  requestsButtonContainer: {
    marginRight: 15, // Added margin to move "Requests" text a bit to the left from the search icon
  }
}); 