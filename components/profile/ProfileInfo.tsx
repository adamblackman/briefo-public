import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { CreditCard as Edit, ChevronDown, ChevronRight, Upload, Camera, UserPlus, UserCheck, Check, X, Send } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ProfileDisplayData } from '@/types/profile';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { decode } from 'base64-arraybuffer';
import { COMPANIES } from '@/app/companies';
import { Friend, FriendshipStatus } from '@/types/friends';
import { useRouter } from 'expo-router';

type ProfileInfoProps = {
  user: ProfileDisplayData;
  onProfileUpdate: () => Promise<void>;
  isCurrentUser?: boolean;
  currentAuthUserId?: string | null;
  currentUserProfileId?: string | null;
};

export default function ProfileInfo({
  user, 
  onProfileUpdate, 
  isCurrentUser = true, 
  currentAuthUserId,
  currentUserProfileId 
}: ProfileInfoProps) {
  const { colors } = useTheme();
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [friendship, setFriendship] = useState<Friend | null>(null);
  const [isLoadingFriendship, setIsLoadingFriendship] = useState(false);
  
  useEffect(() => {
    const fetchStatus = async () => {
      const loggedInAuthId = currentAuthUserId || authUser?.id;
      if (!isCurrentUser && loggedInAuthId && user?.user_id) {
        await fetchFriendshipStatus(loggedInAuthId, user.user_id);
      }
    };
    fetchStatus();
  }, [currentAuthUserId, authUser, user?.user_id, isCurrentUser]);

  const fetchFriendshipStatus = async (loggedInAuthId: string, viewedUserAuthId: string) => {
    if (!loggedInAuthId || !viewedUserAuthId) return;
    setIsLoadingFriendship(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .or(
          `and(requester_id.eq.${loggedInAuthId},recipient_id.eq.${viewedUserAuthId}),` +
          `and(requester_id.eq.${viewedUserAuthId},recipient_id.eq.${loggedInAuthId})`
        )
        .single(); 

      if (error && error.code !== 'PGRST116') { 
        throw error;
      }
      setFriendship(data as Friend | null);
    } catch (error) {
      // console.error("Error fetching friendship status:", error);
    } finally {
      setIsLoadingFriendship(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!currentAuthUserId || !currentUserProfileId || !user?.user_id) {
      Alert.alert('Error', 'Cannot send request: User data is incomplete.');
      return;
    }
    
    setIsLoadingFriendship(true);
    try {
      const { data: newFriendship, error } = await supabase.from('friends').insert({
        requester_id: currentAuthUserId,
        recipient_id: user.user_id,
        status: 'pending' as FriendshipStatus,
      }).select('id').single();
      
      if (error) throw error;
      if (!newFriendship || !newFriendship.id) {
        throw new Error('Failed to create friendship or get its ID.');
      }

      await fetchFriendshipStatus(currentAuthUserId, user.user_id);

      try {
        const { error: functionError } = await supabase.functions.invoke('create-friend-request-notification', {
          body: {
            recipientAuthId: user.user_id,
            senderProfileId: currentUserProfileId,
            senderAuthId: currentAuthUserId,
            friendshipId: newFriendship.id,
          },
        });
        if (functionError) {
          console.error('Error calling create-friend-request-notification function:', functionError);
        }
      } catch (invokeError) {
        console.error('Exception when calling create-friend-request-notification:', invokeError);
      }

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not send friend request. Please try again.');
    } finally {
      setIsLoadingFriendship(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!authUser || !friendship || !user?.user_id || !currentUserProfileId || !currentAuthUserId) {
      Alert.alert('Error', 'Missing data to accept friend request.');
      setIsLoadingFriendship(false); // Ensure loading state is reset
      return;
    }
    setIsLoadingFriendship(true);
    try {
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' as FriendshipStatus, updated_at: new Date().toISOString() })
        .eq('id', friendship.id);

      if (updateError) throw updateError;

      // Refresh friendship state
      await fetchFriendshipStatus(currentAuthUserId, user.user_id);

      // Call Edge Function to create notification
      try {
        const { error: functionError } = await supabase.functions.invoke('create-accepted-request-notification', {
          body: {
            originalSenderAuthId: user.user_id,          // User who sent the request (profile being viewed)
            accepterProfileId: currentUserProfileId,    // Logged-in user's profile ID
            accepterAuthId: currentAuthUserId,           // Logged-in user's auth ID
            friendshipId: friendship.id               // ID of the friendship record
          },
        });
        if (functionError) {
          console.error('Error calling create-accepted-request-notification function:', functionError);
          // Non-critical, log but don't disrupt UX as request was accepted
          Alert.alert('Request Accepted', 'Friend request accepted, but there was an issue sending the notification.');
        } else {
          Alert.alert('Request Accepted', 'Friend request accepted and notification sent.');
        }
      } catch (invokeError) {
        console.error('Exception when calling create-accepted-request-notification:', invokeError);
        Alert.alert('Request Accepted', 'Friend request accepted, but there was an exception sending the notification.');
      }

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not accept friend request.');
    } finally {
      setIsLoadingFriendship(false);
    }
  };

  const handleDenyFriendRequest = async () => {
    if (!authUser || !friendship) return;
    setIsLoadingFriendship(true);
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendship.id);

      if (error) throw error;
      
      setFriendship(null);
    } catch (error) {
      Alert.alert('Error', 'Could not deny friend request.');
    } finally {
      setIsLoadingFriendship(false);
    }
  };
  
  // Get user's initials from their name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const handleProfilePictureTap = async () => {
    if (uploading || !isCurrentUser) return;
    
    // Ask user if they want to take a picture or choose from library
    Alert.alert(
      'Update Profile Picture',
      'Choose a new profile picture',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage(true),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage(false),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const pickImage = async (useCamera: boolean) => {
    try {
      // Request permissions first
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow camera access to take a photo');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow photo library access to select a photo');
          return;
        }
      }
      
      // Launch camera or image picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
          });
          
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64 && asset.uri) {
          await uploadProfilePicture(asset.base64, asset.uri);
        } else {
          Alert.alert('Error', 'Could not process this image. Please try a different one.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  
  const uploadProfilePicture = async (base64Image: string, uri: string) => {
    if (!authUser) {
      Alert.alert('Error', 'You must be logged in to update your profile');
      return;
    }
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${authUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      // Convert base64 to ArrayBuffer
      let arrayBuffer;
      try {
        arrayBuffer = decode(base64Image);
      } catch (error) {
        Alert.alert('Error', 'Failed to process the image data');
        setUploading(false);
        return;
      }
      
      // Upload to Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile_pictures')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });
      
      if (uploadError) {
        throw uploadError;
      }   
      // Get public URL
      const { data: publicUrlData } = await supabase.storage
        .from('profile_pictures')
        .getPublicUrl(filePath);
      
      if (!publicUrlData?.publicUrl) {
        throw new Error('Could not get public URL for uploaded image');
      }
            
      // Update profile with the new image URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: publicUrlData.publicUrl })
        .eq('user_id', authUser.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Refresh profile data
      await onProfileUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const navigateToChat = () => {
    if (friendship && friendship.id) {
      router.push(`/(chat)/${friendship.id}`);
    }
  };

  // Friend button styles applied dynamically
  const renderFriendButton = () => {
    const loggedInAuthId = currentAuthUserId || authUser?.id;
    if (isLoadingFriendship) {
      return <ActivityIndicator size="small" color={colors.accent} />;
    }
    
    if (friendship) {
      if (friendship.status === 'pending' && friendship.requester_id === loggedInAuthId) {
        return (
          <View style={[
            styles.requestedTextContainerBase,
            { backgroundColor: colors.backgroundSecondary }
          ]}>
            <Text style={[
              styles.requestedTextBase,
              { color: colors.textSecondary }
            ]}>Requested</Text>
          </View>
        );
      }
      
      if (friendship.status === 'pending' && friendship.recipient_id === loggedInAuthId) {
        return (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={[styles.friendIconButton, styles.acceptButton]}
              onPress={handleAcceptFriendRequest}
            >
              <Check size={24} color={colors.accent} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.friendIconButton, styles.denyButton]}
              onPress={handleDenyFriendRequest}
            >
              <X size={24} color={colors.error} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        );
      }
      
      if (friendship.status === 'accepted') {
        return (
          <TouchableOpacity 
            style={[styles.friendIconButton]}
            onPress={navigateToChat}
          >
            <Send size={20} color={colors.accent} />
          </TouchableOpacity>
        );
      }
    } else if (!isCurrentUser && loggedInAuthId && user?.user_id) {
      return (
        <TouchableOpacity 
          style={[styles.friendIconButton]}
          onPress={handleSendFriendRequest}
        >
          <UserPlus size={20} color={colors.accent} />
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  return (
    <Animated.View 
      entering={FadeIn.duration(300)}
      style={[styles.card, { backgroundColor: colors.cardBackground }]}
    > 
      <View style={styles.profileHeaderContainer}>
        <View style={styles.profileContainer}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handleProfilePictureTap}
            disabled={uploading || !isCurrentUser}
          >
            {(user.profile_picture_url || user.avatar) ? (
              <Image 
                source={{ 
                  uri: user.profile_picture_url || user.avatar 
                }} 
                style={styles.avatar} 
              />
            ) : (
              <View style={[
                styles.initialsAvatar, 
                { backgroundColor: colors.accent + '30' }
              ]}>
                <Text style={[styles.initialsText, { color: colors.accent }]}>
                  {getInitials(user.name)}
                </Text>
              </View>
            )}
            {isCurrentUser && (
              <View style={styles.cameraOverlay}>
                <Camera size={20} color="white" />
              </View>
            )}
            {uploading && isCurrentUser && (
              <View style={styles.uploadingOverlay}>
                <Upload size={24} color="white" />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.infoContainer}>
            <View style={styles.nameContainer}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">
                {user.name}
              </Text>
              {!isCurrentUser && authUser && authUser.id !== user.user_id && (
                <View style={styles.friendButtonTopRight}>
                  {renderFriendButton()}
                </View>
              )}
            </View>
            <Text style={[styles.username, { color: colors.textSecondary }]}>
              @{user.username}
            </Text>
            {user.bio && (
              <Text style={[styles.bioText, { color: colors.text }]}>
                {user.bio}
              </Text>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.detailsContainer}>
        {/* Interests Section */}
        <View style={styles.detailRow}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowAllCategories(!showAllCategories)}
          >
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Interests
            </Text>
            {showAllCategories ? (
              <ChevronDown size={18} color={colors.textSecondary} />
            ) : (
              <ChevronRight size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          
          <View style={styles.categoriesContainer}>
            {showAllCategories ? (
              <View style={styles.expandedList}>
                {user.news_categories.map((category, index) => (
                  <View key={index} style={[styles.categoryPill, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.categoryText, { color: colors.accent }]}>
                      {category}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.collapsedList}>
                {user.news_categories.slice(0, 3).map((category, index) => (
                  <View key={index} style={[styles.categoryPill, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.categoryText, { color: colors.accent }]}>
                      {category}
                    </Text>
                  </View>
                ))}
                {user.news_categories.length > 3 && (
                  <TouchableOpacity
                    onPress={() => setShowAllCategories(true)}
                    style={[styles.showMoreIndicator, { backgroundColor: colors.accent + '10' }]}
                  >
                    <Text style={[styles.showMoreText, { color: colors.accent }]}>
                      See all ({user.news_categories.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
        
        {/* Companies Section */}
        <View style={styles.detailRow}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowAllCompanies(!showAllCompanies)}
          >
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Companies
            </Text>
            {showAllCompanies ? (
              <ChevronDown size={18} color={colors.textSecondary} />
            ) : (
              <ChevronRight size={18} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          
          <View style={styles.companiesContainer}>
            {showAllCompanies ? (
              <View style={styles.expandedList}>
                {user.favorite_companies.map((ticker, index) => (
                  <View key={index} style={[styles.companyPill, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.companyText, { color: colors.accent }]}>
                      {COMPANIES[ticker as keyof typeof COMPANIES] || ticker}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.collapsedList}>
                {user.favorite_companies.slice(0, 3).map((ticker, index) => (
                  <View key={index} style={[styles.companyPill, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.companyText, { color: colors.accent }]}>
                      {COMPANIES[ticker as keyof typeof COMPANIES] || ticker}
                    </Text>
                  </View>
                ))}
                {user.favorite_companies.length > 3 && (
                  <TouchableOpacity
                    onPress={() => setShowAllCompanies(true)}
                    style={[styles.showMoreIndicator, { backgroundColor: colors.accent + '10' }]}
                  >
                    <Text style={[styles.showMoreText, { color: colors.accent }]}>
                      See all ({user.favorite_companies.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
        
        {/* Member Since */}
        <Text style={[styles.memberSinceText, { color: colors.textSecondary }]}>
          Member since {user.memberSince}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  editButton: {
    padding: 8,
  },
  profileHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  profileContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  initialsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
  },
  cameraOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  name: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginBottom: 4,
    flexShrink: 1,
    maxWidth: '75%',
  },
  username: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginBottom: 8,
  },
  bioText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  memberSinceText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'left',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  detailRow: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  categoriesContainer: {
    marginTop: 4,
  },
  categoriesScrollView: {
    paddingRight: 16,
    paddingBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  showMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  showMoreText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginRight: 4,
  },
  expandedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  collapsedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  showLessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  showLessText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginRight: 4,
  },
  companiesContainer: {
    marginTop: 4,
  },
  companiesScrollView: {
    paddingRight: 16,
    paddingBottom: 4,
  },
  companyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  companyText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  showMoreIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  friendButtonTopRight: {
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  requestedTextContainerBase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestedTextBase: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  friendIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  actionButtonsContainer: { 
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  friendButton: { 
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  acceptButton: { 
    marginRight: 0,
  },
  denyButton: { 
    marginLeft: 0,
  },
});