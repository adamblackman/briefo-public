import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, Text, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import ProfileInfo from '@/components/profile/ProfileInfo';
// We might need a different UserCommentsList or to adapt the existing one
// For now, let's assume UserCommentsList can be used or placeholder
import UserCommentsList from '@/components/profile/UserCommentsList'; 
import { supabase } from '@/lib/supabase';
import { ProfileDisplayData, UserProfile } from '@/types/profile';
import { format } from 'date-fns';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

// Define types for the list sections
const PROFILE_INFO_SECTION = 'profileInfo';
const USER_COMMENTS_SECTION = 'userComments'; // Assuming we show this user's comments

type ProfileSectionType = typeof PROFILE_INFO_SECTION | typeof USER_COMMENTS_SECTION;

interface ProfileSection {
  type: ProfileSectionType;
  key: string;
}

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { id: viewedUserId, fromModal } = useLocalSearchParams<{ id: string, fromModal?: string }>();

  const [profileData, setProfileData] = useState<ProfileDisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);

  // Handle back navigation based on where we came from
  const handleGoBack = () => {
    if (fromModal === 'true') {
      // If we came from a modal, use router.back() to return to it
      router.back();
    } else {
      // Otherwise use standard navigation
      router.back();
    }
  };

  // Fetch current logged-in user's profile ID
  useEffect(() => {
    const fetchCurrentProfileId = async () => {
      if (authUser) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authUser.id)
          .single();
        if (data) {
          setCurrentUserProfileId(data.id);
        }
        if (error) {
          console.error("Error fetching current user's profile ID:", error);
        }
      }
    };
    fetchCurrentProfileId();
  }, [authUser]);

  const fetchUserProfileData = useCallback(async () => {
    if (!viewedUserId) {
      setLoading(false);
      console.warn('User ID not provided to UserProfileScreen');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', viewedUserId) 
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        setProfileData(null);
        setLoading(false);
        return;
      }
      
      if (data) {
        const userProfile = data as UserProfile;
        
        const formattedData: ProfileDisplayData = {
          user_id: viewedUserId,
          name: userProfile.name || userProfile.username || 'User',
          username: userProfile.username || 'user',
          bio: userProfile.bio,
          memberSince: userProfile.created_at ? format(new Date(userProfile.created_at), 'MMM yyyy') : 'Unknown',
          news_categories: userProfile.news_categories || [],
          favorite_companies: userProfile.favorite_companies || [],
          profile_picture_url: userProfile.profile_picture_url, 
        };
        
        setProfileData(formattedData);
      } else {
        setProfileData(null);
      }
    } catch (err) {
      console.error('Error in user profile data fetch:', err);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  }, [viewedUserId]);
  
  useEffect(() => {
    fetchUserProfileData();
  }, [fetchUserProfileData]);
  
  // Define the sections for the FlatList
  const profileSections: ProfileSection[] = [];
  if (profileData) {
    profileSections.push({ type: PROFILE_INFO_SECTION, key: PROFILE_INFO_SECTION });
  }
  // If you want to show this user's comments, UserCommentsList would need to accept a userId prop
  // For now, it will show the logged-in user's comments unless modified.
  profileSections.push({ type: USER_COMMENTS_SECTION, key: USER_COMMENTS_SECTION });

  const renderProfileSection = ({ item }: { item: ProfileSection }) => {
    if (item.type === PROFILE_INFO_SECTION && profileData && authUser) {
      return <ProfileInfo 
                user={profileData} 
                onProfileUpdate={async () => {}} 
                isCurrentUser={false} 
                currentAuthUserId={authUser.id}
                currentUserProfileId={currentUserProfileId}
             />;
    }
    if (item.type === USER_COMMENTS_SECTION) {
      return <UserCommentsList /* userId={viewedUserId} */ />;
    }
    return null;
  };

  if (loading || (authUser && !currentUserProfileId)) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{ 
            title: 'Loading Profile...', 
            headerBackTitle: 'Back',
            headerTintColor: colors.accent,
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { color: colors.text },
            headerLeft: () => (
              <TouchableOpacity onPress={handleGoBack} style={{ marginLeft: 5, paddingRight: 5 }}>
                <ChevronLeft size={28} color={colors.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profileData && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
         <Stack.Screen options={{ 
           title: 'Profile Not Found', 
           headerBackTitle: 'Back',
           headerTintColor: colors.accent,
           headerStyle: { backgroundColor: colors.background },
           headerTitleStyle: { color: colors.text },
           headerLeft: () => (
             <TouchableOpacity onPress={handleGoBack} style={{ marginLeft: 5, paddingRight: 5 }}>
               <ChevronLeft size={28} color={colors.text} />
             </TouchableOpacity>
           ),
         }} />
        <Text style={{color: colors.text}}>User profile not found.</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: profileData?.name || 'Profile', 
          headerBackTitle: 'Back',
          headerTintColor: colors.accent,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack} style={{ marginLeft: 5, paddingRight: 5 }}>
              <ChevronLeft size={28} color={colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <FlatList
        data={profileSections}
        renderItem={renderProfileSection}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16, 
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 