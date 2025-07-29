import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/profile';
import { useRouter } from 'expo-router';
import { Send, CheckCircle, XCircle, UserPlus } from 'lucide-react-native';

// Helper to get initials from name
const getInitials = (name: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(initial => !!initial)
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export type RelationshipStatus = 'friends' | 'incoming_request' | 'outgoing_request' | 'none' | 'self';

export interface UserSearchResult extends UserProfile {
  relationship_status: RelationshipStatus;
  friendship_id?: string; // ID of the friendship or friend request record
}

interface SearchListProps {
  searchQuery: string;
  currentUserProfileId: string | null;
  currentUserAuthId: string | null;
  onUpdateNeeded?: () => void;
}

export default function SearchList({ 
  searchQuery, 
  currentUserProfileId,
  currentUserAuthId,
  onUpdateNeeded 
}: SearchListProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!searchQuery.trim() || !currentUserProfileId || !currentUserAuthId) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch profiles matching search query (excluding current user)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .not('id', 'eq', currentUserProfileId);

      if (profilesError) throw profilesError;
      
      const profiles: UserProfile[] = profilesData || [];

      if (profiles.length === 0) {
        setSearchResults([]);
        setLoading(false);
        return;
      }

      // 2. For each profile, determine relationship status
      const resultsWithStatus: UserSearchResult[] = await Promise.all(
        profiles.map(async (profile) => {
          if (profile.id === currentUserProfileId) { 
            return { 
              ...profile, 
              relationship_status: 'self' 
            } as UserSearchResult;
          }

          if (!currentUserAuthId) { 
            return { ...profile, relationship_status: 'none' } as UserSearchResult;
          }

          const { data: friendshipData, error: friendshipError } = await supabase
            .from('friends')
            .select('id, requester_id, recipient_id, status')
            .or(
              `and(requester_id.eq.${currentUserAuthId},recipient_id.eq.${profile.user_id}),` +
              `and(requester_id.eq.${profile.user_id},recipient_id.eq.${currentUserAuthId})`
            )
            .limit(1);

          if (friendshipError) {
            console.error(`Error fetching friendship for profile ${profile.id}: ${friendshipError.message}`);
            return { 
              ...profile, 
              relationship_status: 'none' 
            } as UserSearchResult;
          }
          
          let status: RelationshipStatus = 'none';
          let friendship_id: string | undefined = undefined;

          if (friendshipData && friendshipData.length > 0) {
            const friendship = friendshipData[0];
            friendship_id = friendship.id;
            if (friendship.status === 'accepted') {
              status = 'friends';
            } else if (friendship.status === 'pending') {
              if (friendship.requester_id === currentUserAuthId) {
                status = 'outgoing_request';
              } else if (friendship.recipient_id === currentUserAuthId) {
                status = 'incoming_request';
              }
            }
          }
          return { 
            ...profile, 
            relationship_status: status, 
            friendship_id 
          } as UserSearchResult;
        })
      );
      setSearchResults(resultsWithStatus.filter(r => r && r.relationship_status !== 'self') as UserSearchResult[]);

    } catch (err: any) {
      console.error('Error fetching search results:', err.message ? err.message : err);
      setError(err.message || 'Failed to search users.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentUserProfileId, currentUserAuthId, supabase]);

  useEffect(() => {
    // Basic debounce
    const handler = setTimeout(() => {
      if (searchQuery.trim().length >= 1) { // Changed from > 1 to >= 1
        fetchUsers();
      } else {
        setSearchResults([]);
        setLoading(false);
        setError(null); // Clear error if query is cleared
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, fetchUsers]);

  // Action Handlers
  const handleAcceptRequest = async (friendshipId: string, originalSenderAuthId: string, originalSenderProfileId: string) => {
    if (!currentUserAuthId || !currentUserProfileId) {
      setError('Cannot accept request: Current user information is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);
      if (updateError) throw updateError;
      
      setSearchResults(prevResults => 
        prevResults.map(user => 
          user.id === originalSenderProfileId ? { ...user, relationship_status: 'friends' } : user
        )
      );
      if (onUpdateNeeded) onUpdateNeeded();

      // Call Edge Function to create notification
      try {
        const { error: functionError } = await supabase.functions.invoke('create-accepted-request-notification', {
          body: {
            originalSenderAuthId: originalSenderAuthId,
            accepterProfileId: currentUserProfileId,
            accepterAuthId: currentUserAuthId,
            friendshipId: friendshipId,
          },
        });
        if (functionError) {
          console.error('Error calling create-accepted-request-notification function:', functionError);
          // Non-critical, log but don't disrupt UX
        }
      } catch (invokeError) {
        console.error('Exception when calling create-accepted-request-notification:', invokeError);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to accept request.');
    }
    setLoading(false);
  };

  const handleDeclineRequest = async (request_id: string, requester_profile_id: string) => {
    setLoading(true);
     try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', request_id);
      if (error) throw error;
      setSearchResults(prevResults => 
        prevResults.map(user => 
          user.id === requester_profile_id ? { ...user, relationship_status: 'none', friendship_id: undefined } : user
        )
      );
      if (onUpdateNeeded) onUpdateNeeded();
    } catch (err: any) {
      setError(err.message || 'Failed to decline request.');
    }
    setLoading(false);
  };

  const handleAddFriend = async (targetUserAuthId: string) => {
    if (!currentUserAuthId || !currentUserProfileId) {
      setError('Cannot send request: Current user information is missing.');
      return;
    }
    setLoading(true);
    try {
      const { data: newFriendship, error } = await supabase
        .from('friends')
        .insert({
          requester_id: currentUserAuthId,
          recipient_id: targetUserAuthId,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;
      if (!newFriendship || !newFriendship.id) {
        throw new Error('Failed to create friendship or get its ID.');
      }
      
      setSearchResults(prevResults =>
        prevResults.map(user =>
          user.user_id === targetUserAuthId ? { ...user, relationship_status: 'outgoing_request', friendship_id: newFriendship.id } : user
        )
      );
      if (onUpdateNeeded) onUpdateNeeded();

      // Call Edge Function to create notification
      try {
        const { error: functionError } = await supabase.functions.invoke('create-friend-request-notification', {
          body: {
            recipientAuthId: targetUserAuthId,
            senderProfileId: currentUserProfileId,
            senderAuthId: currentUserAuthId,
            friendshipId: newFriendship.id,
          },
        });
        if (functionError) {
          console.error('Error calling create-friend-request-notification function:', functionError);
          // Non-critical, log but don't disrupt UX
        }
      } catch (invokeError) {
        console.error('Exception when calling create-friend-request-notification:', invokeError);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to send friend request.');
    }
    setLoading(false);
  };


  if (loading && searchResults.length === 0) { // Show loader only on initial load or if clearing results
    return (
      <View style={styles.centeredMessageContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={{ color: colors.error }}>Error: {error}</Text>
         <TouchableOpacity onPress={fetchUsers} style={[styles.retryButton, {backgroundColor: colors.cardBackground}]}>
            <Text style={{color: colors.text}}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (searchQuery.trim().length >= 1 && !loading && searchResults.length === 0 && !error) { // Changed from > 1 to >= 1
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={{ color: colors.textSecondary }}>No users found for "{searchQuery}".</Text>
      </View>
    );
  }

  // Show this message only when the search query is empty
  if (searchQuery.trim().length === 0 && !loading && !error) { 
     return (
      <View style={styles.centeredMessageContainer}>
        <Text style={{ color: colors.textSecondary }}>Search for users by name or username.</Text>
      </View>
    );
  }


  const renderItem = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity 
      style={[styles.itemContainer, { backgroundColor: colors.cardBackground }]}
      onPress={() => router.push(`/user/${item.user_id}`)} // Navigate to user profile
    >
      <View style={styles.userInfoContainer}>
        {item.profile_picture_url ? (
          <Image
            source={{ uri: item.profile_picture_url }}
            style={styles.profilePicture}
          />
        ) : (
          <View style={[styles.initialsAvatar, { backgroundColor: colors.accent + '30' }]}>
            <Text style={[styles.initialsText, { color: colors.accent }]}>
              {getInitials(item.name || item.username || '')}
            </Text>
          </View>
        )}
        <View>
          <Text style={[styles.name, { color: colors.text }]}>{item.name || item.username}</Text>
          {item.name && item.username && <Text style={[styles.username, { color: colors.textSecondary }]}>@{item.username}</Text>}
        </View>
      </View>
      <View style={styles.actionsContainer}>
        {item.relationship_status === 'friends' && item.friendship_id && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/(chat)/${item.friendship_id}`)} 
          >
            <Send size={20} color={colors.accent} />
          </TouchableOpacity>
        )}
        {item.relationship_status === 'incoming_request' && item.friendship_id && (
          <>
            <TouchableOpacity onPress={() => handleAcceptRequest(item.friendship_id!, item.user_id, item.id)} style={styles.actionButton}>
              <CheckCircle color={colors.success} size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeclineRequest(item.friendship_id!, item.id)} style={styles.actionButton}>
              <XCircle color={colors.error} size={24} />
            </TouchableOpacity>
          </>
        )}
        {item.relationship_status === 'outgoing_request' && (
          <Text style={[styles.statusText, {color: colors.textSecondary}]}>Requested</Text>
        )}
        {item.relationship_status === 'none' && (
          <TouchableOpacity onPress={() => handleAddFriend(item.user_id)} style={styles.actionButton}>
            <UserPlus size={22} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={searchResults}
      renderItem={renderItem}
      keyExtractor={(item) => item.id} // profile id
      style={styles.container}
      contentContainerStyle={
        searchResults.length === 0 && 
        searchQuery.trim().length >= 1 &&  // Changed from > 1 to >= 1
        !error 
        ? styles.centeredMessageContainer 
        : {paddingBottom: 20}
      }
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#ccc',
  },
  initialsAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  initialsText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  name: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  username: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
   retryButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  }
}); 