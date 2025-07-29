import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Image } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { CheckCircle, XCircle } from 'lucide-react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FriendRequest, FriendshipStatus } from '@/types/friends'; // Assuming FriendRequest includes user details
import { UserProfile } from '@/types/profile';
import { useRouter } from 'expo-router';

// Added getInitials function
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

export default function RequestsListComponent() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter(); // Added router
  
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null); // Added state

  const fetchCurrentUserProfileId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data?.user_id || null;
    } catch (err) {
      console.error("Error fetching current user's profile ID:", err);
      setError("Could not load your profile information.");
      return null;
    }
  }, [user]);

  const fetchIncomingRequests = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRequests([]);
      return;
    }
    setLoading(true);
    setError(null);

    const profileId = await fetchCurrentUserProfileId();
    if (!profileId) {
      setLoading(false);
      return;
    }
    setCurrentUserProfileId(profileId); // Set the profileId to state

    try {
      const { data, error: reqError } = await supabase
        .from('friends')
        .select(`
          id, 
          created_at,
          status,
          requester:requester_id (
            id,
            user_id,
            username,
            name,
            profile_picture_url
          )
        `)
        .eq('recipient_id', profileId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;

      if (data) {
        const formattedRequests: FriendRequest[] = data.map((item: any) => ({
          id: item.id,
          user: {
            id: item.requester.id,
            user_id: item.requester.user_id,
            username: item.requester.username,
            name: item.requester.name || item.requester.username, // Fallback for name
            profile_picture_url: item.requester.profile_picture_url,
          },
          created_at: item.created_at,
          status: item.status as FriendshipStatus,
        }));
        setRequests(formattedRequests);
      }
    } catch (err: any) {
      console.error('Error fetching friend requests:', err);
      setError(err.message || 'Failed to fetch friend requests.');
    } finally {
      setLoading(false);
    }
  }, [user, fetchCurrentUserProfileId]);

  useEffect(() => {
    fetchIncomingRequests();
  }, [fetchIncomingRequests]);

  const updateRequestStatus = async (requestId: string, newStatus: FriendshipStatus) => {
    try {
      if (newStatus === 'rejected') {
        const { error } = await supabase
          .from('friends')
          .delete()
          .eq('id', requestId);
        if (error) throw error;
      } else if (newStatus === 'accepted') {
        const { error } = await supabase
          .from('friends')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', requestId);
        if (error) throw error;
      } else {
        // This case should ideally not be hit if called only from handleAccept/handleDecline
        console.warn(`updateRequestStatus called with unexpected status: ${newStatus}`);
        // Optionally, throw an error or return if the status is not supported for update
        return;
      }

      // Refresh list by removing the processed item locally
      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestId));
      // Optionally, show a success message to the user

    } catch (err: any) {
      let actionVerb = 'process';
      if (newStatus === 'accepted') {
        actionVerb = 'accept';
      } else if (newStatus === 'rejected') {
        actionVerb = 'remove'; // Changed from 'decline'
      }
      console.error(`Error ${actionVerb}ing request ${requestId}:`, err);
      setError(err.message || `Failed to ${actionVerb} request.`);
      // Re-fetch the list to ensure UI consistency in case of error
      fetchIncomingRequests(); 
    }
  };

  const handleAccept = async (request: FriendRequest) => { // Modified parameter
    if (!user || !currentUserProfileId) {
      console.error("User or current user profile ID not available to accept request.");
      setError("Could not accept request: missing user data.");
      return;
    }

    // Optimistically update UI or wait for backend confirmation
    // For now, let's proceed with the update and then notify

    try {
      // First, update the friend request status
      await updateRequestStatus(request.id, 'accepted');

      // If successful, then send the notification
      const { error: functionError } = await supabase.functions.invoke('create-accepted-request-notification', {
        body: {
          originalSenderAuthId: request.user.user_id, // The user who sent the request
          accepterProfileId: currentUserProfileId,    // The current user's profile ID (who is accepting)
          accepterAuthId: user.id,                    // The current user's auth ID (who is accepting)
          friendshipId: request.id                    // The ID of the friendship record
        }
      });

      if (functionError) {
        // Log error, but don't necessarily block UI update as request was accepted
        console.error('Error calling create-accepted-request-notification function:', functionError);
        // Optionally, inform user that notification might not have been sent
      }

    } catch (err) {
      // Error handling is already in updateRequestStatus or will be caught here if function invoke fails critically
      // setError is handled by updateRequestStatus if it fails there.
      console.error("Error in handleAccept process:", err);
    }
  };

  const handleDecline = (requestId: string) => {
    updateRequestStatus(requestId, 'rejected');
  };

  if (loading) {
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
        <TouchableOpacity onPress={fetchIncomingRequests} style={[styles.retryButton, {backgroundColor: colors.cardBackground}]}>
            <Text style={{color: colors.text}}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (requests.length === 0) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={{ color: colors.textSecondary }}>You have no pending friend requests.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: FriendRequest }) => (
    <View style={[styles.requestItem, { backgroundColor: colors.cardBackground }]}>
      <TouchableOpacity 
        style={styles.requestInfoTouchable} 
        onPress={() => router.push(`/user/${item.user.user_id}`)} // Navigate using requester's auth user ID
      >
        {item.user.profile_picture_url ? (
          <Image
            source={{ uri: item.user.profile_picture_url }}
            style={styles.profilePicture}
          />
        ) : (
          <View style={[styles.initialsAvatar, { backgroundColor: colors.accent + '30' }]}>
            <Text style={[styles.initialsText, { color: colors.accent }]}>
              {getInitials(item.user.name)}
            </Text>
          </View>
        )}
        <View style={styles.requestTextInfo}> 
          <Text style={{ color: colors.text, fontFamily: 'Inter-SemiBold' }}>{item.user.name}</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Regular' }}>@{item.user.username}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={() => handleAccept(item)} style={styles.actionButton}>
          <CheckCircle color={colors.success} size={24} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDecline(item.id)} style={styles.actionButton}>
          <XCircle color={colors.error} size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <FlatList
      data={requests}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={requests.length === 0 ? styles.centeredMessageContainer : {}}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listTitle: { // This style is defined but not currently used in the new setup.
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginBottom: 15,
  },
  requestItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestInfoTouchable: { // New style for the touchable area
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10, // Add some margin before action buttons
  },
  profilePicture: { // Added style
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#ccc', 
  },
  initialsAvatar: { // Added style
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  initialsText: { // Added style
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  requestTextInfo: { // Renamed from requestInfo and ensures it doesn't overflex
    flexShrink: 1, // Allow text to shrink if needed, rather than pushing buttons out
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 15,
    padding: 5,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  }
}); 