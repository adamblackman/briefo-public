import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FriendDisplayData } from '@/types/friends';
import { UserProfile } from '@/types/profile'; // For type consistency, though not directly used for shaping data here
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';

const getInitials = (name: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(initial => !!initial) // Ensure not to join empty strings if name had multiple spaces
    .join('')
    .toUpperCase()
    .substring(0, 2); // Max 2 initials
};

export default function FriendsListComponent() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUserProfileId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
      if (profileError) throw profileError;
      return data?.user_id || null;
    } catch (err) {
      console.error("Error fetching current user's profile ID:", err);
      // Don't set global error here as it might be called by other components too
      return null;
    }
  }, [user]);

  const fetchFriends = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setFriends([]);
      return;
    }
    setLoading(true);
    setError(null);

    const currentUserProfileId = await fetchCurrentUserProfileId();
    if (!currentUserProfileId) {
      setError("Could not load your profile information to fetch friends.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: friendsError } = await supabase
        .from('friends')
        .select(`
          id,
          created_at,
          status,
          requester:requester_id ( id, user_id, username, name, profile_picture_url ),
          recipient:recipient_id ( id, user_id, username, name, profile_picture_url )
        `)
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUserProfileId},recipient_id.eq.${currentUserProfileId}`)
        .order('created_at', { ascending: false });

      if (friendsError) throw friendsError;

      if (data) {
        const formattedFriends: FriendDisplayData[] = data.map((item: any) => {
          const friendProfile = item.requester.user_id === currentUserProfileId ? item.recipient : item.requester;
          return {
            id: friendProfile.id, // This is the friend's profile ID
            user_id: friendProfile.user_id, // This is the friend's auth user ID (from profiles.user_id)
            username: friendProfile.username,
            name: friendProfile.name || friendProfile.username,
            profile_picture_url: friendProfile.profile_picture_url,
            friendship_id: item.id, // ID of the friendship record itself
            created_at: item.created_at, // or a specific field for when friendship was accepted
          };
        }).filter(friend => friend !== null) as FriendDisplayData[];
        setFriends(formattedFriends);
      }
    } catch (err: any) {
      console.error('Error fetching friends:', err);
      setError(err.message || 'Failed to fetch friends.');
    } finally {
      setLoading(false);
    }
  }, [user, fetchCurrentUserProfileId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

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
        <TouchableOpacity onPress={fetchFriends} style={[styles.retryButton, {backgroundColor: colors.cardBackground}]}>
            <Text style={{color: colors.text}}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={{ color: colors.textSecondary }}>You have no friends yet. Add some!</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: FriendDisplayData }) => (
    <TouchableOpacity 
      onPress={() => router.push(`/user/${item.user_id}`)}
      style={[styles.friendItem, { backgroundColor: colors.cardBackground }]}
    >
      {item.profile_picture_url ? (
        <Image
          source={{ uri: item.profile_picture_url }}
          style={styles.profilePicture}
        />
      ) : (
        <View style={[styles.initialsAvatar, { backgroundColor: colors.accent + '30' }]}>
          <Text style={[styles.initialsText, { color: colors.accent }]}>
            {getInitials(item.name)}
          </Text>
        </View>
      )}
      <View style={styles.friendTextContainer}>
        <Text style={{ color: colors.text, fontFamily: 'Inter-SemiBold' }}>{item.name}</Text>
        <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Regular' }}>@{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => {
          // Navigate to the standalone chat screen with the friendship ID
          router.push(`/(chat)/${item.friendship_id}`);
        }}
      >
        <Send size={20} color={colors.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={friends}
      renderItem={renderItem}
      keyExtractor={(item) => item.friendship_id} // Use friendship_id or friend's profile id
      style={styles.container}
      contentContainerStyle={friends.length === 0 ? styles.centeredMessageContainer : {}}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row', // Align items in a row
    alignItems: 'center', // Center items vertically
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25, // Make it circular
    marginRight: 15, // Add some space between the picture and the text
    backgroundColor: '#ccc', // Placeholder background, not visible if image loads
  },
  initialsAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    // backgroundColor will be set dynamically using theme
  },
  initialsText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18, // Adjusted from 28 for smaller avatar
    // color will be set dynamically using theme
  },
  friendTextContainer: {
    flex: 1, // Allow text to take remaining space
  },
  chatButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
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
  // listTitle is not used currently, can be removed or re-added if a title above the list is desired
}); 