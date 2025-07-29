import { View, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileInfo from '@/components/profile/ProfileInfo';
// import ProfileStats from '@/components/profile/ProfileStats'; // Removed
import UserCommentsList from '@/components/profile/UserCommentsList'; // Added
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ProfileDisplayData } from '@/types/profile'; // StatsData might be removable if not used elsewhere
import { format } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; // Added imports

// Define types for the list sections
const PROFILE_INFO_SECTION = 'profileInfo';
const USER_COMMENTS_SECTION = 'userComments';

type ProfileSectionType = typeof PROFILE_INFO_SECTION | typeof USER_COMMENTS_SECTION;

interface ProfileSection {
  type: ProfileSectionType;
  key: string;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileDisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter(); // Added router
  const params = useLocalSearchParams(); // Added params
  
  // Mock stats data removed as ProfileStats is removed
  // const statsData: StatsData = {
  //   stats: {
  //     articlesRead: 387,
  //     comments: 42,
  //     portfolioGrowth: 12.4
  //   }
  // };
  
  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Keep setLoading(true) only if not just updating due to param
    if (!profileData || !(params.refreshProfile === 'true')) {
        setLoading(true);
    }
    
    try {
      // Fetch profile data from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (error) {
        console.error('Error fetching profile:', error);
        setLoading(false);
        return;
      }
      
      if (data) {
        // Format the data as needed for the profile components
        const formattedData: ProfileDisplayData = {
          user_id: data.user_id,
          name: data.name || data.username || 'User',
          username: data.username || 'user',
          bio: data.bio,
          memberSince: data.created_at ? format(new Date(data.created_at), 'MMM yyyy') : 'Unknown',
          news_categories: data.news_categories || [],
          favorite_companies: data.favorite_companies || [],
          avatar: user.user_metadata?.avatar_url,
          profile_picture_url: data.profile_picture_url
        };
        
        setProfileData(formattedData);
      }
    } catch (err) {
      console.error('Error in profile data fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profileData, params.refreshProfile]); // Added profileData and params.refreshProfile to dependencies of useCallback for setLoading logic
  
  useFocusEffect(
    useCallback(() => {
      // const currentParams = router.getCurrentRoute()?.params; // This was incorrect
      // console.log("Profile tab focused. Current Route Params:", currentParams);
      // console.log("Profile tab focused. Local Search Params (params):", params);

      const shouldRefresh = params.refreshProfile === 'true';
      
      if (shouldRefresh) {
        // console.log("Profile tab: refreshProfile === 'true'. Refreshing data...");
        fetchProfileData();
        // Clear the param so it doesn't refresh again on next focus unless set again
        router.setParams({ refreshProfile: undefined });
      } else if (!profileData && user) { // Initial load if no data yet and user is available
        // console.log("Profile tab: No profileData and user exists. Fetching initial data...");
        fetchProfileData();
      } else {
        // console.log("Profile tab: Focused, but no refresh needed, no initial load trigger, or already loaded.");
      }

    }, [user, fetchProfileData, params.refreshProfile, router, profileData])
  );
  
  const handleProfileUpdate = async () => {
    setUpdating(true);
    try {
      await fetchProfileData();
    } finally {
      setUpdating(false);
    }
  };
  
  // Define the sections for the FlatList
  const profileSections: ProfileSection[] = [];
  if (profileData) {
    profileSections.push({ type: PROFILE_INFO_SECTION, key: PROFILE_INFO_SECTION });
  }
  // Always add UserCommentsList, it has its own empty/loading states
  profileSections.push({ type: USER_COMMENTS_SECTION, key: USER_COMMENTS_SECTION });

  const renderProfileSection = ({ item }: { item: ProfileSection }) => {
    if (item.type === PROFILE_INFO_SECTION && profileData) {
      return <ProfileInfo user={profileData} onProfileUpdate={handleProfileUpdate} isCurrentUser={true} />;
    }
    if (item.type === USER_COMMENTS_SECTION) {
      return <UserCommentsList />;
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ProfileHeader />
      
      {loading && !profileData ? ( // Show main loader only if profileData is not yet available
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={profileSections}
          renderItem={renderProfileSection}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          // ListHeaderComponent={<ProfileHeader />} // Alternative way to handle header if it needs to scroll
        />
      )}
      
      {updating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0, // Header is now outside or part of FlatList items
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  }
});